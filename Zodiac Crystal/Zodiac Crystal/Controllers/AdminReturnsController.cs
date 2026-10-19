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
    // Admin side of returns: Requested -> Approve / Reject, then Approved -> Refund
    // (once the items are back). Card refunds go through Braintree; Cash on
    // Delivery refunds are paid out manually and just recorded here.
    [Route("api/Admin/Returns")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminReturnsController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly BraintreePaymentService _paymentService;
        private readonly AuditLogService _auditLogService;
        private readonly IEmailService _emailService;
        private readonly NotificationService _notificationService;
        private readonly ILogger<AdminReturnsController> _logger;

        public AdminReturnsController(
            CrystalsDbContext context,
            BraintreePaymentService paymentService,
            AuditLogService auditLogService,
            IEmailService emailService,
            NotificationService notificationService,
            ILogger<AdminReturnsController> logger)
        {
            _context = context;
            _paymentService = paymentService;
            _auditLogService = auditLogService;
            _emailService = emailService;
            _notificationService = notificationService;
            _logger = logger;
        }

        // GET: api/admin/returns?status=Requested
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ReturnRequestDto>>> GetReturns(string? status = null)
        {
            var query = _context.ReturnRequests
                .AsNoTracking()
                .Include(r => r.Order).ThenInclude(o => o.User)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(r => r.Status == status);
            }

            var returns = await query.OrderByDescending(r => r.CreatedAt).ToListAsync();

            return Ok(returns.Select(ReturnMapper.ToDto));
        }

        // GET: api/admin/returns/paged?pageNumber=1&pageSize=20&status=Requested
        // The Returns page uses this; the unpaged list above stays for the
        // dashboard and nav badge, which need all rows.
        [HttpGet("paged")]
        public async Task<ActionResult<PagedResult<ReturnRequestDto>>> GetReturnsPaged(
            int pageNumber = 1,
            int pageSize = 20,
            string? status = null,
            string? search = null)
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

            var query = ApplyFilters(
                _context.ReturnRequests.AsNoTracking().Include(r => r.Order).ThenInclude(o => o.User),
                search, status);

            var totalCount = await query.CountAsync();

            var returns = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new PagedResult<ReturnRequestDto>
            {
                Items = returns.Select(ReturnMapper.ToDto).ToList(),
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            });
        }

        // PUT: api/admin/returns/5/approve
        [HttpPut("{id}/approve")]
        public Task<IActionResult> Approve(int id, ReturnActionDto dto) =>
            Decide(id, dto, ReturnStatuses.Approved, "ReturnApproved");

        // PUT: api/admin/returns/5/reject
        [HttpPut("{id}/reject")]
        public Task<IActionResult> Reject(int id, ReturnActionDto dto) =>
            Decide(id, dto, ReturnStatuses.Rejected, "ReturnRejected");

        private async Task<IActionResult> Decide(int id, ReturnActionDto dto, string newStatus, string auditAction)
        {
            var returnRequest = await LoadAsync(id);

            if (returnRequest == null)
            {
                return NotFound(new { message = "Return request not found" });
            }

            if (returnRequest.Status != ReturnStatuses.Requested)
            {
                return BadRequest(new { message = $"This return is already {returnRequest.Status}." });
            }

            returnRequest.Status = newStatus;
            returnRequest.AdminNote = NormalizeNote(dto.AdminNote);
            if (newStatus == ReturnStatuses.Rejected)
            {
                returnRequest.ResolvedAt = DateTime.UtcNow;
            }

            _auditLogService.Log(GetCurrentAdminId(), auditAction, "ReturnRequest", returnRequest.ReturnRequestId,
                $"Order #{returnRequest.OrderId}");

            await _context.SaveChangesAsync();

            await ReturnMapper.NotifyCustomerAsync(returnRequest, returnRequest.Order, _emailService, _notificationService, _logger);
            await _notificationService.BroadcastAdminChangeAsync("return", returnRequest.ReturnRequestId, newStatus.ToLowerInvariant());

            return Ok(ReturnMapper.ToDto(returnRequest));
        }

        // PUT: api/admin/returns/5/refund   (body: { adminNote?, restock })
        [HttpPut("{id}/refund")]
        public async Task<IActionResult> Refund(int id, ReturnActionDto dto)
        {
            var returnRequest = await LoadAsync(id);

            if (returnRequest == null)
            {
                return NotFound(new { message = "Return request not found" });
            }

            if (returnRequest.Status != ReturnStatuses.Approved)
            {
                return BadRequest(new { message = "Only approved returns can be refunded." });
            }

            var order = returnRequest.Order;

            if (order.PaymentStatus != PaymentStatuses.Paid)
            {
                return BadRequest(new { message = $"This order's payment is {order.PaymentStatus}, so there is nothing to refund." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            // Set once the money has gone back, so a later failure is reported as such.
            string? refundedTransactionId = null;

            try
            {
                // Claim the refund atomically so two admins (or a double-click)
                // can't both refund and restock the same return; the loser's
                // UPDATE finds it no longer Approved. Rolled back if the refund fails.
                var claimed = await _context.ReturnRequests
                    .Where(r => r.ReturnRequestId == returnRequest.ReturnRequestId && r.Status == ReturnStatuses.Approved)
                    .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, ReturnStatuses.Refunded));

                if (claimed == 0)
                {
                    await transaction.RollbackAsync();
                    return Conflict(new { message = "This return was just updated by someone else. Refresh and try again." });
                }

                // Card: refund through Braintree before committing, so the return is
                // never marked refunded without the money actually going back.
                if (order.PaymentMethod == PaymentMethods.Card && order.PaymentTransactionId != null)
                {
                    var refund = await _paymentService.RefundAsync(order.PaymentTransactionId);

                    if (!refund.Success)
                    {
                        await transaction.RollbackAsync();
                        return StatusCode(502, new { message = refund.ErrorMessage });
                    }

                    refundedTransactionId = order.PaymentTransactionId;
                }

                if (dto.Restock)
                {
                    foreach (var item in order.OrderItems)
                    {
                        await _context.Products.RestoreAsync(item.ProductId, item.Quantity);
                        await _context.Entry(item.Product).ReloadAsync();
                    }
                }

                order.PaymentStatus = PaymentStatuses.Refunded;

                returnRequest.Status = ReturnStatuses.Refunded;
                returnRequest.Restocked = dto.Restock;
                returnRequest.ResolvedAt = DateTime.UtcNow;
                if (!string.IsNullOrWhiteSpace(dto.AdminNote))
                {
                    returnRequest.AdminNote = NormalizeNote(dto.AdminNote);
                }

                _auditLogService.Log(GetCurrentAdminId(), "ReturnRefunded", "ReturnRequest", returnRequest.ReturnRequestId,
                    $"Order #{order.OrderId}, {PaymentLabels.Method(order.PaymentMethod)}, {(dto.Restock ? "restocked" : "not restocked")}");

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();

                if (refundedTransactionId != null)
                {
                    // Refunded at the gateway, but the return still shows Approved.
                    // Retrying is safe: RefundAsync won't repay an existing refund.
                    _logger.LogCritical(ex, "Refund {TransactionId} issued for return {ReturnRequestId} but saving it failed",
                        refundedTransactionId, id);
                    return StatusCode(500, new
                    {
                        message = $"The payment was refunded (reference {refundedTransactionId}) but the return couldn't be updated. Retry the refund - it won't refund twice."
                    });
                }

                _logger.LogError(ex, "Refund failed for return {ReturnRequestId}", id);
                return StatusCode(500, new { message = "The refund could not be completed. Please try again." });
            }

            await ReturnMapper.NotifyCustomerAsync(returnRequest, order, _emailService, _notificationService, _logger);
            await _notificationService.BroadcastAdminChangeAsync("return", returnRequest.ReturnRequestId, "refunded");
            await _notificationService.BroadcastAdminChangeAsync("order", order.OrderId, "refunded");
            if (dto.Restock)
            {
                await _notificationService.BroadcastStockAsync(order.OrderItems.Select(i => i.Product));
            }

            return Ok(ReturnMapper.ToDto(returnRequest));
        }

        private Task<ReturnRequest?> LoadAsync(int id) =>
            _context.ReturnRequests
                .Include(r => r.Order).ThenInclude(o => o.User)
                .Include(r => r.Order).ThenInclude(o => o.OrderItems).ThenInclude(oi => oi.Product)
                .FirstOrDefaultAsync(r => r.ReturnRequestId == id);

        private static string? NormalizeNote(string? note) =>
            string.IsNullOrWhiteSpace(note) ? null : note.Trim();

        private int GetCurrentAdminId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }

        // GET: api/admin/returns/export?status=
        // Same status filter as the Returns page. Times are UTC, as stored.
        [HttpGet("export")]
        public async Task<IActionResult> ExportReturns([FromServices] CsvExportService csv, string? status = null, string? search = null)
        {
            var query = ApplyFilters(
                _context.ReturnRequests.AsNoTracking().Include(r => r.Order).ThenInclude(o => o.User),
                search, status);

            var returns = await query.OrderByDescending(r => r.CreatedAt).ToListAsync();

            var file = csv.BuildCsv(
                new[]
                {
                    "ReturnId", "OrderId", "Customer", "CustomerEmail", "Reason", "Details", "Status", "AdminNote",
                    "OrderTotal", "PaymentMethod", "Restocked", "Requested (UTC)", "Resolved (UTC)"
                },
                returns.Select(r => new object?[]
                {
                    r.ReturnRequestId, r.OrderId, r.Order.User.Name, r.Order.User.Email,
                    ReturnReasons.Label(r.Reason), r.Details ?? "", r.Status, r.AdminNote ?? "",
                    r.Order.TotalAmount, PaymentLabels.Method(r.Order.PaymentMethod), r.Restocked, r.CreatedAt, r.ResolvedAt
                }));

            return File(file, "text/csv", status is { Length: > 0 } ? $"returns-{status.ToLowerInvariant()}.csv" : "returns-export.csv");
        }

        // Shared by the Returns list and its export. Search matches the order
        // number ("93" or "#93"), customer name or customer email.
        private static IQueryable<ReturnRequest> ApplyFilters(IQueryable<ReturnRequest> query, string? search, string? status)
        {
            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(r => r.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().TrimStart('#');
                if (int.TryParse(term, out var orderId))
                {
                    query = query.Where(r => r.OrderId == orderId || r.Order.User.Name.Contains(term));
                }
                else
                {
                    query = query.Where(r => r.Order.User.Name.Contains(term) || r.Order.User.Email.Contains(term));
                }
            }

            return query;
        }
    }
}
