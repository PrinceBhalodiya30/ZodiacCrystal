using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Hubs;
using Zodiac_Crystal.Models;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly TokenService _tokenService;
        private readonly IEmailService _emailService;
        private readonly EmailChangeOtpService _emailChangeOtpService;
        private readonly ILogger<UsersController> _logger;
        private readonly HubConnectionRegistry _hubConnections;
        private readonly PasswordHasher<User> _passwordHasher = new();

        // Order states that still need the customer (delivery, cancellation, refund).
        private static readonly string[] ActiveOrderStatuses = { "Pending", "Confirmed", "Shipped" };

        public UsersController(
            CrystalsDbContext context,
            TokenService tokenService,
            IEmailService emailService,
            EmailChangeOtpService emailChangeOtpService,
            ILogger<UsersController> logger,
            HubConnectionRegistry hubConnections)
        {
            _hubConnections = hubConnections;
            _context = context;
            _tokenService = tokenService;
            _emailService = emailService;
            _emailChangeOtpService = emailChangeOtpService;
            _logger = logger;
        }

        // PUT: api/users/me
        [HttpPut("me")]
        public async Task<ActionResult<AuthResponseDto>> UpdateProfile(UpdateProfileDto dto)
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users.FindAsync(userId);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Name only - the email changes through the verified flow below.
            user.Name = dto.Name.Trim();

            await _context.SaveChangesAsync();

            return Ok(SessionFor(user));
        }

        // POST: api/users/me/email   (body: { newEmail, currentPassword })
        // Step 1 of 2 of an email change: checks the current password, then
        // emails a one-time code to the NEW address. Nothing changes yet.
        [HttpPost("me/email")]
        public async Task<IActionResult> RequestEmailChange(RequestEmailChangeDto dto)
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId && !u.IsDeleted);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            if (_emailChangeOtpService.IsPasswordLocked(userId))
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"Too many incorrect password attempts. Please try again in {(int)EmailChangeOtpService.PasswordLockout.TotalMinutes} minutes."
                });
            }

            var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, dto.CurrentPassword);

            if (verifyResult == PasswordVerificationResult.Failed)
            {
                _emailChangeOtpService.RecordPasswordFailure(userId);
                return BadRequest(new { message = "Current password is incorrect" });
            }

            _emailChangeOtpService.ClearPasswordFailures(userId);

            var newEmail = dto.NewEmail.Trim();

            if (string.Equals(newEmail, user.Email, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "That's already your email address." });
            }

            var emailExists = await _context.Users
                .AnyAsync(u => u.Email.ToLower() == newEmail.ToLower() && u.UserId != userId);

            if (emailExists)
            {
                return BadRequest(new { message = "An account with this email already exists" });
            }

            var wait = await _emailChangeOtpService.GetResendWaitAsync(userId);
            if (wait != null)
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"Please wait {(int)Math.Ceiling(wait.Value.TotalSeconds)} seconds before requesting a new code.",
                    retryAfterSeconds = (int)Math.Ceiling(wait.Value.TotalSeconds)
                });
            }

            var otp = await _emailChangeOtpService.CreateAsync(userId, newEmail);

            try
            {
                await _emailService.SendEmailChangeCodeAsync(newEmail, user.Name, otp, EmailChangeOtpService.OtpLifetime);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email-change code for user {UserId}", userId);
                await _emailChangeOtpService.RemoveAsync(userId);

                return StatusCode(500, new
                {
                    message = "We couldn't send the verification code. Please try again."
                });
            }

            return Ok(new
            {
                message = "We've sent a 6-digit code to your new email.",
                newEmail,
                expiresInSeconds = (int)EmailChangeOtpService.OtpLifetime.TotalSeconds,
                resendAfterSeconds = (int)EmailChangeOtpService.ResendCooldown.TotalSeconds
            });
        }

        // POST: api/users/me/email/verify   (body: { otp })
        // Step 2 of 2: confirms the code sent to the new address, switches the
        // account over, and sends a security notice to the OLD address.
        [HttpPost("me/email/verify")]
        public async Task<ActionResult<AuthResponseDto>> VerifyEmailChange(VerifyEmailChangeDto dto)
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId && !u.IsDeleted);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var (result, pendingEmail, remaining) = await _emailChangeOtpService.VerifyAsync(userId, dto.Otp);

            switch (result)
            {
                case EmailChangeOtpService.VerifyResult.NotFound:
                    return BadRequest(new { message = "This code has expired. Please request a new one." });

                case EmailChangeOtpService.VerifyResult.TooManyAttempts:
                    return BadRequest(new { message = "Too many incorrect attempts. Please request a new code." });

                case EmailChangeOtpService.VerifyResult.Invalid:
                    return BadRequest(new
                    {
                        message = $"Incorrect code. {remaining} attempt{(remaining == 1 ? "" : "s")} left."
                    });
            }

            var newEmail = pendingEmail!;

            // Re-check in case someone registered this address while the code was pending.
            var emailExists = await _context.Users
                .AnyAsync(u => u.Email.ToLower() == newEmail.ToLower() && u.UserId != userId);

            if (emailExists)
            {
                await _emailChangeOtpService.RemoveAsync(userId);
                return BadRequest(new { message = "An account with this email already exists" });
            }

            var oldEmail = user.Email;
            user.Email = newEmail;

            // Signs out every other device; this one gets a fresh token below.
            user.SessionVersion++;

            var revertToken = _emailChangeOtpService.AddRevert(userId, oldEmail, newEmail);

            await _context.SaveChangesAsync();

            await _emailChangeOtpService.RemoveAsync(userId);
            _hubConnections.DisconnectUser(userId);

            // Security notice to the old address, with a one-time link to undo the
            // change if it wasn't them.
            try
            {
                await _emailService.SendEmailChangedAsync(oldEmail, user.Name, newEmail, revertToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Email changed for user {UserId} but the notice to the old address failed", userId);
            }

            return Ok(SessionFor(user));
        }

        // The JWT carries the name/email, so profile changes hand back a fresh one
        // rather than making the user log out and back in to see the change.
        private AuthResponseDto SessionFor(User user)
        {
            return new AuthResponseDto
            {
                Token = _tokenService.GenerateToken(user),
                UserId = user.UserId,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                CreatedAt = user.CreatedAt
            };
        }

        // PUT: api/users/me/password
        // Signs out every other device; this one gets a fresh token back.
        [HttpPut("me/password")]
        public async Task<ActionResult<AuthResponseDto>> ChangePassword(ChangePasswordDto dto)
        {
            var user = await _context.Users.FindAsync(GetCurrentUserId());

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, dto.CurrentPassword);

            if (verifyResult == PasswordVerificationResult.Failed)
            {
                return BadRequest(new { message = "Current password is incorrect" });
            }

            user.PasswordHash = _passwordHasher.HashPassword(user, dto.NewPassword);
            user.SessionVersion++;

            await _context.SaveChangesAsync();
            _hubConnections.DisconnectUser(user.UserId);

            // Security notice - lets the owner react if someone else changed it.
            try
            {
                await _emailService.SendPasswordChangedAsync(user.Email, user.Name, viaReset: false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Password changed for user {UserId} but the security email failed", user.UserId);
            }

            return Ok(SessionFor(user));
        }

        // DELETE: api/users/me   (body: { password })
        // Customer self-service account deletion. The user row is kept (orders,
        // reviews and payments reference it and are needed for accounting), but it
        // is anonymised so no personal details or login remain, and the email is
        // freed so it can be used to register again. Personal data that only
        // matters to the customer - addresses, wishlist, notifications, newsletter
        // subscription - is removed.
        [HttpDelete("me")]
        public async Task<IActionResult> DeleteAccount(DeleteAccountDto dto)
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId && !u.IsDeleted);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            if (user.Role == "Admin")
            {
                return BadRequest(new { message = "Admin accounts can't be deleted from the profile page." });
            }

            if (_passwordHasher.VerifyHashedPassword(user, user.PasswordHash, dto.Password) == PasswordVerificationResult.Failed)
            {
                return BadRequest(new { message = "Password is incorrect." });
            }

            var hasActiveOrders = await _context.Orders
                .AnyAsync(o => o.UserId == userId && ActiveOrderStatuses.Contains(o.Status));

            if (hasActiveOrders)
            {
                return BadRequest(new { message = "You have orders that are still in progress. Please wait until they're delivered, or cancel them, before deleting your account." });
            }

            var hasOpenReturns = await _context.ReturnRequests
                .AnyAsync(r => r.UserId == userId && ReturnStatuses.Open.Contains(r.Status));

            if (hasOpenReturns)
            {
                return BadRequest(new { message = "You have a return that's still being processed. Please wait until it's completed before deleting your account." });
            }

            var originalEmail = user.Email;
            var originalName = user.Name;

            await using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                await _context.Addresses.Where(a => a.UserId == userId).ExecuteDeleteAsync();
                await _context.Wishlists.Where(w => w.UserId == userId).ExecuteDeleteAsync();
                await _context.RecentlyViewed.Where(r => r.UserId == userId).ExecuteDeleteAsync();
                await _context.Notifications.Where(n => n.UserId == userId).ExecuteDeleteAsync();
                await _context.NewsletterSubscribers
                    .Where(s => s.Email.ToLower() == originalEmail.ToLower())
                    .ExecuteDeleteAsync();

                user.Name = "Deleted user";
                user.Email = $"deleted-user-{user.UserId}@deleted.invalid";
                // Not a valid password hash, so this account can never be logged into.
                user.PasswordHash = "!deleted!";
                user.IsActive = false;
                user.IsDeleted = true;
                user.DeletedAt = DateTime.UtcNow;
                user.SessionVersion++;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }

            _hubConnections.DisconnectUser(userId);

            _logger.LogInformation("User {UserId} deleted their account", userId);

            try
            {
                await _emailService.SendAccountDeletedAsync(originalEmail, originalName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Account {UserId} deleted but the confirmation email failed", userId);
            }

            return NoContent();
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }
    }
}
