using Microsoft.AspNetCore.RateLimiting;
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
    public class AuthController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly TokenService _tokenService;
        private readonly ILogger<AuthController> _logger;
        private readonly RegistrationOtpService _registrationOtpService;
        private readonly IEmailService _emailService;
        private readonly PasswordResetService _passwordResetService;
        private readonly NotificationService _notificationService;
        private readonly EmailChangeOtpService _emailChangeOtpService;
        private readonly HubConnectionRegistry _hubConnections;
        private readonly LoginAttemptService _loginAttempts;
        private readonly PasswordHasher<User> _passwordHasher = new();

        public AuthController(
            CrystalsDbContext context,
            TokenService tokenService,
            ILogger<AuthController> logger,
            RegistrationOtpService registrationOtpService,
            IEmailService emailService,
            PasswordResetService passwordResetService,
            NotificationService notificationService,
            EmailChangeOtpService emailChangeOtpService,
            HubConnectionRegistry hubConnections,
            LoginAttemptService loginAttempts)
        {
            _hubConnections = hubConnections;
            _loginAttempts = loginAttempts;
            _notificationService = notificationService;
            _emailChangeOtpService = emailChangeOtpService;
            _context = context;
            _tokenService = tokenService;
            _logger = logger;
            _registrationOtpService = registrationOtpService;
            _emailService = emailService;
            _passwordResetService = passwordResetService;
        }

        // Same response whatever happens, so this endpoint can't be used to find
        // out which emails have accounts.
        private const string ForgotPasswordResponse =
            "If an account exists for that email, we've sent a 6-digit code to reset your password.";

        // POST: api/auth/forgot-password
        // Step 1 of 2: emails a reset code to an active account. Always answers
        // with the same message, whether or not the email is registered.
        [HttpPost("forgot-password")]
        [EnableRateLimiting(RateLimitPolicies.EmailSend)]
        public async Task<IActionResult> ForgotPassword(ForgotPasswordDto dto)
        {
            var email = dto.Email.Trim();

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower() && u.IsActive && !u.IsDeleted
                    && u.Role != UserRoles.Guest);

            // Guests have no password to reset - they create one by registering.
            // A repeat request within the cooldown is silently ignored (the
            // earlier code is still valid) rather than sending another email.
            if (user != null && !_passwordResetService.IsInCooldown(email))
            {
                var code = _passwordResetService.Create(email, user.UserId);

                try
                {
                    await _emailService.SendPasswordResetCodeAsync(user.Email, user.Name, code, PasswordResetService.CodeLifetime);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send password reset code for user {UserId}", user.UserId);
                    _passwordResetService.Remove(email);
                }
            }

            return Ok(new
            {
                message = ForgotPasswordResponse,
                expiresInSeconds = (int)PasswordResetService.CodeLifetime.TotalSeconds,
                resendAfterSeconds = (int)PasswordResetService.ResendCooldown.TotalSeconds
            });
        }

        // POST: api/auth/reset-password
        // Step 2 of 2: checks the code and sets the new password, then sends a
        // "password changed" security email.
        [HttpPost("reset-password")]
        [EnableRateLimiting(RateLimitPolicies.AuthAttempts)]
        public async Task<IActionResult> ResetPassword(ResetPasswordDto dto)
        {
            var email = dto.Email.Trim();

            var result = _passwordResetService.Verify(email, dto.Code, out var userId);

            if (result == PasswordResetService.VerifyResult.TooManyAttempts)
            {
                return BadRequest(new { message = "Too many incorrect attempts. Please request a new code." });
            }

            if (result != PasswordResetService.VerifyResult.Success)
            {
                return BadRequest(new { message = "That code is incorrect or has expired." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId && u.IsActive && !u.IsDeleted
                && u.Role != UserRoles.Guest);

            if (user == null)
            {
                _passwordResetService.Remove(email);
                return BadRequest(new { message = "That code is incorrect or has expired." });
            }

            user.PasswordHash = _passwordHasher.HashPassword(user, dto.NewPassword);
            // Whoever had the old password may still hold a token - sign out everywhere.
            user.SessionVersion++;
            await _context.SaveChangesAsync();
            _hubConnections.DisconnectUser(user.UserId);

            _passwordResetService.Remove(email);
            _logger.LogInformation("Password reset completed for user {UserId}", user.UserId);

            try
            {
                await _emailService.SendPasswordChangedAsync(user.Email, user.Name, viaReset: true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Password reset for user {UserId} succeeded but the security email failed", user.UserId);
            }

            return Ok(new { message = "Your password has been reset. You can now log in with your new password." });
        }

        // POST: api/auth/revert-email-change   (body: { token })
        // The "this wasn't me" link from the email-changed notice sent to the OLD
        // address. Puts that address back, signs out every device, and replaces
        // the password with a random one - whoever made the change knew it - so
        // the owner sets a new one via Forgot password on the restored address.
        [HttpPost("revert-email-change")]
        [EnableRateLimiting(RateLimitPolicies.AuthAttempts)]
        public async Task<IActionResult> RevertEmailChange(RevertEmailChangeDto dto)
        {
            var revert = await _emailChangeOtpService.FindRevertAsync(dto.Token.Trim());

            if (revert == null || revert.User.IsDeleted)
            {
                return BadRequest(new { message = "This link is invalid, has expired or has already been used." });
            }

            var user = revert.User;

            // The old address was freed by the change; refuse if someone has since taken it.
            var emailTaken = await _context.Users
                .AnyAsync(u => u.Email.ToLower() == revert.OldEmail.ToLower() && u.UserId != user.UserId);

            if (emailTaken)
            {
                return BadRequest(new
                {
                    message = "We couldn't restore this address automatically. Please contact support@crystalstudio.com and we'll secure your account."
                });
            }

            var now = DateTime.UtcNow;

            user.Email = revert.OldEmail;
            user.SessionVersion++;
            user.PasswordHash = _passwordHasher.HashPassword(user, Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)));

            // This link and any other outstanding ones for the account are spent.
            await _context.EmailChangeReverts
                .Where(r => r.UserId == user.UserId && r.UsedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.UsedAt, now));

            await _context.SaveChangesAsync();

            _hubConnections.DisconnectUser(user.UserId);

            // Any change the intruder still has pending is dropped too.
            await _emailChangeOtpService.RemoveAsync(user.UserId);

            _logger.LogWarning("Email change reverted for user {UserId} via the old-address link", user.UserId);

            return Ok(new
            {
                message = "Your email has been restored and everyone has been signed out. Please set a new password to sign back in.",
                email = user.Email
            });
        }

        // POST: api/auth/register
        // Step 1 of 2: validates the details and emails a one-time code. No account
        // is created until the code is confirmed via POST api/auth/register/verify.
        // Calling this again for the same email (after the cooldown) resends a new
        // code and invalidates the previous one.
        [HttpPost("register")]
        [EnableRateLimiting(RateLimitPolicies.EmailSend)]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            var email = dto.Email.Trim();

            var wait = _registrationOtpService.GetResendWait(email);
            if (wait != null)
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"Please wait {(int)Math.Ceiling(wait.Value.TotalSeconds)} seconds before requesting a new code.",
                    retryAfterSeconds = (int)Math.Ceiling(wait.Value.TotalSeconds)
                });
            }

            var passwordHash = _passwordHasher.HashPassword(new User { Email = email }, dto.Password);
            // Created for existing accounts too, so the resend cooldown behaves the
            // same either way; their code is never sent, and verify re-checks the email.
            var otp = _registrationOtpService.Create(dto.Name, email, passwordHash);

            var existing = await _context.Users
                .Where(u => u.Email.ToLower() == email.ToLower())
                .Select(u => new { u.Name, u.IsDeleted, u.Role })
                .FirstOrDefaultAsync();

            try
            {
                // The response below is identical whether or not the email already
                // has an account, so this endpoint can't be used to find out which
                // emails are registered. The owner gets a notice instead of a code.
                // A guest-checkout email is not an account yet: it gets a code, and
                // verifying it upgrades the guest row (keeping its orders).
                if (existing != null && existing.Role != UserRoles.Guest)
                {
                    if (!existing.IsDeleted)
                    {
                        await _emailService.SendRegistrationAttemptOnExistingAccountAsync(email, existing.Name);
                    }
                }
                else
                {
                    await _emailService.SendRegistrationOtpAsync(email, dto.Name, otp, RegistrationOtpService.OtpLifetime);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send registration verification code");
                _registrationOtpService.Remove(email);

                return StatusCode(500, new
                {
                    message = "We couldn't send the verification code. Please try again."
                });
            }

            return Ok(new
            {
                message = "We've sent a 6-digit verification code to your email.",
                email,
                expiresInSeconds = (int)RegistrationOtpService.OtpLifetime.TotalSeconds,
                resendAfterSeconds = (int)RegistrationOtpService.ResendCooldown.TotalSeconds
            });
        }

        // POST: api/auth/register/verify
        // Step 2 of 2: confirms the emailed code, then creates the account and
        // signs the user in exactly as registration previously did.
        [HttpPost("register/verify")]
        [EnableRateLimiting(RateLimitPolicies.AuthAttempts)]
        public async Task<ActionResult<AuthResponseDto>> VerifyRegistration(VerifyRegistrationOtpDto dto)
        {
            var email = dto.Email.Trim();

            var result = _registrationOtpService.Verify(email, dto.Otp, out var pending);

            switch (result)
            {
                case RegistrationOtpService.VerifyResult.NotFound:
                    return BadRequest(new { message = "This code has expired. Please request a new one." });

                case RegistrationOtpService.VerifyResult.TooManyAttempts:
                    return BadRequest(new { message = "Too many incorrect attempts. Please request a new code." });

                case RegistrationOtpService.VerifyResult.Invalid:
                    var remaining = _registrationOtpService.RemainingAttempts(email);
                    return BadRequest(new
                    {
                        message = $"Incorrect code. {remaining} attempt{(remaining == 1 ? "" : "s")} left."
                    });
            }

            // Re-check in case the same email was registered while the code was pending.
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());

            if (existingUser != null && existingUser.Role != UserRoles.Guest)
            {
                _registrationOtpService.Remove(email);
                return BadRequest(new { message = "This code has expired. Please request a new one." });
            }

            User user;
            if (existingUser != null)
            {
                // Guest checkout email -> full account. Same row, so their guest
                // orders, returns and support requests now appear in My Account.
                // SessionVersion is bumped so any guest-session tokens stop working.
                user = existingUser;
                user.Name = pending!.Name;
                user.PasswordHash = pending.PasswordHash;
                user.Role = UserRoles.User;
                user.IsActive = true;
                user.SessionVersion++;
            }
            else
            {
                user = new User
                {
                    Name = pending!.Name,
                    Email = pending.Email,
                    Role = UserRoles.User,
                    IsActive = true,
                    PasswordHash = pending.PasswordHash
                };
                _context.Users.Add(user);
            }

            await _context.SaveChangesAsync();

            _registrationOtpService.Remove(email);

            await _notificationService.BroadcastAdminChangeAsync("user", user.UserId, "registered");

            // The account is created at this point - a failed welcome must not
            // fail the registration, so each step only logs its error.
            try
            {
                await _notificationService.NotifyWelcomeAsync(user);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "User {UserId} registered but the welcome notification failed", user.UserId);
            }

            try
            {
                await _emailService.SendWelcomeAsync(user.Email, user.Name);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "User {UserId} registered but the welcome email failed", user.UserId);
            }

            var token = _tokenService.GenerateToken(user);

            return Ok(new AuthResponseDto
            {
                Token = token,
                UserId = user.UserId,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                CreatedAt = user.CreatedAt
            });
        }

        // POST: api/auth/login
        [HttpPost("login")]
        [EnableRateLimiting(RateLimitPolicies.AuthAttempts)]
        public async Task<ActionResult<AuthResponseDto>> Login(LoginDto dto)
        {
            // Checked before the password, and for unknown emails too, so the
            // answer is the same whether or not the account exists.
            if (_loginAttempts.IsLocked(dto.Email))
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"Too many failed sign-in attempts for this email. Please try again in {(int)LoginAttemptService.Lockout.TotalMinutes} minutes or reset your password."
                });
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == dto.Email.ToLower());

            // Guest-checkout accounts have no usable password and can't sign in; the
            // answer is the same as for an unknown email.
            if (user == null || !user.IsActive || user.IsDeleted || user.Role == UserRoles.Guest)
            {
                // The attempted email isn't logged: people sometimes type a password into it.
                _logger.LogInformation("Login failed: account not found or inactive");
                _loginAttempts.RecordFailure(dto.Email);

                return Unauthorized(new
                {
                    message = "Invalid email or password"
                });
            }

            var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, dto.Password);

            if (result == PasswordVerificationResult.Failed)
            {
                _logger.LogInformation("Login failed for user {UserId}: invalid credentials", user.UserId);
                _loginAttempts.RecordFailure(dto.Email);

                return Unauthorized(new
                {
                    message = "Invalid email or password"
                });
            }

            _loginAttempts.Clear(dto.Email);
            var token = _tokenService.GenerateToken(user);

            _logger.LogInformation("Login succeeded for user {UserId}", user.UserId);

            return Ok(new AuthResponseDto
            {
                Token = token,
                UserId = user.UserId,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                CreatedAt = user.CreatedAt
            });
        }
    }
}
