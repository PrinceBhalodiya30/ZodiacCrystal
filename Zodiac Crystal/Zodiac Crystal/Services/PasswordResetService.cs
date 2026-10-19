using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Memory;

namespace Zodiac_Crystal.Services
{
    // One-time codes for "forgot password", kept in memory like the registration
    // codes (RegistrationOtpService): short-lived, only a hash of the code is
    // stored, and too many wrong guesses invalidate it.
    public class PasswordResetService
    {
        public static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(10);
        public static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);
        public const int MaxAttempts = 5;

        private readonly IMemoryCache _cache;

        public PasswordResetService(IMemoryCache cache)
        {
            _cache = cache;
        }

        private class PendingReset
        {
            public int UserId { get; init; }
            public byte[] CodeHash { get; init; } = null!;
            public DateTime SentAtUtc { get; init; }
            public int FailedAttempts { get; set; }
            // Set (under the lock) by the one verification that succeeds.
            public bool Consumed { get; set; }
        }

        public enum VerifyResult { Success, NotFound, Invalid, TooManyAttempts }

        public bool IsInCooldown(string email) =>
            _cache.TryGetValue(Key(email), out PendingReset? pending) && pending != null &&
            pending.SentAtUtc + ResendCooldown > DateTime.UtcNow;

        // Creates (or replaces) the reset code for this account and returns the
        // plain code so the caller can email it.
        public string Create(string email, int userId)
        {
            var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

            _cache.Set(Key(email), new PendingReset
            {
                UserId = userId,
                CodeHash = Hash(code),
                SentAtUtc = DateTime.UtcNow
            }, CodeLifetime);

            return code;
        }

        public VerifyResult Verify(string email, string code, out int userId)
        {
            userId = 0;

            if (!_cache.TryGetValue(Key(email), out PendingReset? pending) || pending == null)
            {
                return VerifyResult.NotFound;
            }

            lock (pending)
            {
                // Two simultaneous resets with the right code share this object;
                // only the first may use it.
                if (pending.Consumed)
                {
                    return VerifyResult.NotFound;
                }

                if (pending.FailedAttempts >= MaxAttempts)
                {
                    Remove(email);
                    return VerifyResult.TooManyAttempts;
                }

                if (!CryptographicOperations.FixedTimeEquals(pending.CodeHash, Hash(code)))
                {
                    pending.FailedAttempts++;

                    if (pending.FailedAttempts >= MaxAttempts)
                    {
                        Remove(email);
                        return VerifyResult.TooManyAttempts;
                    }

                    return VerifyResult.Invalid;
                }

                pending.Consumed = true;
                Remove(email);
            }

            userId = pending.UserId;
            return VerifyResult.Success;
        }

        public void Remove(string email) => _cache.Remove(Key(email));

        private static string Key(string email) => $"password-reset:{email.Trim().ToLowerInvariant()}";

        private static byte[] Hash(string code) => SHA256.HashData(Encoding.UTF8.GetBytes(code));
    }
}
