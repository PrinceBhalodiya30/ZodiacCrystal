using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Memory;

namespace Zodiac_Crystal.Services
{
    // Holds a not-yet-verified registration (name, email, already-hashed password)
    // together with a one-time code, until the user proves they own the email.
    // Kept in memory rather than a table: codes are short-lived, and if the API
    // restarts the user simply registers again. Neither the plain-text password
    // nor the plain-text code is ever stored - only their hashes.
    public class RegistrationOtpService
    {
        public static readonly TimeSpan OtpLifetime = TimeSpan.FromMinutes(10);
        public static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);
        public const int MaxAttempts = 5;

        private readonly IMemoryCache _cache;

        public RegistrationOtpService(IMemoryCache cache)
        {
            _cache = cache;
        }

        public class PendingRegistration
        {
            public string Name { get; init; } = null!;
            public string Email { get; init; } = null!;
            public string PasswordHash { get; init; } = null!;
            public byte[] OtpHash { get; init; } = null!;
            public DateTime SentAtUtc { get; init; }
            public int FailedAttempts { get; set; }
            // Set (under the lock) by the one verification that succeeds.
            public bool Consumed { get; set; }
        }

        public enum VerifyResult { Success, NotFound, Invalid, TooManyAttempts }

        // Returns how long the caller must still wait before a new code may be
        // sent to this email, or null if a code can be sent now.
        public TimeSpan? GetResendWait(string email)
        {
            if (_cache.TryGetValue(Key(email), out PendingRegistration? pending) && pending != null)
            {
                var wait = pending.SentAtUtc + ResendCooldown - DateTime.UtcNow;
                if (wait > TimeSpan.Zero)
                {
                    return wait;
                }
            }

            return null;
        }

        // Creates (or replaces) the pending registration and returns the plain
        // code so the caller can email it. Replacing invalidates any older code.
        public string Create(string name, string email, string passwordHash)
        {
            var otp = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

            _cache.Set(Key(email), new PendingRegistration
            {
                Name = name,
                Email = email,
                PasswordHash = passwordHash,
                OtpHash = Hash(otp),
                SentAtUtc = DateTime.UtcNow
            }, OtpLifetime);

            return otp;
        }

        public VerifyResult Verify(string email, string otp, out PendingRegistration? registration)
        {
            registration = null;

            if (!_cache.TryGetValue(Key(email), out PendingRegistration? pending) || pending == null)
            {
                return VerifyResult.NotFound;
            }

            lock (pending)
            {
                // Two simultaneous requests with the right code share this object;
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

                if (!CryptographicOperations.FixedTimeEquals(pending.OtpHash, Hash(otp)))
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

            registration = pending;
            return VerifyResult.Success;
        }

        public int RemainingAttempts(string email)
        {
            return _cache.TryGetValue(Key(email), out PendingRegistration? pending) && pending != null
                ? MaxAttempts - pending.FailedAttempts
                : 0;
        }

        public void Remove(string email) => _cache.Remove(Key(email));

        private static string Key(string email) => $"register-otp:{email.Trim().ToLowerInvariant()}";

        private static byte[] Hash(string otp) => SHA256.HashData(Encoding.UTF8.GetBytes(otp));
    }
}
