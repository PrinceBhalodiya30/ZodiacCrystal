using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.Models;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    public class GuestStartDto
    {
        [Required]
        [EmailAddress]
        [StringLength(256)]
        public string Email { get; set; } = null!;
    }

    public class GuestVerifyDto
    {
        [Required]
        [EmailAddress]
        [StringLength(256)]
        public string Email { get; set; } = null!;

        [Required]
        [RegularExpression("^[0-9]{6}$", ErrorMessage = "Enter the 6-digit code.")]
        public string Otp { get; set; } = null!;

        [Required]
        [StringLength(100, MinimumLength = 2)]
        public string Name { get; set; } = null!;
    }

    public class OrderAccessDto
    {
        [Required]
        [StringLength(100)]
        public string Token { get; set; } = null!;
    }

    public class FindOrderDto
    {
        [Range(1, int.MaxValue)]
        public int OrderId { get; set; }

        [Required]
        [EmailAddress]
        [StringLength(256)]
        public string Email { get; set; } = null!;
    }

    // Guest checkout: prove you own an email with a one-time code, get a short
    // guest session (Role "Guest", see GuestAccessMiddleware) that may only call
    // the [AllowGuest] checkout endpoints. The session belongs to a hidden Guest
    // user row per email, so orders keep their normal UserId and ownership checks.
    [Route("api/guest")]
    [ApiController]
    [AllowAnonymous]
    public class GuestCheckoutController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly GuestCheckoutOtpService _otpService;
        private readonly IEmailService _emailService;
        private readonly TokenService _tokenService;
        private readonly OrderAccessService _orderAccess;
        private readonly PasswordHasher<User> _passwordHasher = new();
        private readonly ILogger<GuestCheckoutController> _logger;

        public GuestCheckoutController(
            CrystalsDbContext context,
            GuestCheckoutOtpService otpService,
            IEmailService emailService,
            TokenService tokenService,
            OrderAccessService orderAccess,
            ILogger<GuestCheckoutController> logger)
        {
            _context = context;
            _otpService = otpService;
            _emailService = emailService;
            _tokenService = tokenService;
            _orderAccess = orderAccess;
            _logger = logger;
        }

        // POST: api/guest/order-access   { token }
        // Opens a "View your order" link. Guest orders -> a guest session for
        // that guest account. If the email has since become a real account, the
        // link only says which order it is: the owner logs in to see it.
        [HttpPost("order-access")]
        [EnableRateLimiting(RateLimitPolicies.AuthAttempts)]
        public async Task<IActionResult> OpenOrderLink(OrderAccessDto dto)
        {
            var order = await _orderAccess.RedeemAsync(dto.Token);

            if (order == null)
            {
                return BadRequest(new { message = "This link has expired or is no longer valid. Use \"Find my order\" to get a new one." });
            }

            var user = order.User;

            if (user.Role != UserRoles.Guest)
            {
                return Ok(new { requiresLogin = true, orderId = order.OrderId });
            }

            if (!user.IsActive || user.IsDeleted)
            {
                return BadRequest(new { message = "This order can't be opened online. Please contact support." });
            }

            var token = _tokenService.GenerateToken(user, GuestCheckoutOtpService.SessionLifetime);

            return Ok(new
            {
                requiresLogin = false,
                orderId = order.OrderId,
                token,
                email = user.Email,
                name = user.Name,
                expiresInSeconds = (int)GuestCheckoutOtpService.SessionLifetime.TotalSeconds
            });
        }

        // POST: api/guest/find-order   { orderId, email }
        // Lost the email? If the order number and email match, a fresh link (or,
        // for account holders, a "log in to view" note) is emailed to that
        // address. The answer never says whether they matched.
        [HttpPost("find-order")]
        [EnableRateLimiting(RateLimitPolicies.EmailSend)]
        public async Task<IActionResult> FindOrder(FindOrderDto dto)
        {
            var email = dto.Email.Trim().ToLower();

            var order = await _context.Orders
                .Include(o => o.User)
                .FirstOrDefaultAsync(o => o.OrderId == dto.OrderId && o.User.Email.ToLower() == email);

            if (order != null && order.User.IsActive && !order.User.IsDeleted)
            {
                try
                {
                    var url = order.User.Role == UserRoles.Guest ? await _orderAccess.CreateLinkAsync(order.OrderId) : null;
                    await _emailService.SendOrderLookupAsync(order.User.Email, order.User.Name, order.OrderId, url);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Order lookup email failed for order {OrderId}", order.OrderId);
                }
            }

            return Ok(new { message = "If that order number matches the email, we've sent a link to view it. Please check your inbox." });
        }

        // POST: api/guest/start   { email }
        // Emails a 6-digit code. Same answer whether or not the email has an
        // account, so this can't be used to discover registered emails.
        [HttpPost("start")]
        [EnableRateLimiting(RateLimitPolicies.EmailSend)]
        public async Task<IActionResult> Start(GuestStartDto dto)
        {
            var email = dto.Email.Trim();

            var wait = _otpService.GetResendWait(email);
            if (wait != null)
            {
                var seconds = (int)Math.Ceiling(wait.Value.TotalSeconds);
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"Please wait {seconds} seconds before requesting a new code.",
                    retryAfterSeconds = seconds
                });
            }

            var otp = _otpService.Create(email);

            try
            {
                await _emailService.SendGuestCheckoutCodeAsync(email, otp, GuestCheckoutOtpService.OtpLifetime);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send guest checkout code");
                _otpService.Remove(email);
                return StatusCode(500, new { message = "We couldn't send the verification code. Please try again." });
            }

            return Ok(new
            {
                message = "We've sent a 6-digit code to your email.",
                email,
                expiresInSeconds = (int)GuestCheckoutOtpService.OtpLifetime.TotalSeconds,
                resendAfterSeconds = (int)GuestCheckoutOtpService.ResendCooldown.TotalSeconds
            });
        }

        // POST: api/guest/verify   { email, otp, name }
        // Correct code -> guest session token. If the email turns out to belong
        // to a real account, says so (only now that ownership is proven) and
        // asks the shopper to log in instead.
        [HttpPost("verify")]
        [EnableRateLimiting(RateLimitPolicies.AuthAttempts)]
        public async Task<IActionResult> Verify(GuestVerifyDto dto)
        {
            var email = dto.Email.Trim();

            switch (_otpService.Verify(email, dto.Otp))
            {
                case GuestCheckoutOtpService.VerifyResult.NotFound:
                    return BadRequest(new { message = "This code has expired. Please request a new one." });
                case GuestCheckoutOtpService.VerifyResult.TooManyAttempts:
                    return BadRequest(new { message = "Too many incorrect attempts. Please request a new code." });
                case GuestCheckoutOtpService.VerifyResult.Invalid:
                    var remaining = _otpService.RemainingAttempts(email);
                    return BadRequest(new { message = $"Incorrect code. {remaining} attempt{(remaining == 1 ? "" : "s")} left." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());

            if (user != null && user.Role != UserRoles.Guest)
            {
                return Conflict(new
                {
                    accountExists = true,
                    message = "You already have a Crystal Studio account with this email. Please log in to check out - use \"Forgot password?\" if you need to reset it."
                });
            }

            if (user != null && (!user.IsActive || user.IsDeleted))
            {
                return BadRequest(new { message = "This email can't be used for checkout. Please contact support." });
            }

            if (user == null)
            {
                user = new User
                {
                    Name = dto.Name.Trim(),
                    Email = email,
                    Role = UserRoles.Guest,
                    IsActive = true
                };
                // Random password nobody knows; login also refuses Guest rows.
                user.PasswordHash = _passwordHasher.HashPassword(user, Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)));
                _context.Users.Add(user);

                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException)
                {
                    // Two verifies racing for a new email: the other one created the row.
                    _context.Entry(user).State = EntityState.Detached;
                    user = await _context.Users.FirstAsync(u => u.Email.ToLower() == email.ToLower());
                    if (user.Role != UserRoles.Guest)
                    {
                        return Conflict(new { accountExists = true, message = "You already have an account with this email. Please log in to check out." });
                    }
                }
            }
            else if (user.Name != dto.Name.Trim())
            {
                user.Name = dto.Name.Trim();
                await _context.SaveChangesAsync();
            }

            var token = _tokenService.GenerateToken(user, GuestCheckoutOtpService.SessionLifetime);
            _logger.LogInformation("Guest checkout session started for user {UserId}", user.UserId);

            return Ok(new
            {
                token,
                email = user.Email,
                name = user.Name,
                expiresInSeconds = (int)GuestCheckoutOtpService.SessionLifetime.TotalSeconds
            });
        }
    }
}
