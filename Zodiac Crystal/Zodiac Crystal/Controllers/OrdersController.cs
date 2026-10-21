using Microsoft.AspNetCore.RateLimiting;
using System.Data;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Models;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    // Guest sessions pass this attribute but GuestAccessMiddleware still refuses
    // them on every action not marked [AllowGuest].
    [Authorize(Roles = UserRoles.CustomerOrGuest)]
    public class OrdersController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly ILogger<OrdersController> _logger;
        private readonly CouponValidationService _couponValidationService;
        private readonly InvoicePdfService _invoicePdfService;
        private readonly NotificationService _notificationService;
        private readonly IEmailService _emailService;
        private readonly BraintreePaymentService _paymentService;
        private readonly LowStockAlertService _lowStockAlertService;
        private readonly AddressCheckService _addressCheckService;

        public OrdersController(
            CrystalsDbContext context,
            ILogger<OrdersController> logger,
            CouponValidationService couponValidationService,
            InvoicePdfService invoicePdfService,
            NotificationService notificationService,
            IEmailService emailService,
            BraintreePaymentService paymentService,
            LowStockAlertService lowStockAlertService,
            AddressCheckService addressCheckService)
        {
            _addressCheckService = addressCheckService;
            _context = context;
            _logger = logger;
            _couponValidationService = couponValidationService;
            _invoicePdfService = invoicePdfService;
            _notificationService = notificationService;
            _emailService = emailService;
            _paymentService = paymentService;
            _lowStockAlertService = lowStockAlertService;
        }

        // POST: api/orders
        [EnableRateLimiting(RateLimitPolicies.Checkout)]
        [HttpPost]
        [AllowGuest]
        public async Task<ActionResult<OrderDto>> CreateOrder(CreateOrderDto dto)
        {
            var userId = GetCurrentUserId();

            if (User.IsGuest())
            {
                // Guest order emails go to the verified address, never a typed one.
                dto.ShippingEmail = User.FindFirstValue(ClaimTypes.Email)!;

                // Guest Cash on Delivery comes later, with fraud limits.
                if (dto.PaymentMethod != PaymentMethods.Card)
                {
                    return BadRequest(new { message = "Guest orders are paid by card. Log in or create an account to use Cash on Delivery." });
                }
            }

            // A retry or double-submit of an attempt that already placed its order
            // gets that order back, before any validation or charge. Checked first
            // so a later stock change can't make the replay look like a failure.
            if (dto.IdempotencyKey != null)
            {
                var existingId = await FindOrderByIdempotencyKeyAsync(userId, dto.IdempotencyKey!);
                if (existingId != null)
                {
                    return await CreatedOrderResponseAsync(existingId.Value);
                }
            }

            var payByCard = dto.PaymentMethod == PaymentMethods.Card;

            if (payByCard && string.IsNullOrWhiteSpace(dto.PaymentNonce))
            {
                return BadRequest(new { message = "Please enter your card details to pay online." });
            }

            if (payByCard && !_paymentService.IsConfigured)
            {
                return BadRequest(new { message = "Card payments are not available right now. Please choose Cash on Delivery." });
            }

            var addressError = await _addressCheckService.ValidateAsync(
                dto.Latitude, dto.Longitude, dto.City, dto.State, dto.PostalCode, HttpContext.RequestAborted);
            if (addressError != null)
            {
                return BadRequest(new { message = addressError });
            }

            // Step 1: validate every item and calculate real prices from the database
            // BEFORE writing anything, so a bad item never leaves a partial order behind.
            var validatedItems = new List<(Product Product, int Quantity, decimal Subtotal)>();

            var productIds = dto.Items.Select(i => i.ProductId).Distinct().ToList();
            var productsById = await _context.Products
                .Where(p => productIds.Contains(p.ProductId))
                .ToDictionaryAsync(p => p.ProductId);

            // Total requested per product, so the same product split across several
            // lines is checked (and later deducted) against its combined quantity.
            var quantityByProduct = dto.Items
                .GroupBy(i => i.ProductId)
                .ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));

            foreach (var item in dto.Items)
            {
                productsById.TryGetValue(item.ProductId, out var product);

                if (product == null)
                {
                    return BadRequest(new { message = $"Product {item.ProductId} does not exist" });
                }

                if (!product.IsActive)
                {
                    return BadRequest(new { message = $"{product.Name} is currently unavailable" });
                }

                if (product.StockQuantity < quantityByProduct[item.ProductId])
                {
                    return BadRequest(new
                    {
                        message = $"Only {product.StockQuantity} item(s) of {product.Name} are available"
                    });
                }

                validatedItems.Add((product, item.Quantity, product.Price * item.Quantity));
            }

            var total = validatedItems.Sum(i => i.Subtotal);

            // Threshold-based shipping: free at/above ₹999 item subtotal (before any
            // coupon/points discount), flat ₹50 otherwise. Computed here and stored on
            // the order itself, so historical orders keep whatever fee actually applied
            // even if this threshold/rate changes later.
            const decimal FreeShippingThreshold = 999m;
            const decimal FlatShippingFee = 50m;
            var shippingFee = total >= FreeShippingThreshold ? 0m : FlatShippingFee;

            // Step 2: everything is valid - create the order, order items, and reduce
            // stock together as one transaction. If anything fails, none of it saves.
            // The transaction is opened before any coupon handling so that a coupon
            // that turns out to be invalid (or races another request for the last
            // remaining use) can be cleanly rolled back with no partial writes.
            using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            Order order;
            string? chargedTransactionId = null;
            decimal chargedAmount = 0m;
            // Each product's stock before this order, for the low-stock alert.
            var stockBefore = new Dictionary<int, (Product Product, int Stock)>();

            try
            {
                decimal discountAmount = 0m;
                string? appliedCouponCode = null;

                if (!string.IsNullOrWhiteSpace(dto.CouponCode))
                {
                    var normalizedCode = dto.CouponCode.Trim().ToUpperInvariant();

                    // Re-fetch fresh (not cached) and re-validate with the exact same
                    // rules used by the /api/coupons/validate preview endpoint, so the
                    // authoritative check at checkout can never disagree with the UX check.
                    // Read with UPDLOCK: this transaction updates the row below (UsedCount),
                    // and under Serializable two checkouts that both read it with a plain
                    // shared lock deadlock when they each try to update it - one customer
                    // then gets a generic error. With UPDLOCK, checkouts using the same
                    // coupon queue briefly instead, and each sees the previous one's use.
                    var coupon = await _context.Coupons
                        .FromSql($"SELECT * FROM dbo.Coupons WITH (UPDLOCK, ROWLOCK) WHERE Code = {normalizedCode}")
                        .FirstOrDefaultAsync();

                    // Per-customer limit: counted under a lock, so two simultaneous
                    // checkouts by this customer can't both see room for one more use.
                    var userUses = coupon?.MaxUsesPerUser != null
                        ? await CouponValidationService.CountUsesByUserAsync(_context, userId, coupon.Code, lockRows: true)
                        : 0;

                    var validation = _couponValidationService.Validate(coupon, total, userUses);

                    if (!validation.Valid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = validation.Message });
                    }

                    // Atomically claim one use of the coupon. The WHERE clause re-checks
                    // UsedCount < UsageLimit at the database level so that two concurrent
                    // checkouts racing for the last remaining use can't both succeed -
                    // whichever request's UPDATE runs first wins the row and the other
                    // gets rowsAffected == 0 and rolls back cleanly.
                    //
                    // NOTE (business rule): cancelling an order never decrements
                    // UsedCount (see OrdersController.CancelOrder / AdminOrdersController).
                    // "Used" means "was successfully applied at checkout", not "is
                    // attached to a non-cancelled order" - decrementing on cancel would
                    // let someone apply a limited coupon, cancel, and reapply indefinitely.
                    var rowsAffected = await _context.Coupons
                        .Where(c => c.CouponId == coupon!.CouponId && c.UsedCount < c.UsageLimit)
                        .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, c => c.UsedCount + 1));

                    if (rowsAffected == 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "This coupon just reached its usage limit. Please try again without it." });
                    }

                    discountAmount = validation.DiscountAmount;
                    appliedCouponCode = coupon!.Code;
                }

                order = new Order
                {
                    UserId = userId,
                    TotalAmount = total - discountAmount + shippingFee,
                    CouponCode = appliedCouponCode,
                    DiscountAmount = discountAmount,
                    ShippingFee = shippingFee,
                    Status = "Pending",
                    ShippingName = dto.ShippingName,
                    ShippingEmail = dto.ShippingEmail,
                    ShippingAddress = dto.ShippingAddress,
                    City = dto.City,
                    State = dto.State,
                    PostalCode = dto.PostalCode,
                    Phone = dto.Phone,
                    // Only keep a complete pin; half a coordinate is useless.
                    Latitude = dto.Latitude.HasValue && dto.Longitude.HasValue ? Math.Round(dto.Latitude.Value, 6) : null,
                    Longitude = dto.Latitude.HasValue && dto.Longitude.HasValue ? Math.Round(dto.Longitude.Value, 6) : null,
                    PaymentMethod = payByCard ? PaymentMethods.Card : PaymentMethods.CashOnDelivery,
                    PaymentStatus = PaymentStatuses.Pending,
                    IdempotencyKey = dto.IdempotencyKey
                };

                foreach (var (product, quantity, subtotal) in validatedItems)
                {
                    order.OrderItems.Add(new OrderItem
                    {
                        ProductId = product.ProductId,
                        Quantity = quantity,
                        UnitPrice = product.Price,
                        Subtotal = subtotal
                    });
                }

                // Atomically reserve stock. The check above ran outside the transaction
                // and can be stale, so the WHERE clause re-checks availability at the
                // database level - two checkouts racing for the last unit can't both
                // succeed; the loser gets rowsAffected == 0 and rolls back cleanly.
                foreach (var (productId, quantity) in quantityByProduct)
                {
                    var rowsAffected = await _context.Products
                        .Where(p => p.ProductId == productId && p.StockQuantity >= quantity)
                        .ExecuteUpdateAsync(s => s.SetProperty(p => p.StockQuantity, p => p.StockQuantity - quantity));

                    var product = productsById[productId];

                    if (rowsAffected == 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = $"Sorry, {product.Name} just sold out or has less stock than requested. Please update your cart." });
                    }

                    // ExecuteUpdate bypasses the change tracker - reload so the tracked
                    // entity reflects the real stock (and SaveChanges won't overwrite it).
                    await _context.Entry(product).ReloadAsync();
                    stockBefore[productId] = (product, product.StockQuantity + quantity);
                }

                _context.Orders.Add(order);

                await _context.SaveChangesAsync();

                // Card payments are charged inside the transaction, once the order
                // has an id (sent to Braintree as its OrderId) but before commit. A
                // declined card rolls everything back - order, stock, coupon use -
                // so nothing is left behind and the customer can simply retry.
                // Trade-off: the transaction's locks are held for the length of the
                // Braintree call (typically ~1-2s), acceptable at this scale.
                if (payByCard)
                {
                    var payment = await _paymentService.ChargeAsync(
                        order.TotalAmount, dto.PaymentNonce!, dto.DeviceData, order.OrderId);

                    if (!payment.Success)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = payment.ErrorMessage, paymentFailed = true });
                    }

                    chargedTransactionId = payment.TransactionId;
                    chargedAmount = order.TotalAmount;
                    order.PaymentStatus = PaymentStatuses.Paid;
                    order.PaymentTransactionId = payment.TransactionId;
                    order.PaidAt = DateTime.Now;

                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();
            }
            catch (DbUpdateException ex) when (chargedTransactionId == null
                && dto.IdempotencyKey != null
                && CheckoutSafety.IsDuplicateIdempotencyKey(ex))
            {
                // A simultaneous request with the same key placed the order first.
                // This can only happen at the first SaveChanges, before any card is
                // charged, so rolling back (stock, coupon use) is all that's needed.
                await transaction.RollbackAsync();
                _context.ChangeTracker.Clear();

                var existingId = await FindOrderByIdempotencyKeyAsync(userId, dto.IdempotencyKey!);
                if (existingId != null)
                {
                    return await CreatedOrderResponseAsync(existingId.Value);
                }

                _logger.LogError(ex, "Order creation failed for user {UserId}", userId);
                return StatusCode(500, new { message = "Your order could not be placed. Please try again." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Order creation failed for user {UserId}", userId);
                await transaction.RollbackAsync();

                // The card was charged but the order couldn't be saved - give the
                // money back so the customer is never charged for a missing order.
                var reversed = false;
                if (chargedTransactionId != null)
                {
                    try
                    {
                        var reversal = await _paymentService.RefundAsync(chargedTransactionId);
                        reversed = reversal.Success;
                        if (!reversal.Success)
                        {
                            _logger.LogCritical("Charged transaction {TransactionId} could not be reversed after a failed order save",
                                chargedTransactionId);
                        }
                    }
                    catch (Exception reverseEx)
                    {
                        _logger.LogCritical(reverseEx, "Charged transaction {TransactionId} could not be reversed after a failed order save",
                            chargedTransactionId);
                    }

                    // The transaction above is already rolled back, so this row
                    // saves on its own and stays even though the order didn't.
                    if (!reversed)
                    {
                        await CheckoutSafety.RecordPaymentFailureAsync(_context, _logger, userId, chargedTransactionId,
                            chargedAmount, $"Order save failed and the charge could not be reversed: {ex.Message}");
                    }
                }

                // Tell the customer what actually happened to their money. If the
                // reversal failed, they get the transaction reference to quote; the
                // LogCritical above alerts staff, and RefundAsync is safe to retry.
                return StatusCode(500, new
                {
                    message = chargedTransactionId == null
                        ? "Your order could not be placed. Please try again."
                        : reversed
                            ? "Your order could not be placed and your payment has been reversed. Please try again."
                            : $"Your order could not be placed, and we couldn't reverse your card payment automatically. Our team has been alerted and will refund it - please contact support@crystalstudio.com quoting payment reference {chargedTransactionId}.",
                    paymentReference = chargedTransactionId != null && !reversed ? chargedTransactionId : null
                });
            }

            // The order is committed at this point - it exists regardless of what
            // happens below. A failure here (e.g. the notification email) must not
            // roll back or report the order as failed; it's already placed.
            Order createdOrder;
            try
            {
                createdOrder = await _context.Orders
                    .Include(o => o.User)
                    .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Product)
                    .FirstAsync(o => o.OrderId == order.OrderId);
            }
            catch (Exception ex)
            {
                // Fall back to the tracked order (its items and products are
                // already loaded) rather than reporting a placed order as failed.
                _logger.LogError(ex, "Order {OrderId} placed but reloading it failed", order.OrderId);
                createdOrder = order;
            }

            _logger.LogInformation("Order {OrderId} created for user {UserId}, total {TotalAmount}",
                order.OrderId, userId, order.TotalAmount);

            try
            {
                await _notificationService.NotifyOrderPlacedAsync(createdOrder);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Order {OrderId} placed but order-placed notification failed", order.OrderId);
            }

            // Sent to the order owner's account email (Order.User), not the
            // client-supplied ShippingEmail.
            try
            {
                await _emailService.SendOrderConfirmationAsync(createdOrder);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Order {OrderId} placed but order-confirmation email failed", order.OrderId);
            }

            try
            {
                await _lowStockAlertService.AlertIfCrossedAsync(stockBefore.Values.Select(s => (s.Product, s.Stock)));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Order {OrderId} placed but low-stock alert failed", order.OrderId);
            }

            try
            {
                await _notificationService.BroadcastStockAsync(stockBefore.Values.Select(s => s.Product));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Order {OrderId} placed but stock broadcast failed", order.OrderId);
            }

            // Drop the bought products from the server copy of the cart here, rather than
            // relying on the browser's delayed sync of the emptied cart - otherwise a closed
            // tab leaves the old cart saved and CartReminderService emails "you left
            // something in your cart" for things already bought.
            try
            {
                await RemoveOrderedFromSavedCartAsync(userId, order.OrderItems.Select(i => i.ProductId));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Order {OrderId} placed but saved cart cleanup failed", order.OrderId);
            }

            return CreatedAtAction(
                nameof(GetOrder),
                new { id = order.OrderId },
                MapToOrderDto(createdOrder)
            );
        }

        private Task<int?> FindOrderByIdempotencyKeyAsync(int userId, string idempotencyKey)
        {
            return _context.Orders
                .AsNoTracking()
                .Where(o => o.UserId == userId && o.IdempotencyKey == idempotencyKey)
                .Select(o => (int?)o.OrderId)
                .FirstOrDefaultAsync();
        }

        // The same 201 response CreateOrder gives for a new order.
        private async Task<ActionResult<OrderDto>> CreatedOrderResponseAsync(int orderId)
        {
            var existing = await _context.Orders
                .AsNoTracking()
                .Include(o => o.User)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .FirstAsync(o => o.OrderId == orderId);

            _logger.LogInformation("Order {OrderId} returned for a repeated checkout request", orderId);

            return CreatedAtAction(nameof(GetOrder), new { id = orderId }, MapToOrderDto(existing));
        }

        // GET: api/orders (the logged-in user's own orders)
        [HttpGet]
        [AllowGuest]
        public async Task<ActionResult<IEnumerable<OrderSummaryDto>>> GetMyOrders()
        {
            var userId = GetCurrentUserId();

            var orders = await _context.Orders
                .AsNoTracking()
                .Where(o => o.UserId == userId)
                .OrderByDescending(o => o.OrderDate)
                .Select(o => new OrderSummaryDto
                {
                    OrderId = o.OrderId,
                    OrderDate = o.OrderDate,
                    TotalAmount = o.TotalAmount,
                    Status = o.Status,
                    PaymentMethod = o.PaymentMethod,
                    PaymentStatus = o.PaymentStatus,
                    TrackingNumber = o.TrackingNumber,
                    DeliveredAt = o.DeliveredAt,
                    ShippedAt = o.ShippedAt,
                    ProductNames = o.OrderItems.Select(oi => oi.Product.Name).ToList(),
                    Items = o.OrderItems
                        .OrderBy(oi => oi.OrderItemId)
                        .Select(oi => new OrderSummaryItemDto
                        {
                            ProductId = oi.ProductId,
                            ProductName = oi.Product.Name,
                            Quantity = oi.Quantity,
                            UnitPrice = oi.UnitPrice,
                            Subtotal = oi.Subtotal,
                            ImageUrl = oi.Product.ProductImages
                                .OrderByDescending(i => i.IsPrimary)
                                .ThenBy(i => i.ProductImageId)
                                .Select(i => i.ImageUrl)
                                .FirstOrDefault()
                        })
                        .ToList()
                })
                .ToListAsync();

            return Ok(orders);
        }

        // GET: api/orders/1
        [HttpGet("{id}")]
        [AllowGuest]
        public async Task<ActionResult<OrderDto>> GetOrder(int id)
        {
            var userId = GetCurrentUserId();

            var order = await _context.Orders
                .AsNoTracking()
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .FirstOrDefaultAsync(o => o.OrderId == id);

            // Returning NotFound (not Forbidden) for someone else's order avoids
            // confirming to an attacker that a given order ID even exists.
            if (order == null || order.UserId != userId)
            {
                return NotFound(new { message = "Order not found" });
            }

            var returnRequest = await _context.ReturnRequests
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.OrderId == order.OrderId);

            return Ok(MapToOrderDto(order, returnRequest));
        }

        // GET: api/orders/1/invoice
        [EnableRateLimiting(RateLimitPolicies.Expensive)]
        [HttpGet("{id}/invoice")]
        [AllowGuest]
        public async Task<IActionResult> GetInvoice(int id)
        {
            var userId = GetCurrentUserId();

            var order = await _context.Orders
                .AsNoTracking()
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .FirstOrDefaultAsync(o => o.OrderId == id);

            // Same "NotFound, not Forbidden" ownership check as GetOrder - a customer
            // must never be able to tell, by changing the id, whether another
            // customer's order even exists, let alone download its invoice.
            if (order == null || order.UserId != userId)
            {
                return NotFound(new { message = "Order not found" });
            }

            // Nothing was supplied, so there's nothing to bill. Admins can still
            // download it (marked CANCELLED) for their records.
            if (order.Status == "Cancelled")
            {
                return BadRequest(new { message = "Invoice isn't available for cancelled orders." });
            }

            // Like most shops, the invoice is issued once the order ships: before
            // that it can still be cancelled or changed (and COD isn't paid yet).
            // Admins can download it at any stage from the admin panel.
            if (order.Status != "Shipped" && order.Status != "Delivered")
            {
                return BadRequest(new { message = "Your invoice will be available once your order ships." });
            }

            var returnRequest = await _context.ReturnRequests
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.OrderId == order.OrderId);

            var pdfBytes = _invoicePdfService.GenerateInvoice(order, returnRequest);

            return File(pdfBytes, "application/pdf", $"invoice-{order.OrderId}.pdf");
        }

        // PUT: api/orders/1/cancel
        // NOTE: this intentionally does NOT touch Coupon.UsedCount, even if the
        // order had a coupon applied. "Used" means "was successfully applied at
        // checkout", not "is attached to a non-cancelled order" - decrementing
        // here would let someone apply a limited coupon, cancel, and reapply it
        // indefinitely. See the UsedCount increment in CreateOrder for where the
        // coupon usage is actually recorded (and why it's safe under concurrency).
        [HttpPut("{id}/cancel")]
        [AllowGuest]
        public async Task<IActionResult> CancelOrder(int id, CancelOrderDto? dto)
        {
            var userId = GetCurrentUserId();
            var reason = dto?.Reason?.Trim();

            if (!string.IsNullOrEmpty(reason) && !CancellationReasons.All.Contains(reason))
            {
                return BadRequest(new { message = "Please choose a cancellation reason from the list." });
            }

            var order = await _context.Orders
                .Include(o => o.User)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .FirstOrDefaultAsync(o => o.OrderId == id);

            if (order == null || order.UserId != userId)
            {
                return NotFound(new { message = "Order not found" });
            }

            // Customers can only back out before the order has shipped - once it's
            // Shipped, Delivered, or already Cancelled, this is no longer allowed.
            if (order.Status != "Pending" && order.Status != "Confirmed")
            {
                return BadRequest(new
                {
                    message = $"An order that is {order.Status} can no longer be cancelled"
                });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            var previousStatus = order.Status;
            // Set once the money has gone back, so a later failure is reported as such.
            string? refundedTransactionId = null;

            try
            {
                // Claim the cancellation atomically. The status check above ran
                // outside the transaction, so a customer double-click or an admin
                // cancelling at the same moment could both pass it; only the request
                // whose UPDATE still finds the order cancellable goes on to restore
                // stock. The row stays locked until commit, and a failed refund
                // below rolls the claim back with everything else.
                var claimed = await _context.Orders
                    .Where(o => o.OrderId == order.OrderId && (o.Status == "Pending" || o.Status == "Confirmed"))
                    .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, "Cancelled"));

                if (claimed == 0)
                {
                    await transaction.RollbackAsync();
                    return Conflict(new { message = "This order has just been updated and can no longer be cancelled. Please refresh." });
                }

                foreach (var item in order.OrderItems)
                {
                    await _context.Products.RestoreAsync(item.ProductId, item.Quantity);
                    await _context.Entry(item.Product).ReloadAsync();
                }

                order.Status = "Cancelled";
                order.CancellationReason = string.IsNullOrEmpty(reason) ? null : reason;

                // A paid card order is refunded (or voided, if not yet settled)
                // before the cancellation is committed - if the refund fails the
                // order stays as it was, so it's never cancelled without a refund.
                if (order.PaymentStatus == PaymentStatuses.Paid && order.PaymentTransactionId != null)
                {
                    var refund = await _paymentService.RefundAsync(order.PaymentTransactionId);

                    if (!refund.Success)
                    {
                        await transaction.RollbackAsync();
                        return StatusCode(502, new { message = refund.ErrorMessage });
                    }

                    refundedTransactionId = order.PaymentTransactionId;
                    order.PaymentStatus = PaymentStatuses.Refunded;
                }
                else if (order.PaymentStatus == PaymentStatuses.Pending)
                {
                    order.PaymentStatus = PaymentStatuses.Cancelled;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();

                if (refundedTransactionId != null)
                {
                    // The money went back but the order still shows Paid. Retrying is
                    // safe: RefundAsync sees the refund/void and won't repay it.
                    _logger.LogCritical(ex, "Refund {TransactionId} issued for order {OrderId} but saving the cancellation failed",
                        refundedTransactionId, order.OrderId);
                    return StatusCode(500, new
                    {
                        message = "Your payment has been refunded, but we couldn't finish cancelling the order. Please try again - you won't be refunded twice."
                    });
                }

                _logger.LogError(ex, "Customer cancellation failed for order {OrderId}", order.OrderId);
                return StatusCode(500, new { message = "Could not cancel this order. Please try again." });
            }

            // The cancellation (and any refund) is committed - confirm it by email,
            // including the refund, using the same status email admins trigger.
            // A failure here is only logged; the order is already cancelled.
            try
            {
                await _emailService.SendOrderStatusUpdateAsync(order, previousStatus);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Order {OrderId} cancelled but cancellation email failed", order.OrderId);
            }

            await _notificationService.BroadcastAdminChangeAsync("order", order.OrderId, "cancelled");
            await _notificationService.BroadcastStockAsync(order.OrderItems.Select(i => i.Product));

            return NoContent();
        }

        // Removes only the ordered products, so a Buy Now order keeps the rest of the cart
        // (and its reminder). Deletes the saved cart once nothing is left in it.
        private async Task RemoveOrderedFromSavedCartAsync(int userId, IEnumerable<int> orderedProductIds)
        {
            var saved = await _context.SavedCarts.FirstOrDefaultAsync(c => c.UserId == userId);
            if (saved == null)
            {
                return;
            }

            var ordered = orderedProductIds.ToHashSet();
            var lines = JsonSerializer.Deserialize<List<CartController.CartLine>>(saved.ItemsJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            var remaining = lines.Where(l => !ordered.Contains(l.ProductId)).ToList();

            if (remaining.Count == lines.Count)
            {
                return;
            }

            if (remaining.Count == 0)
            {
                _context.SavedCarts.Remove(saved);
            }
            else
            {
                // Same JSON shape CartController.SaveCart writes. UpdatedAt is left alone so
                // the leftover items keep their place in the reminder schedule.
                saved.ItemsJson = JsonSerializer.Serialize(
                    remaining.Select(l => new { productId = l.ProductId, quantity = l.Quantity }));
            }

            await _context.SaveChangesAsync();
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }

        internal static OrderDto MapToOrderDto(Order order, ReturnRequest? returnRequest = null)
        {
            var windowEndsAt = ReturnPolicy.WindowEndsAt(order);
            var estimate = DeliveryEstimate.Window(order);

            return new OrderDto
            {
                ConfirmedAt = order.ConfirmedAt,
                ShippedAt = order.ShippedAt,
                CourierName = order.CourierName,
                TrackingNumber = order.TrackingNumber,
                DeliveredAt = order.DeliveredAt,
                EstimatedDeliveryFrom = estimate?.From,
                EstimatedDeliveryTo = estimate?.To,
                CancellationReason = order.CancellationReason,
                ReturnStatus = returnRequest?.Status,
                ReturnAdminNote = returnRequest?.AdminNote,
                ReturnWindowEndsAt = windowEndsAt,
                CanRequestReturn = returnRequest == null && windowEndsAt != null && DateTime.Now <= windowEndsAt.Value,
                OrderId = order.OrderId,
                OrderDate = order.OrderDate,
                TotalAmount = order.TotalAmount,
                Status = order.Status,
                CouponCode = order.CouponCode,
                DiscountAmount = order.DiscountAmount,
                ShippingFee = order.ShippingFee,
                PaymentMethod = order.PaymentMethod,
                PaymentStatus = order.PaymentStatus,
                PaidAt = order.PaidAt,
                ShippingName = order.ShippingName,
                ShippingEmail = order.ShippingEmail,
                ShippingAddress = order.ShippingAddress,
                City = order.City,
                State = order.State,
                PostalCode = order.PostalCode,
                Phone = order.Phone,
                Latitude = order.Latitude,
                Longitude = order.Longitude,
                Items = order.OrderItems.Select(oi => new OrderItemDto
                {
                    OrderItemId = oi.OrderItemId,
                    ProductId = oi.ProductId,
                    ProductName = oi.Product.Name,
                    Quantity = oi.Quantity,
                    UnitPrice = oi.UnitPrice,
                    Subtotal = oi.Subtotal
                }).ToList()
            };
        }
    }
}
