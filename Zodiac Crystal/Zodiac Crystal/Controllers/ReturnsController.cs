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
    // Customer side of returns: request a return for a delivered, paid order
    // within ReturnPolicy.WindowDays of delivery, and see existing requests.
    // Approval and refunds happen in AdminReturnsController.
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "User")]
    public class ReturnsController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly IEmailService _emailService;
        private readonly NotificationService _notificationService;
        private readonly ILogger<ReturnsController> _logger;

        public ReturnsController(
            CrystalsDbContext context,
            IEmailService emailService,
            NotificationService notificationService,
            ILogger<ReturnsController> logger)
        {
            _context = context;
            _emailService = emailService;
            _notificationService = notificationService;
            _logger = logger;
        }

        // GET: api/returns
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ReturnRequestDto>>> GetMyReturns()
        {
            var userId = GetCurrentUserId();

            var returns = await _context.ReturnRequests
                .AsNoTracking()
                .Include(r => r.Order).ThenInclude(o => o.User)
                .Where(r => r.UserId == userId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            return Ok(returns.Select(ReturnMapper.ToDto));
        }

        // POST: api/returns
        [HttpPost]
        public async Task<ActionResult<ReturnRequestDto>> CreateReturn(CreateReturnRequestDto dto)
        {
            var userId = GetCurrentUserId();

            var order = await _context.Orders
                .Include(o => o.User)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .FirstOrDefaultAsync(o => o.OrderId == dto.OrderId);

            // Same "NotFound, not Forbidden" rule as OrdersController.GetOrder.
            if (order == null || order.UserId != userId)
            {
                return NotFound(new { message = "Order not found" });
            }

            var windowEndsAt = ReturnPolicy.WindowEndsAt(order);

            if (windowEndsAt == null)
            {
                return BadRequest(new { message = "Only delivered, paid orders can be returned." });
            }

            if (DateTime.Now > windowEndsAt.Value)
            {
                return BadRequest(new { message = $"The {ReturnPolicy.WindowDays}-day return window for this order has ended." });
            }

            if (await _context.ReturnRequests.AnyAsync(r => r.OrderId == order.OrderId))
            {
                return BadRequest(new { message = "A return has already been requested for this order." });
            }

            var returnRequest = new ReturnRequest
            {
                OrderId = order.OrderId,
                UserId = userId,
                Reason = dto.Reason,
                Details = string.IsNullOrWhiteSpace(dto.Details) ? null : dto.Details.Trim(),
                Status = ReturnStatuses.Requested
            };

            _context.ReturnRequests.Add(returnRequest);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // The unique OrderId index caught a double submit.
                return BadRequest(new { message = "A return has already been requested for this order." });
            }

            _logger.LogInformation("Return {ReturnRequestId} requested for order {OrderId}", returnRequest.ReturnRequestId, order.OrderId);

            await ReturnMapper.NotifyCustomerAsync(returnRequest, order, _emailService, _notificationService, _logger);
            await _notificationService.BroadcastAdminChangeAsync("return", returnRequest.ReturnRequestId, "requested");

            returnRequest.Order = order;
            return Ok(ReturnMapper.ToDto(returnRequest));
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }
    }

    // Shared by the customer and admin returns controllers.
    internal static class ReturnMapper
    {
        public static ReturnRequestDto ToDto(ReturnRequest r) => new()
        {
            ReturnRequestId = r.ReturnRequestId,
            OrderId = r.OrderId,
            Reason = r.Reason,
            ReasonLabel = ReturnReasons.Label(r.Reason),
            Details = r.Details,
            Status = r.Status,
            AdminNote = r.AdminNote,
            Restocked = r.Restocked,
            CreatedAt = DateTime.SpecifyKind(r.CreatedAt, DateTimeKind.Utc),
            ResolvedAt = r.ResolvedAt == null ? null : DateTime.SpecifyKind(r.ResolvedAt.Value, DateTimeKind.Utc),
            OrderTotal = r.Order.TotalAmount,
            PaymentMethod = r.Order.PaymentMethod,
            PaymentStatus = r.Order.PaymentStatus,
            CustomerName = r.Order.User.Name,
            CustomerEmail = r.Order.User.Email
        };

        // Email + bell notification to the customer. Best effort: never throws,
        // because the return change it describes is already committed.
        public static async Task NotifyCustomerAsync(
            ReturnRequest returnRequest, Order order,
            IEmailService emailService, NotificationService notificationService, ILogger logger)
        {
            try
            {
                await notificationService.NotifyReturnUpdatedAsync(returnRequest);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Return {ReturnRequestId} notification failed", returnRequest.ReturnRequestId);
            }

            try
            {
                await emailService.SendReturnUpdateAsync(returnRequest, order);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Return {ReturnRequestId} email failed", returnRequest.ReturnRequestId);
            }
        }
    }
}
