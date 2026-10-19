using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    // Secure "view your order" links for guest orders. Each link carries 32
    // random bytes; only their SHA-256 is stored (OrderAccessTokens), so a
    // database leak doesn't expose working links. Opening a valid link gives a
    // short guest session for the order's guest account - never a full login.
    public class OrderAccessService
    {
        public static readonly TimeSpan LinkLifetime = TimeSpan.FromDays(90);

        private readonly CrystalsDbContext _context;
        private readonly EmailSettings _settings;

        public OrderAccessService(CrystalsDbContext context, IOptions<EmailSettings> settings)
        {
            _context = context;
            _settings = settings.Value;
        }

        // Creates a new link for the order and returns its full URL.
        public async Task<string> CreateLinkAsync(int orderId)
        {
            var token = Base64Url(RandomNumberGenerator.GetBytes(32));

            _context.OrderAccessTokens.Add(new OrderAccessToken
            {
                OrderId = orderId,
                TokenHash = Hash(token),
                ExpiresAt = DateTime.UtcNow.Add(LinkLifetime)
            });
            await _context.SaveChangesAsync();

            return $"{_settings.SiteUrl.TrimEnd('/')}/order-access?t={token}";
        }

        // The order (with User) for a valid, unexpired, unrevoked token; null otherwise.
        public async Task<Order?> RedeemAsync(string token)
        {
            if (string.IsNullOrWhiteSpace(token) || token.Length > 100)
            {
                return null;
            }

            var hash = Hash(token);
            var now = DateTime.UtcNow;

            var access = await _context.OrderAccessTokens
                .Include(t => t.Order).ThenInclude(o => o.User)
                .FirstOrDefaultAsync(t => t.TokenHash == hash && t.RevokedAt == null && t.ExpiresAt > now);

            if (access == null)
            {
                return null;
            }

            access.LastUsedAt = now;
            await _context.SaveChangesAsync();
            return access.Order;
        }

        private static string Hash(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

        private static string Base64Url(byte[] bytes) =>
            Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
