using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    // Holds a requested-but-unconfirmed email change for a signed-in user,
    // together with a one-time code sent to the NEW address. The change is only
    // applied once the user proves they own that address. Stored in the
    // database (EmailChangeRequests) so an API restart or a second server
    // doesn't lose it. Only the hash of the code is stored.
    //
    // Also issues and redeems the "this wasn't me" link sent to the OLD address
    // once a change goes through (EmailChangeReverts, hash only).
    //
    // Wrong current-password attempts on the request step are still counted in
    // memory, so a hijacked session can't be used to guess the password indefinitely.
    public class EmailChangeOtpService
    {
        public static readonly TimeSpan OtpLifetime = TimeSpan.FromMinutes(10);
        public static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);
        public const int MaxAttempts = 5;

        public const int MaxPasswordFailures = 5;
        public static readonly TimeSpan PasswordLockout = TimeSpan.FromMinutes(15);

        public static readonly TimeSpan RevertLifetime = TimeSpan.FromDays(7);

        private readonly CrystalsDbContext _context;
        private readonly IMemoryCache _cache;

        public EmailChangeOtpService(CrystalsDbContext context, IMemoryCache cache)
        {
            _context = context;
            _cache = cache;
        }

        private class PasswordFailures
        {
            public int Count { get; set; }
        }

        public enum VerifyResult { Success, NotFound, Invalid, TooManyAttempts }

        // How long the user must still wait before another code may be sent,
        // or null if one can be sent now.
        public async Task<TimeSpan?> GetResendWaitAsync(int userId)
        {
            var sentAt = await _context.EmailChangeRequests
                .Where(r => r.UserId == userId && r.ExpiresAt > DateTime.UtcNow)
                .Select(r => (DateTime?)r.SentAt)
                .FirstOrDefaultAsync();

            var wait = sentAt + ResendCooldown - DateTime.UtcNow;
            return wait > TimeSpan.Zero ? wait : null;
        }

        // Creates (or replaces) the pending change and returns the plain code so
        // the caller can email it. Replacing invalidates any older code.
        public async Task<string> CreateAsync(int userId, string newEmail)
        {
            var otp = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            var now = DateTime.UtcNow;

            var request = await _context.EmailChangeRequests.FindAsync(userId);
            if (request == null)
            {
                request = new EmailChangeRequest { UserId = userId };
                _context.EmailChangeRequests.Add(request);
            }

            request.NewEmail = newEmail;
            request.OtpHash = Hash(otp);
            request.SentAt = now;
            request.ExpiresAt = now + OtpLifetime;
            request.FailedAttempts = 0;

            await _context.SaveChangesAsync();
            return otp;
        }

        public async Task<(VerifyResult Result, string? NewEmail, int RemainingAttempts)> VerifyAsync(int userId, string otp)
        {
            var request = await _context.EmailChangeRequests.AsNoTracking()
                .FirstOrDefaultAsync(r => r.UserId == userId && r.ExpiresAt > DateTime.UtcNow);

            if (request == null)
            {
                return (VerifyResult.NotFound, null, 0);
            }

            if (request.FailedAttempts >= MaxAttempts)
            {
                await RemoveAsync(userId);
                return (VerifyResult.TooManyAttempts, null, 0);
            }

            if (!CryptographicOperations.FixedTimeEquals(request.OtpHash, Hash(otp)))
            {
                // Counted in the database atomically, so parallel guesses can't
                // slip past the attempt limit.
                await _context.EmailChangeRequests
                    .Where(r => r.UserId == userId)
                    .ExecuteUpdateAsync(s => s.SetProperty(r => r.FailedAttempts, r => r.FailedAttempts + 1));

                var failed = request.FailedAttempts + 1;
                if (failed >= MaxAttempts)
                {
                    await RemoveAsync(userId);
                    return (VerifyResult.TooManyAttempts, null, 0);
                }

                return (VerifyResult.Invalid, null, MaxAttempts - failed);
            }

            // Consume the code atomically: of two simultaneous correct submissions,
            // only the one whose delete removes the row goes on to change the email.
            var consumed = await _context.EmailChangeRequests
                .Where(r => r.UserId == userId && r.OtpHash == request.OtpHash)
                .ExecuteDeleteAsync();

            if (consumed == 0)
            {
                return (VerifyResult.NotFound, null, 0);
            }

            return (VerifyResult.Success, request.NewEmail, MaxAttempts - request.FailedAttempts);
        }

        public Task RemoveAsync(int userId) =>
            _context.EmailChangeRequests.Where(r => r.UserId == userId).ExecuteDeleteAsync();

        // Adds a one-time undo link for a change that just went through and returns
        // its plain token. Saved with the caller's SaveChangesAsync, together with
        // the email change itself.
        public string AddRevert(int userId, string oldEmail, string newEmail)
        {
            var token = Base64UrlToken();

            _context.EmailChangeReverts.Add(new EmailChangeRevert
            {
                UserId = userId,
                OldEmail = oldEmail,
                NewEmail = newEmail,
                TokenHash = Hash(token),
                ExpiresAt = DateTime.UtcNow + RevertLifetime
            });

            return token;
        }

        // The unused, unexpired undo link for this token, or null.
        public Task<EmailChangeRevert?> FindRevertAsync(string token)
        {
            var hash = Hash(token);
            return _context.EmailChangeReverts
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.TokenHash == hash && r.UsedAt == null && r.ExpiresAt > DateTime.UtcNow);
        }

        public bool IsPasswordLocked(int userId)
        {
            return _cache.TryGetValue(PasswordKey(userId), out PasswordFailures? failures)
                && failures != null
                && failures.Count >= MaxPasswordFailures;
        }

        public void RecordPasswordFailure(int userId)
        {
            var failures = _cache.GetOrCreate(PasswordKey(userId), entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = PasswordLockout;
                return new PasswordFailures();
            })!;

            lock (failures)
            {
                failures.Count++;
            }
        }

        public void ClearPasswordFailures(int userId) => _cache.Remove(PasswordKey(userId));

        private static string PasswordKey(int userId) => $"email-change-pw-fail:{userId}";

        private static string Base64UrlToken() =>
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        private static byte[] Hash(string value) => SHA256.HashData(Encoding.UTF8.GetBytes(value));
    }
}
