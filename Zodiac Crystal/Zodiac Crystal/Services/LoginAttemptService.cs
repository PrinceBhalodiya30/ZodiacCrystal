using Microsoft.Extensions.Caching.Memory;

namespace Zodiac_Crystal.Services
{
    // Per-account login throttle, alongside the per-IP rate limit: an attacker
    // spreading guesses across many IPs still gets only a few tries per account.
    // Keyed by the email as typed (normalised), whether or not an account
    // exists, so a lockout never reveals which emails are registered. Same
    // in-memory approach as EmailChangeOtpService's password lockout.
    public class LoginAttemptService
    {
        public const int MaxFailures = 5;
        public static readonly TimeSpan Lockout = TimeSpan.FromMinutes(15);

        private readonly IMemoryCache _cache;

        public LoginAttemptService(IMemoryCache cache)
        {
            _cache = cache;
        }

        private sealed class Failures
        {
            public int Count;
        }

        public bool IsLocked(string email) =>
            _cache.TryGetValue(Key(email), out Failures? failures)
            && failures != null
            && Volatile.Read(ref failures.Count) >= MaxFailures;

        public void RecordFailure(string email)
        {
            // The window starts at the first failure and isn't extended by later
            // ones, so a locked account always unlocks after Lockout.
            var failures = _cache.GetOrCreate(Key(email), entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = Lockout;
                return new Failures();
            })!;

            Interlocked.Increment(ref failures.Count);
        }

        public void Clear(string email) => _cache.Remove(Key(email));

        private static string Key(string email) => $"login-fail:{email.Trim().ToLowerInvariant()}";
    }
}
