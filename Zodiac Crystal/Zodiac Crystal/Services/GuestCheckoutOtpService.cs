using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Memory;

namespace Zodiac_Crystal.Services
{
    // One-time codes proving a guest owns the email they check out with. Same
    // rules as RegistrationOtpService (10-minute code, 60-second resend
    // cooldown, 5 attempts, only hashes kept in memory) under its own keys, so
    // a registration in progress for the same email isn't disturbed.
    public class GuestCheckoutOtpService
    {
        public static readonly TimeSpan OtpLifetime = RegistrationOtpService.OtpLifetime;
        public static readonly TimeSpan ResendCooldown = RegistrationOtpService.ResendCooldown;
        public const int MaxAttempts = RegistrationOtpService.MaxAttempts;

        // How long a verified guest session lasts - enough to finish checkout.
        public static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(2);

        private readonly IMemoryCache _cache;

        public GuestCheckoutOtpService(IMemoryCache cache)
        {
            _cache = cache;
        }

        private sealed class Pending
        {
            public byte[] OtpHash { get; init; } = null!;
            public DateTime SentAtUtc { get; init; }
            public int FailedAttempts { get; set; }
            public bool Consumed { get; set; }
        }

        public enum VerifyResult { Success, NotFound, Invalid, TooManyAttempts }

        public TimeSpan? GetResendWait(string email)
        {
            if (_cache.TryGetValue(Key(email), out Pending? pending) && pending != null)
            {
                var wait = pending.SentAtUtc + ResendCooldown - DateTime.UtcNow;
                if (wait > TimeSpan.Zero)
                {
                    return wait;
                }
            }

            return null;
        }

        // Creates (or replaces) the code and returns it so the caller can email it.
        public string Create(string email)
        {
            var otp = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            _cache.Set(Key(email), new Pending { OtpHash = Hash(otp), SentAtUtc = DateTime.UtcNow }, OtpLifetime);
            return otp;
        }

        public VerifyResult Verify(string email, string otp)
        {
            if (!_cache.TryGetValue(Key(email), out Pending? pending) || pending == null)
            {
                return VerifyResult.NotFound;
            }

            lock (pending)
            {
                if (pending.Consumed)
                {
                    return VerifyResult.NotFound;
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
                return VerifyResult.Success;
            }
        }

        public int RemainingAttempts(string email) =>
            _cache.TryGetValue(Key(email), out Pending? pending) && pending != null ? MaxAttempts - pending.FailedAttempts : 0;

        public void Remove(string email) => _cache.Remove(Key(email));

        private static string Key(string email) => $"guest-otp:{email.Trim().ToLowerInvariant()}";

        private static byte[] Hash(string otp) => SHA256.HashData(Encoding.UTF8.GetBytes(otp));
    }
}
