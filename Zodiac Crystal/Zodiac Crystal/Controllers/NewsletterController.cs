using Microsoft.AspNetCore.RateLimiting;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Models;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/newsletter")]
    [ApiController]
    public class NewsletterController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly NotificationService _notificationService;

        public NewsletterController(CrystalsDbContext context, NotificationService notificationService)
        {
            _context = context;
            _notificationService = notificationService;
        }

        // POST: api/newsletter/subscribe
        [HttpPost("subscribe")]
        [EnableRateLimiting(RateLimitPolicies.EmailSend)]
        public async Task<IActionResult> Subscribe(SubscribeNewsletterDto dto)
        {
            var validation = NewsletterEmailValidator.Validate(dto.Email, dto.Website);
            if (!validation.IsValid)
            {
                return BadRequest(new { message = validation.Reason });
            }

            var email = dto.Email.Trim().ToLowerInvariant();

            // Look up the active welcome coupon dynamically from the database
            var now = DateTime.UtcNow;
            var welcomeCoupon = await _context.Coupons
                .AsNoTracking()
                .Where(c => c.IsActive
                    && c.StartDate <= now
                    && c.EndDate >= now
                    && c.UsedCount < c.UsageLimit
                    && (c.Code == "CRYSTAL-010" || c.Code.StartsWith("WELCOME")))
                .OrderByDescending(c => c.DiscountValue)
                .FirstOrDefaultAsync();

            string? activeCouponCode = welcomeCoupon?.Code;
            string? activeDiscountText = welcomeCoupon != null
                ? (string.Equals(welcomeCoupon.DiscountType, "Percentage", StringComparison.OrdinalIgnoreCase)
                    ? $"{welcomeCoupon.DiscountValue:0}%"
                    : $"₹{welcomeCoupon.DiscountValue:0}")
                : null;

            var existing = await _context.NewsletterSubscribers
                .FirstOrDefaultAsync(s => s.Email == email);

            if (existing is { IsActive: true })
            {
                var msg = activeCouponCode != null
                    ? $"You're already subscribed! Your {activeDiscountText} coupon ({activeCouponCode}) is still active."
                    : "You're already subscribed to the Celestial Circle newsletter.";

                return Ok(new
                {
                    message = msg,
                    couponCode = activeCouponCode,
                    discount = activeDiscountText
                });
            }

            if (existing != null)
            {
                // Someone who unsubscribed earlier is signing up again.
                existing.IsActive = true;
                existing.UnsubscribedAt = null;
                existing.SubscribedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                await _notificationService.BroadcastAdminChangeAsync("subscriber", existing.NewsletterSubscriberId, "resubscribed");

                var msg = activeCouponCode != null
                    ? $"Welcome back! Use code {activeCouponCode} for {activeDiscountText} off your next crystal."
                    : "Welcome back! You are now subscribed to our crystal updates.";

                return Ok(new
                {
                    message = msg,
                    couponCode = activeCouponCode,
                    discount = activeDiscountText
                });
            }

            var subscriber = new NewsletterSubscriber
            {
                Email = email,
                SubscribedAt = DateTime.UtcNow,
                UnsubscribeToken = NewUnsubscribeToken()
            };
            _context.NewsletterSubscribers.Add(subscriber);

            await _context.SaveChangesAsync();

            await _notificationService.BroadcastAdminChangeAsync("subscriber", subscriber.NewsletterSubscriberId, "subscribed");

            var welcomeMessage = activeCouponCode != null
                ? $"Welcome to the Celestial Circle! Use code {activeCouponCode} for {activeDiscountText} off your order."
                : "Welcome to the Celestial Circle! You'll receive our weekly crystal guides and exclusive member offers.";

            return Ok(new
            {
                message = welcomeMessage,
                couponCode = activeCouponCode,
                discount = activeDiscountText
            });
        }

        // POST: api/newsletter/unsubscribe
        // Token-based so nobody can unsubscribe someone else by guessing an email.
        // It's a POST (from a page with a confirm button), not a GET link, so email
        // scanners that pre-open links can't unsubscribe people by accident.
        [HttpPost("unsubscribe")]
        [EnableRateLimiting(RateLimitPolicies.AuthAttempts)]
        public async Task<IActionResult> Unsubscribe(UnsubscribeNewsletterDto dto)
        {
            var token = dto.Token?.Trim() ?? "";
            var subscriber = token.Length == 64
                ? await _context.NewsletterSubscribers.FirstOrDefaultAsync(s => s.UnsubscribeToken == token)
                : null;

            if (subscriber == null)
            {
                return NotFound(new { message = "This unsubscribe link is invalid or has expired." });
            }

            if (subscriber.IsActive)
            {
                subscriber.IsActive = false;
                subscriber.UnsubscribedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                await _notificationService.BroadcastAdminChangeAsync("subscriber", subscriber.NewsletterSubscriberId, "unsubscribed");
            }

            return Ok(new { message = "You've been unsubscribed. You won't receive any more newsletters from us." });
        }

        // 64 hex characters (256 bits) - unguessable.
        internal static string NewUnsubscribeToken() =>
            Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    }
}
