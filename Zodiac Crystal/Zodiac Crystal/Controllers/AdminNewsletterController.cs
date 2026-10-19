using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Models;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/Admin/Newsletter-Subscribers")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminNewsletterController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly AuditLogService _auditLogService;
        private readonly NotificationService _notificationService;

        public AdminNewsletterController(CrystalsDbContext context, AuditLogService auditLogService, NotificationService notificationService)
        {
            _context = context;
            _auditLogService = auditLogService;
            _notificationService = notificationService;
        }

        // GET: api/admin/newsletter-subscribers/paged?pageNumber=1&pageSize=20&search=&status=active
        // status: "active" | "unsubscribed" | anything else = all.
        [HttpGet("paged")]
        public async Task<ActionResult<PagedResult<AdminNewsletterSubscriberDto>>> GetSubscribersPaged(
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

            var query = Filter(_context.NewsletterSubscribers.AsNoTracking(), search, status);

            var totalCount = await query.CountAsync();

            var subscribers = await Project(query
                .OrderByDescending(s => s.SubscribedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize))
                .ToListAsync();

            return Ok(new PagedResult<AdminNewsletterSubscriberDto>
            {
                Items = subscribers,
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            });
        }

        // GET: api/admin/newsletter-subscribers/stats
        [HttpGet("stats")]
        public async Task<ActionResult<NewsletterStatsDto>> GetStats()
        {
            var now = DateTime.UtcNow;
            var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var subscribers = _context.NewsletterSubscribers.AsNoTracking();

            return Ok(new NewsletterStatsDto
            {
                Active = await subscribers.CountAsync(s => s.IsActive),
                NewThisMonth = await subscribers.CountAsync(s => s.IsActive && s.SubscribedAt >= monthStart),
                UnsubscribedThisMonth = await subscribers.CountAsync(s => !s.IsActive && s.UnsubscribedAt >= monthStart)
            });
        }

        // PUT: api/admin/newsletter-subscribers/5/unsubscribe
        // For "please take me off your list" requests. Marks the subscriber
        // inactive rather than deleting, so there's a record they opted out.
        [HttpPut("{id}/unsubscribe")]
        public async Task<IActionResult> Unsubscribe(int id)
        {
            var subscriber = await _context.NewsletterSubscribers.FindAsync(id);
            if (subscriber == null)
            {
                return NotFound(new { message = "Subscriber not found." });
            }

            if (!subscriber.IsActive)
            {
                return Ok(new { message = "Already unsubscribed." });
            }

            subscriber.IsActive = false;
            subscriber.UnsubscribedAt = DateTime.UtcNow;
            _auditLogService.Log(GetCurrentAdminId(), "NewsletterUnsubscribed", "NewsletterSubscriber", subscriber.NewsletterSubscriberId, $"Email: {subscriber.Email}");
            await _context.SaveChangesAsync();

            await _notificationService.BroadcastAdminChangeAsync("subscriber", subscriber.NewsletterSubscriberId, "unsubscribed");

            return Ok(new { message = "Subscriber removed from the newsletter." });
        }

        // GET: api/admin/newsletter-subscribers/export?search=&status=active
        // Defaults to active subscribers only - the list that's safe to email.
        // Includes each person's unsubscribe link, ready to use as a merge field
        // in a newsletter tool such as Brevo.
        [HttpGet("export")]
        public async Task<IActionResult> ExportSubscribers(
            [FromServices] CsvExportService csv,
            [FromServices] IOptions<EmailSettings> emailSettings,
            string? search = null,
            string? status = "active")
        {
            var siteUrl = emailSettings.Value.SiteUrl.TrimEnd('/');
            var query = Filter(_context.NewsletterSubscribers.AsNoTracking(), search, status);

            var subscribers = await query
                .OrderByDescending(s => s.SubscribedAt)
                .Select(s => new
                {
                    s.Email,
                    s.IsActive,
                    s.SubscribedAt,
                    s.UnsubscribedAt,
                    s.UnsubscribeToken,
                    IsCustomer = _context.Users.Any(u => u.Email == s.Email && !u.IsDeleted)
                })
                .ToListAsync();

            var file = csv.BuildCsv(
                new[] { "Email", "Status", "SubscribedAt", "UnsubscribedAt", "RegisteredCustomer", "UnsubscribeLink" },
                subscribers.Select(s => new object?[]
                {
                    s.Email,
                    s.IsActive ? "Active" : "Unsubscribed",
                    s.SubscribedAt,
                    s.UnsubscribedAt,
                    s.IsCustomer ? "Yes" : "No",
                    s.IsActive ? $"{siteUrl}/unsubscribe?token={s.UnsubscribeToken}" : ""
                }));

            var label = status?.ToLowerInvariant() is "active" or "unsubscribed" ? status.ToLowerInvariant() : "all";
            return File(file, "text/csv", $"newsletter-subscribers-{label}.csv");
        }

        private static IQueryable<NewsletterSubscriber> Filter(IQueryable<NewsletterSubscriber> query, string? search, string? status)
        {
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(s => s.Email.Contains(search));
            }

            return status?.ToLowerInvariant() switch
            {
                "active" => query.Where(s => s.IsActive),
                "unsubscribed" => query.Where(s => !s.IsActive),
                _ => query
            };
        }

        private IQueryable<AdminNewsletterSubscriberDto> Project(IQueryable<NewsletterSubscriber> query) =>
            query.Select(s => new AdminNewsletterSubscriberDto
            {
                NewsletterSubscriberId = s.NewsletterSubscriberId,
                Email = s.Email,
                SubscribedAt = s.SubscribedAt,
                IsActive = s.IsActive,
                UnsubscribedAt = s.UnsubscribedAt,
                IsCustomer = _context.Users.Any(u => u.Email == s.Email && !u.IsDeleted)
            });

        private int GetCurrentAdminId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }
    }
}
