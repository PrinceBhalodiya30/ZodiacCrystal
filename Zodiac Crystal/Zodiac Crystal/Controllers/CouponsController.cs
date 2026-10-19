using Microsoft.AspNetCore.RateLimiting;
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
    [Route("api/[controller]")]
    [ApiController]
    public class CouponsController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly CouponValidationService _validationService;
        private readonly AuditLogService _auditLogService;
        private readonly CsvExportService _csvExportService;

        public CouponsController(
            CrystalsDbContext context,
            CouponValidationService validationService,
            AuditLogService auditLogService,
            CsvExportService csvExportService)
        {
            _context = context;
            _validationService = validationService;
            _auditLogService = auditLogService;
            _csvExportService = csvExportService;
        }

        // GET: api/coupons/paged?pageNumber=1&pageSize=20&search=
        [Authorize(Roles = "Admin")]
        [HttpGet("paged")]
        public async Task<ActionResult<PagedResult<CouponDto>>> GetCouponsPaged(
            int pageNumber = 1,
            int pageSize = 20,
            string? search = null,
            string? status = null)
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

            var query = ApplyFilters(_context.Coupons.AsQueryable(), search, status);

            var totalCount = await query.CountAsync();
             
            var coupons = await query
                .OrderByDescending(c => c.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new CouponDto 
                {
                    CouponId = c.CouponId,
                    Code = c.Code,
                    Description = c.Description,
                    DiscountType = c.DiscountType,
                    DiscountValue = c.DiscountValue,
                    MinimumOrderAmount = c.MinimumOrderAmount,
                    StartDate = c.StartDate,
                    EndDate = c.EndDate,
                    UsageLimit = c.UsageLimit,
                    UsedCount = c.UsedCount,
                    MaxUsesPerUser = c.MaxUsesPerUser,
                    IsActive = c.IsActive,
                    CreatedAt = c.CreatedAt,
                    NotifiedAt = c.NotifiedAt
                })
                .ToListAsync();

            return Ok(new PagedResult<CouponDto>
            {
                Items = coupons,
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            });
        }

        // GET: api/coupons/1
        [Authorize(Roles = "Admin")]
        [HttpGet("{id}")]
        public async Task<ActionResult<CouponDto>> GetCoupon(int id)
        {
            var coupon = await _context.Coupons
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.CouponId == id);

            if (coupon == null)
            {
                return NotFound(new { message = "Coupon not found" });
            }

            return Ok(MapToDto(coupon));
        }

        // POST: api/coupons
        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<IActionResult> CreateCoupon(CreateCouponDto dto)
        {
            var code = dto.Code.Trim().ToUpperInvariant();

            var validationError = ValidateFields(dto.DiscountType, dto.DiscountValue, dto.StartDate, dto.EndDate);
            if (validationError != null)
            {
                return BadRequest(new { message = validationError });
            }

            var codeExists = await _context.Coupons.AnyAsync(c => c.Code == code);

            if (codeExists)
            {
                return Conflict(new { message = "A coupon with this code already exists" });
            }

            var coupon = new Coupon
            {
                Code = code,
                Description = dto.Description,
                DiscountType = dto.DiscountType,
                DiscountValue = dto.DiscountValue,
                MinimumOrderAmount = dto.MinimumOrderAmount,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                UsageLimit = dto.UsageLimit,
                MaxUsesPerUser = dto.MaxUsesPerUser,
                IsActive = dto.IsActive,
                UsedCount = 0,
                CreatedAt = DateTime.UtcNow
            };

            _context.Coupons.Add(coupon);
            await _context.SaveChangesAsync();

            _auditLogService.Log(GetCurrentUserId(), "CouponCreated", "Coupon", coupon.CouponId, $"Code: {coupon.Code}");
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetCoupon),
                new { id = coupon.CouponId },
                MapToDto(coupon)
            );
        }

        // PUT: api/coupons/1
        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCoupon(int id, UpdateCouponDto dto)
        {
            var coupon = await _context.Coupons.FindAsync(id);

            if (coupon == null)
            {
                return NotFound(new { message = "Coupon not found" });
            }

            var code = dto.Code.Trim().ToUpperInvariant();

            var validationError = ValidateFields(dto.DiscountType, dto.DiscountValue, dto.StartDate, dto.EndDate);
            if (validationError != null)
            {
                return BadRequest(new { message = validationError });
            }

            var codeExists = await _context.Coupons
                .AnyAsync(c => c.Code == code && c.CouponId != id);

            if (codeExists)
            {
                return Conflict(new { message = "A coupon with this code already exists" });
            }

            coupon.Code = code;
            coupon.Description = dto.Description;
            coupon.DiscountType = dto.DiscountType;
            coupon.DiscountValue = dto.DiscountValue;
            coupon.MinimumOrderAmount = dto.MinimumOrderAmount;
            coupon.StartDate = dto.StartDate;
            coupon.EndDate = dto.EndDate;
            coupon.UsageLimit = dto.UsageLimit;
            coupon.MaxUsesPerUser = dto.MaxUsesPerUser;
            coupon.IsActive = dto.IsActive;

            _auditLogService.Log(GetCurrentUserId(), "CouponUpdated", "Coupon", coupon.CouponId, $"Code: {coupon.Code}");

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/coupons/1
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCoupon(int id)
        {
            var coupon = await _context.Coupons.FindAsync(id);

            if (coupon == null)
            {
                return NotFound(new { message = "Coupon not found" });
            }

            if (coupon.UsedCount > 0)
            {
                return BadRequest(new
                {
                    message = "This coupon has been used and cannot be deleted; deactivate it instead."
                });
            }

            _auditLogService.Log(GetCurrentUserId(), "CouponDeleted", "Coupon", coupon.CouponId, $"Code: {coupon.Code}");

            _context.Coupons.Remove(coupon);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/coupons/1/notify
        // Announces the coupon in every customer's notification bell (no email).
        // Only for a coupon that works right now, and only once per coupon.
        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/notify")]
        public async Task<IActionResult> NotifyCustomers(int id, [FromServices] NotificationService notificationService)
        {
            var coupon = await _context.Coupons.FindAsync(id);

            if (coupon == null)
            {
                return NotFound(new { message = "Coupon not found" });
            }

            if (coupon.NotifiedAt != null)
            {
                return Conflict(new { message = "Customers have already been notified about this coupon." });
            }

            var now = DateTime.UtcNow;
            if (!coupon.IsActive || coupon.StartDate > now || coupon.EndDate < now || coupon.UsedCount >= coupon.UsageLimit)
            {
                return BadRequest(new { message = "Only an active coupon can be announced to customers." });
            }

            coupon.NotifiedAt = now;
            await _context.SaveChangesAsync();

            var recipients = await notificationService.NotifyCouponAsync(coupon);

            _auditLogService.Log(GetCurrentUserId(), "CouponNotified", "Coupon", coupon.CouponId, $"Code: {coupon.Code}, Recipients: {recipients}");
            await _context.SaveChangesAsync();

            return Ok(new { recipients, notifiedAt = DateTime.SpecifyKind(now, DateTimeKind.Utc) });
        }

        // GET: api/coupons/active
        // Public listing for checkout - only coupons a shopper could actually
        // apply right now: active, within their date window, and not yet at
        // their usage limit. Excludes admin-only fields (see PublicCouponDto).
        // Anonymous too: the Register page shows the best offer to new visitors.
        // Only public fields are returned, the same list any shopper sees at checkout.
        [HttpGet("active")]
        [AllowAnonymous]
        public async Task<ActionResult<List<PublicCouponDto>>> GetActiveCoupons()
        {
            var now = DateTime.UtcNow;

            var coupons = await _context.Coupons
                .AsNoTracking()
                .Where(c => c.IsActive
                    && c.StartDate <= now
                    && c.EndDate >= now
                    && c.UsedCount < c.UsageLimit)
                .OrderBy(c => c.EndDate)
                .Select(c => new PublicCouponDto
                {
                    Code = c.Code,
                    Description = c.Description,
                    DiscountType = c.DiscountType,
                    DiscountValue = c.DiscountValue,
                    MinimumOrderAmount = c.MinimumOrderAmount,
                    EndDate = c.EndDate
                })
                .ToListAsync();

            return Ok(coupons);
        }

        // POST: api/coupons/validate
        // No role restriction - any signed-in user (including Admin accounts) can
        // check a coupon at checkout. This endpoint is UX-only: it never touches
        // UsedCount. OrdersController.CreateOrder re-runs this same validation
        // logic (via CouponValidationService) inside the order transaction and is
        // the only place that actually increments UsedCount.
        [EnableRateLimiting(RateLimitPolicies.CouponValidate)]
        [HttpPost("validate")]
        [Authorize]
        [AllowGuest]
        public async Task<ActionResult<CouponValidationResultDto>> ValidateCoupon(ValidateCouponDto dto)
        {
            var code = dto.Code.Trim().ToUpperInvariant();

            var coupon = await _context.Coupons.FirstOrDefaultAsync(c => c.Code == code);

            // Preview only - checkout repeats this count under a lock (see CreateOrder).
            var userUses = coupon?.MaxUsesPerUser != null
                ? await CouponValidationService.CountUsesByUserAsync(_context, GetCurrentUserId(), coupon.Code)
                : 0;

            var result = _validationService.Validate(coupon, dto.OrderAmount, userUses);

            return Ok(result);
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }

        private static string? ValidateFields(string discountType, decimal discountValue, DateTime startDate, DateTime endDate)
        {
            if (endDate <= startDate)
            {
                return "EndDate must be after StartDate";
            }

            if (discountValue <= 0)
            {
                return "DiscountValue must be greater than 0";
            }

            if (string.Equals(discountType, "Percentage", StringComparison.OrdinalIgnoreCase) && discountValue > 100)
            {
                return "Percentage discount cannot exceed 100";
            }

            return null;
        }

        private static CouponDto MapToDto(Coupon coupon)
        {
            return new CouponDto
            {
                CouponId = coupon.CouponId,
                Code = coupon.Code,
                Description = coupon.Description,
                DiscountType = coupon.DiscountType,
                DiscountValue = coupon.DiscountValue,
                MinimumOrderAmount = coupon.MinimumOrderAmount,
                StartDate = coupon.StartDate,
                EndDate = coupon.EndDate,
                UsageLimit = coupon.UsageLimit,
                UsedCount = coupon.UsedCount,
                MaxUsesPerUser = coupon.MaxUsesPerUser,
                IsActive = coupon.IsActive,
                CreatedAt = coupon.CreatedAt,
                NotifiedAt = coupon.NotifiedAt
            };
        }

        // GET: api/coupons/export?search=&status=
        // Exports whatever the currently applied search/status filters would
        // show - reuses the exact same ApplyFilters logic as the paged listing
        // endpoint, just without pagination, so the two can never disagree on what matches.
        [Authorize(Roles = "Admin")]
        [HttpGet("export")]
        public async Task<IActionResult> ExportCoupons(string? search = null, string? status = null)
        {
            var coupons = await ApplyFilters(_context.Coupons.AsNoTracking(), search, status)
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            var headers = new[]
            {
                "CouponId", "Code", "Description", "Status", "DiscountType", "DiscountValue", "MinimumOrder",
                "StartDate", "EndDate", "UsageLimit", "Used", "Remaining", "MaxUsesPerUser",
                "Active", "CreatedAt", "NotifiedAt"
            };

            var now = DateTime.UtcNow;
            var rows = coupons.Select(c => new object?[]
            {
                c.CouponId,
                c.Code,
                c.Description ?? "",
                StatusLabel(c, now),
                c.DiscountType,
                c.DiscountValue,
                c.MinimumOrderAmount,
                c.StartDate,
                c.EndDate,
                c.UsageLimit,
                c.UsedCount,
                Math.Max(0, c.UsageLimit - c.UsedCount),
                c.MaxUsesPerUser,
                c.IsActive,
                c.CreatedAt,
                c.NotifiedAt
            });

            var csv = _csvExportService.BuildCsv(headers, rows);

            return File(csv, "text/csv", "coupons-export.csv");
        }

        // Same order of checks as ApplyFilters, and the same labels as the
        // admin Coupons list's status badge.
        private static string StatusLabel(Coupon c, DateTime now)
        {
            if (!c.IsActive) return "Inactive";
            if (now < c.StartDate) return "Scheduled";
            if (now > c.EndDate) return "Expired";
            return c.UsedCount >= c.UsageLimit ? "Used up" : "Active";
        }

        // Shared by the Coupons list and its export. Status uses the same order
        // of checks as CouponValidationService, so "Active" here means a code
        // that would actually work at checkout right now.
        // status: "active" | "scheduled" | "expired" | "usedup" | "inactive".
        private static IQueryable<Coupon> ApplyFilters(IQueryable<Coupon> query, string? search, string? status)
        {
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(c => c.Code.Contains(search));
            }

            var now = DateTime.UtcNow;
            return status?.ToLowerInvariant() switch
            {
                "inactive" => query.Where(c => !c.IsActive),
                "scheduled" => query.Where(c => c.IsActive && now < c.StartDate),
                "expired" => query.Where(c => c.IsActive && now >= c.StartDate && now > c.EndDate),
                "usedup" => query.Where(c => c.IsActive && now >= c.StartDate && now <= c.EndDate && c.UsedCount >= c.UsageLimit),
                "active" => query.Where(c => c.IsActive && now >= c.StartDate && now <= c.EndDate && c.UsedCount < c.UsageLimit),
                _ => query
            };
        }
    }
}
