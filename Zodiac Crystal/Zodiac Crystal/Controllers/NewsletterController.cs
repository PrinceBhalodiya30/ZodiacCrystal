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
            const string welcomeCoupon = "CRYSTAL-010";

            var existing = await _context.NewsletterSubscribers
                .FirstOrDefaultAsync(s => s.Email == email);

            if (existing is { IsActive: true })
            {
                return Ok(new
                {
                    message = "You're already subscribed! Your 10% coupon is still active.",
                    couponCode = welcomeCoupon,
                    discount = "10%"
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
                return Ok(new
                {
                    message = "Welcome back! Use code CRYSTAL-010 for 10% off your next crystal.",
                    couponCode = welcomeCoupon,
                    discount = "10%"
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

            return Ok(new
            {
                message = "Welcome to the Celestial Circle! Use code CRYSTAL-010 for 10% off your order.",
                couponCode = welcomeCoupon,
                discount = "10%"
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
