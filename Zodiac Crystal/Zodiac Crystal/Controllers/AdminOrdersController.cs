using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Models;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/Admin/Orders")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminOrdersController : ControllerBase
    {
        private const string StatusPending = "Pending";
        private const string StatusConfirmed = "Confirmed";
        private const string StatusShipped = "Shipped";
        private const string StatusDelivered = "Delivered";
        private const string StatusCancelled = "Cancelled";

        private static readonly string[] ValidStatuses =
            { StatusPending, StatusConfirmed, StatusShipped, StatusDelivered, StatusCancelled };

        // Maps each status to the set of statuses it may move to. Delivered and
        // Cancelled are terminal - nothing can move out of them.
        private static readonly Dictionary<string, string[]> AllowedTransitions = new()
        {
            [StatusPending] = new[] { StatusConfirmed, StatusCancelled },
            [StatusConfirmed] = new[] { StatusShipped, StatusCancelled },
            [StatusShipped] = new[] { StatusDelivered, StatusCancelled },
            [StatusDelivered] = Array.Empty<string>(),
            [StatusCancelled] = Array.Empty<string>()
        };

        private readonly CrystalsDbContext _context;
        private readonly AuditLogService _auditLogService;
        private readonly NotificationService _notificationService;
        private readonly IEmailService _emailService;
        private readonly BraintreePaymentService _paymentService;
        private readonly ILogger<AdminOrdersController> _logger;

        public AdminOrdersController(
            CrystalsDbContext context,
            AuditLogService auditLogService,
            NotificationService notificationService,
            IEmailService emailService,
            BraintreePaymentService paymentService,
            ILogger<AdminOrdersController> logger)
        {
            _context = context;
            _auditLogService = auditLogService;
            _notificationService = notificationService;
            _emailService = emailService;
            _paymentService = paymentService;
            _logger = logger;
        }

        // "payment" filter values: a payment status (Paid / Pending / Refunded /
        // Cancelled) or a payment method (Card / COD). Unknown values are ignored,
        // matching how an unknown order status is treated.
        private static readonly string[] PaymentStatusFilters =
            { PaymentStatuses.Paid, PaymentStatuses.Pending, PaymentStatuses.Refunded, PaymentStatuses.Cancelled };

        private static readonly string[] PaymentMethodFilters =
            { PaymentMethods.Card, PaymentMethods.CashOnDelivery };

        private static IQueryable<Models.Order> ApplyFilters(IQueryable<Models.Order> query, string? search, string? status, string? payment = null)
        {
            if (!string.IsNullOrWhiteSpace(payment))
            {
                if (PaymentStatusFilters.Contains(payment))
                {
                    query = query.Where(o => o.PaymentStatus == payment);
                }
                else if (PaymentMethodFilters.Contains(payment))
                {
                    query = query.Where(o => o.PaymentMethod == payment);
                }
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var parsedOrderId = int.TryParse(search, out var searchOrderId);

                query = query.Where(o =>
                    o.User.Name.Contains(search) ||
                    o.User.Email.Contains(search) ||
                    (o.TrackingNumber != null && o.TrackingNumber.Contains(search)) ||
                    (parsedOrderId && o.OrderId == searchOrderId));
            }

            if (!string.IsNullOrWhiteSpace(status) && ValidStatuses.Contains(status))
            {
                query = query.Where(o => o.Status == status);
            }

            return query;
        }

        // GET: api/admin/orders
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AdminOrderDto>>> GetAllOrders()
        {
            var orders = await _context.Orders
                .Include(o => o.User)
                .OrderByDescending(o => o.OrderDate)
                .Select(o => new AdminOrderDto
                {
                    OrderId = o.OrderId,
                    CustomerName = o.User.Name,
                    CustomerEmail = o.User.Email,
                    OrderDate = o.OrderDate,
                    TotalAmount = o.TotalAmount,
                    CouponCode = o.CouponCode,
                    DiscountAmount = o.DiscountAmount,
                    ShippingFee = o.ShippingFee,
                    Status = o.Status,
                    PaymentMethod = o.PaymentMethod,
                    PaymentStatus = o.PaymentStatus,
                    IsGiftWrap = o.IsGiftWrap
                })
                .ToListAsync();

            return Ok(orders);
        }

        // GET: api/admin/orders/5
        // Full order for the admin detail drawer: items, shipping address,
        // payment, customer, a timeline, and the status changes still allowed.
        [HttpGet("{id:int}")]
        public async Task<ActionResult<AdminOrderDetailDto>> GetOrder(int id)
        {
            var order = await _context.Orders
                .AsNoTracking()
                .Include(o => o.User)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .FirstOrDefaultAsync(o => o.OrderId == id);

            if (order == null)
            {
                return NotFound(new { message = "Order not found" });
            }

            var returnRequest = await _context.ReturnRequests
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.OrderId == order.OrderId);

            // Admin status changes are recorded in the audit log, which is what
            // gives the timeline its "Shipped on ..." entries.
            var statusChanges = await _context.AuditLogs
                .AsNoTracking()
                .Where(a => a.EntityType == "Order" && a.EntityId == order.OrderId && a.Action == "OrderStatusChanged")
                .OrderBy(a => a.CreatedAt)
                .Select(a => new OrderStatusChangeLog
                {
                    CreatedAt = a.CreatedAt,
                    Details = a.Details,
                    AdminName = a.AdminUser.Name
                })
                .ToListAsync();

            var timeline = BuildOrderTimeline(order, statusChanges, returnRequest);

            return Ok(new AdminOrderDetailDto
            {
                Order = OrdersController.MapToOrderDto(order, returnRequest),
                CustomerUserId = order.UserId,
                CustomerName = order.User.Name,
                CustomerEmail = order.User.Email,
                AllowedNextStatuses = AllowedTransitions.TryGetValue(order.Status, out var next) ? next.ToList() : new List<string>(),
                Timeline = timeline
            });
        }

        private static List<OrderTimelineEventDto> BuildOrderTimeline(
            Order order,
            List<OrderStatusChangeLog> statusChanges,
            ReturnRequest? returnRequest)
        {
            var timeline = new List<OrderTimelineEventDto>
            {
                new()
                {
                    At = order.OrderDate,
                    Title = "Order placed",
                    Detail = order.PaymentMethod == PaymentMethods.Card ? "Paid by card" : "Cash on Delivery",
                    Kind = "placed"
                }
            };

            // Card orders are paid at checkout, so only show a separate "paid"
            // step for COD, where it marks the cash being collected.
            if (order.PaidAt != null && order.PaymentMethod == PaymentMethods.CashOnDelivery)
            {
                timeline.Add(new OrderTimelineEventDto { At = order.PaidAt, Title = "Payment collected", Kind = "paid" });
            }

            AddStatusChangeEvents(timeline, statusChanges, order);
            AddRefundAndReturnEvents(timeline, order, returnRequest);

            // Undated events keep their logical place at the end.
            return timeline
                .Select((e, index) => (e, index))
                .OrderBy(x => x.e.At ?? DateTime.MaxValue)
                .ThenBy(x => x.index)
                .Select(x => x.e)
                .ToList();
        }

        private static void AddStatusChangeEvents(
            List<OrderTimelineEventDto> timeline,
            List<OrderStatusChangeLog> statusChanges,
            Order order)
        {
            foreach (var change in statusChanges)
            {
                // Details look like "Pending -> Confirmed".
                var newStatus = change.Details?.Split("->").LastOrDefault()?.Trim() ?? "Updated";
                var isCancelled = newStatus == StatusCancelled;
                timeline.Add(new OrderTimelineEventDto
                {
                    At = change.CreatedAt,
                    Title = isCancelled ? StatusCancelled : $"Marked {newStatus}",
                    Detail = $"by {change.AdminName}",
                    Kind = isCancelled ? "cancelled" : "status"
                });
            }

            // A customer cancelling their own order isn't audit-logged.
            var hasAdminCancellation = statusChanges.Any(c => c.Details != null && c.Details.EndsWith(StatusCancelled));
            if (order.Status == StatusCancelled && !hasAdminCancellation)
            {
                var detail = order.CancellationReason == null ? "by the customer" : $"by the customer · {order.CancellationReason}";
                timeline.Add(new OrderTimelineEventDto { At = null, Title = StatusCancelled, Detail = detail, Kind = "cancelled" });
            }
        }

        private static void AddRefundAndReturnEvents(
            List<OrderTimelineEventDto> timeline,
            Order order,
            ReturnRequest? returnRequest)
        {
            if (order.PaymentStatus == PaymentStatuses.Refunded && returnRequest?.Status != ReturnStatuses.Refunded)
            {
                timeline.Add(new OrderTimelineEventDto { At = null, Title = "Card payment refunded", Kind = "refund" });
            }

            if (returnRequest == null)
            {
                return;
            }

            timeline.Add(new OrderTimelineEventDto
            {
                At = returnRequest.CreatedAt,
                Title = "Return requested",
                Detail = ReturnReasons.Label(returnRequest.Reason),
                Kind = "return"
            });

            if (returnRequest.Status != ReturnStatuses.Requested)
            {
                timeline.Add(new OrderTimelineEventDto
                {
                    At = returnRequest.ResolvedAt,
                    Title = $"Return {returnRequest.Status.ToLowerInvariant()}",
                    Detail = returnRequest.AdminNote,
                    Kind = returnRequest.Status == ReturnStatuses.Refunded ? "refund" : "return"
                });
            }
        }

        private sealed class OrderStatusChangeLog
        {
            public DateTime CreatedAt { get; set; }
            public string? Details { get; set; }
            public string AdminName { get; set; } = string.Empty;
        }

        // GET: api/admin/orders/paged?pageNumber=1&pageSize=20&search=&status=&payment=
        [HttpGet("paged")]
        public async Task<ActionResult<PagedResult<AdminOrderDto>>> GetOrdersPaged(
            int pageNumber = 1,
            int pageSize = 20,
            string? search = null,
            string? status = null,
            string? payment = null)
        {
            if (pageNumber < 1)
            {
                pageNumber = 1;
            }

            if (pageSize < 1)
            {
                pageSize = 20;
            }
            else if (pageSize > 100)
            {
                pageSize = 100;
            }

            var query = ApplyFilters(_context.Orders.Include(o => o.User).AsQueryable(), search, status, payment);

            var totalCount = await query.CountAsync();

            var orders = await query
                .OrderByDescending(o => o.OrderDate)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(o => new AdminOrderDto
                {
                    OrderId = o.OrderId,
                    CustomerName = o.User.Name,
                    CustomerEmail = o.User.Email,
                    OrderDate = o.OrderDate,
                    TotalAmount = o.TotalAmount,
                    CouponCode = o.CouponCode,
                    DiscountAmount = o.DiscountAmount,
                    ShippingFee = o.ShippingFee,
                    Status = o.Status,
                    PaymentMethod = o.PaymentMethod,
                    PaymentStatus = o.PaymentStatus
                })
                .ToListAsync();

            return Ok(new PagedResult<AdminOrderDto>
            {
                Items = orders,
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            });
        }

        // GET: api/admin/orders/export?search=&status=&payment=
        // Exports whatever the currently applied search/status/payment filters would
        // show - reuses the exact same ApplyFilters logic as the paged listing
        // endpoint, just without pagination, so the two can never disagree on what matches.
        [HttpGet("export")]
        public async Task<IActionResult> ExportOrders(string? search = null, string? status = null, string? payment = null)
        {
            var orders = await ApplyFilters(_context.Orders.Include(o => o.User).AsQueryable(), search, status, payment)
                .OrderByDescending(o => o.OrderDate)
                .Select(o => new
                {
                    o.OrderId,
                    o.User.Name,
                    o.User.Email,
                    o.OrderDate,
                    o.Status,
                    o.ShippingName,
                    o.Phone,
                    o.ShippingAddress,
                    o.City,
                    o.State,
                    o.PostalCode,
                    o.Latitude,
                    o.Longitude,
                    o.DeliveryInstructions,
                    // Same figure as the invoice: the stored line subtotals added up.
                    Subtotal = o.OrderItems.Sum(oi => oi.Subtotal),
                    o.DiscountAmount,
                    o.ShippingFee,
                    o.TotalAmount,
                    o.CouponCode,
                    o.PaymentMethod,
                    o.PaymentStatus,
                    o.PaidAt,
                    o.PaymentTransactionId,
                    o.ShippedAt,
                    o.ConfirmedAt,
                    o.CourierName,
                    o.TrackingNumber,
                    o.DeliveredAt,
                    o.CancellationReason,
                    // At most one return per order; null when none was requested.
                    ReturnStatus = _context.ReturnRequests
                        .Where(r => r.OrderId == o.OrderId)
                        .Select(r => r.Status)
                        .FirstOrDefault()
                })
                .ToListAsync();

            var headers = new[]
            {
                "OrderId", "OrderType", "Customer", "CustomerEmail", "Date", "Status",
                "ShipTo", "Phone", "ShippingAddress", "City", "State", "PIN", "MapLink", "DeliveryInstructions",
                "ConfirmedAt", "ShippedAt", "Courier", "TrackingNumber", "DeliveredAt", "CancellationReason", "ReturnStatus", "PaymentMethod", "PaymentStatus", "PaidAt", "TransactionId",
                "Subtotal", "Discount", "Shipping", "Total", "CouponCode"
            };

            // A Mystery Box order stores the MYSTERY-BOX sentinel in CouponCode and its
            // box savings in DiscountAmount - label it as its own order type rather
            // than letting it look like a real coupon was redeemed.
            var rows = orders.Select(o =>
            {
                var isMysteryBox = o.CouponCode == MysteryBoxController.MysteryBoxCouponCode;

                return new object?[]
                {
                    o.OrderId,
                    isMysteryBox ? "Mystery Box" : "Regular",
                    o.Name,
                    o.Email,
                    o.OrderDate,
                    o.Status,
                    o.ShippingName,
                    o.Phone,
                    o.ShippingAddress,
                    o.City,
                    o.State,
                    o.PostalCode,
                    // Only when the customer dropped a pin on the map at checkout.
                    o.Latitude.HasValue && o.Longitude.HasValue
                        ? string.Create(System.Globalization.CultureInfo.InvariantCulture,
                            $"https://www.google.com/maps?q={o.Latitude.Value},{o.Longitude.Value}")
                        : "",
                    o.DeliveryInstructions ?? "",
                    o.ConfirmedAt,
                    o.ShippedAt,
                    o.CourierName ?? "",
                    o.TrackingNumber ?? "",
                    o.DeliveredAt,
                    o.CancellationReason ?? "",
                    o.ReturnStatus ?? "",
                    PaymentLabels.Method(o.PaymentMethod),
                    o.PaymentStatus,
                    o.PaidAt,
                    o.PaymentTransactionId ?? "",
                    o.Subtotal,
                    o.DiscountAmount,
                    o.ShippingFee,
                    o.TotalAmount,
                    isMysteryBox ? "" : o.CouponCode ?? ""
                };
            });

            var csv = CsvExportService.BuildCsv(headers, rows);

            return File(csv, "text/csv", "orders-export.csv");
        }

        // GET: api/admin/orders/1/invoice
        [HttpGet("{id:int}/invoice")]
        public async Task<IActionResult> GetInvoice(int id)
        {
            var order = await _context.Orders
                .AsNoTracking()
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .FirstOrDefaultAsync(o => o.OrderId == id);

            if (order == null)
            {
                return NotFound(new { message = "Order not found" });
            }

            var returnRequest = await _context.ReturnRequests
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.OrderId == order.OrderId);

            var pdfBytes = InvoicePdfService.GenerateInvoice(order, returnRequest);

            return File(pdfBytes, "application/pdf", $"invoice-{order.OrderId}.pdf");
        }

        // PUT: api/admin/orders/1/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, UpdateOrderStatusDto dto)
        {
            if (!ValidStatuses.Contains(dto.Status))
            {
                return BadRequest(new { message = "Invalid order status" });
            }

            var order = await _context.Orders
                .Include(o => o.User)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .FirstOrDefaultAsync(o => o.OrderId == id);

            if (order == null)
            {
                return NotFound(new { message = "Order not found" });
            }

            var transitionError = ValidateStatusTransition(order, dto.Status);
            if (transitionError != null)
            {
                return BadRequest(new { message = transitionError });
            }

            if (!TryPrepareShippingDetails(dto, order.OrderId, out var courierName, out var trackingNumber, out var shippingError))
            {
                return BadRequest(new { message = shippingError });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            var previousStatus = order.Status;
            // Set once the money has gone back, so a later failure is reported as such.
            string? refundedTransactionId = null;

            try
            {
                // Claim the transition atomically: it only applies if the order is
                // still in the status this request validated against. A customer
                // cancelling (or another admin) at the same moment makes this match
                // nothing, so the same order can't be cancelled - and restocked -
                // twice. The row stays locked until commit; a failed refund below
                // rolls the claim back with everything else.
                var claimed = await _context.Orders
                    .Where(o => o.OrderId == order.OrderId && o.Status == previousStatus)
                    .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, dto.Status));

                if (claimed == 0)
                {
                    await transaction.RollbackAsync();
                    return Conflict(new { message = "This order was just updated by someone else. Refresh and try again." });
                }

                if (dto.Status == StatusCancelled)
                {
                    var cancelResult = await HandleOrderCancellationAsync(order, previousStatus);
                    if (!cancelResult.Success)
                    {
                        await transaction.RollbackAsync();
                        return StatusCode(502, new { message = cancelResult.ErrorMessage });
                    }
                    refundedTransactionId = cancelResult.RefundedTransactionId;
                }

                ApplyStatusTimestampsAndPayment(order, dto.Status, courierName, trackingNumber);
                order.Status = dto.Status;

                _auditLogService.Log(
                    GetCurrentAdminId(),
                    "OrderStatusChanged",
                    "Order",
                    order.OrderId,
                    BuildAuditLogDetails(previousStatus, dto.Status, courierName, trackingNumber));

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return HandleUpdateStatusException(ex, order, refundedTransactionId);
            }

            await SendStatusChangeNotificationsAsync(order, previousStatus);

            return NoContent();
        }

        private static string? ValidateStatusTransition(Order order, string newStatus)
        {
            if (order.Status == newStatus)
            {
                return $"Order is already {order.Status}";
            }

            if (!AllowedTransitions.TryGetValue(order.Status, out var allowed) || !allowed.Contains(newStatus))
            {
                return $"Cannot change order status from {order.Status} to {newStatus}";
            }

            return null;
        }

        private static bool TryPrepareShippingDetails(
            UpdateOrderStatusDto dto,
            int orderId,
            out string? courierName,
            out string? trackingNumber,
            out string? errorMessage)
        {
            courierName = dto.CourierName?.Trim();
            trackingNumber = dto.TrackingNumber?.Trim();
            errorMessage = null;

            if (dto.Status != StatusShipped)
            {
                return true;
            }

            if (string.IsNullOrEmpty(courierName))
            {
                errorMessage = "Choose a courier before marking the order as shipped.";
                return false;
            }

            if (string.IsNullOrEmpty(trackingNumber))
            {
                trackingNumber = GenerateTrackingNumber(orderId);
            }

            return true;
        }

        private async Task<(bool Success, string? ErrorMessage, string? RefundedTransactionId)> HandleOrderCancellationAsync(
            Order order,
            string previousStatus)
        {
            // A shipped order's items are with the courier, not on the shelf,
            // so cancelling it doesn't put them back on sale. Stock comes back
            // through the Stock page once the parcel is actually returned.
            if (previousStatus != StatusShipped)
            {
                foreach (var item in order.OrderItems)
                {
                    await _context.Products.RestoreAsync(item.ProductId, item.Quantity);
                    await _context.Entry(item.Product).ReloadAsync();
                }
            }

            // Refund (or void) a paid card order before committing the
            // cancellation; if the refund fails nothing changes.
            if (order.PaymentStatus == PaymentStatuses.Paid && order.PaymentTransactionId != null)
            {
                var refund = await _paymentService.RefundAsync(order.PaymentTransactionId);

                if (!refund.Success)
                {
                    return (false, refund.ErrorMessage, null);
                }

                order.PaymentStatus = PaymentStatuses.Refunded;
                return (true, null, order.PaymentTransactionId);
            }

            if (order.PaymentStatus == PaymentStatuses.Pending)
            {
                order.PaymentStatus = PaymentStatuses.Cancelled;
            }

            return (true, null, null);
        }

        private static void ApplyStatusTimestampsAndPayment(
            Order order,
            string newStatus,
            string? courierName,
            string? trackingNumber)
        {
            if (newStatus == StatusConfirmed)
            {
                order.ConfirmedAt = DateTime.Now;
            }
            else if (newStatus == StatusShipped)
            {
                order.ShippedAt = DateTime.Now;
                order.CourierName = courierName;
                order.TrackingNumber = trackingNumber;
            }
            else if (newStatus == StatusDelivered)
            {
                order.DeliveredAt = DateTime.Now;

                // Cash on Delivery is collected when the order is delivered.
                if (order.PaymentMethod == PaymentMethods.CashOnDelivery &&
                    order.PaymentStatus == PaymentStatuses.Pending)
                {
                    order.PaymentStatus = PaymentStatuses.Paid;
                    order.PaidAt = DateTime.Now;
                }
            }
        }

        private static string BuildAuditLogDetails(
            string previousStatus,
            string newStatus,
            string? courierName,
            string? trackingNumber)
        {
            if (newStatus == StatusShipped)
            {
                return $"{previousStatus} -> {newStatus} ({courierName} {trackingNumber})";
            }

            if (newStatus == StatusCancelled && previousStatus == StatusShipped)
            {
                return $"{previousStatus} -> {newStatus} (in transit, not restocked)";
            }

            return $"{previousStatus} -> {newStatus}";
        }

        private IActionResult HandleUpdateStatusException(Exception ex, Order order, string? refundedTransactionId)
        {
            if (refundedTransactionId != null)
            {
                // Refunded at the gateway, but the order still shows Paid. Retrying
                // is safe: RefundAsync sees the refund/void and won't repay it.
                _logger.LogCritical(ex, "Refund {TransactionId} issued for order {OrderId} but saving the cancellation failed",
                    refundedTransactionId, order.OrderId);
                return StatusCode(500, new
                {
                    message = $"The payment was refunded (reference {refundedTransactionId}) but the order couldn't be updated. Retry the cancellation - it won't refund twice."
                });
            }

            _logger.LogError(ex, "Failed to update status for order {OrderId}", order.OrderId);
            return StatusCode(500, new { message = "Could not update order status. Please try again." });
        }

        private async Task SendStatusChangeNotificationsAsync(Order order, string previousStatus)
        {
            // The status change is committed at this point regardless of what
            // happens below. A notification failure must not be reported as a
            // failed status update - it already succeeded.
            try
            {
                await _notificationService.NotifyOrderStatusChangedAsync(order, previousStatus);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Order {OrderId} status updated but status-changed notification failed", order.OrderId);
            }

            try
            {
                await _emailService.SendOrderStatusUpdateAsync(order, previousStatus);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Order {OrderId} status updated but status-update email failed", order.OrderId);
            }

            await _notificationService.BroadcastAdminChangeAsync("order", order.OrderId, "status");
            if (order.Status == StatusCancelled)
            {
                await _notificationService.BroadcastStockAsync(order.OrderItems.Select(i => i.Product));
            }
        }

        // Demo tracking number, e.g. ZC000042-7K3Q9M. Not registered with any courier.
        private static string GenerateTrackingNumber(int orderId)
        {
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            var suffix = new string(Enumerable.Range(0, 6)
                .Select(_ => chars[Random.Shared.Next(chars.Length)])
                .ToArray());
            return $"ZC{orderId:D6}-{suffix}";
        }

        private int GetCurrentAdminId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }
    }
}
