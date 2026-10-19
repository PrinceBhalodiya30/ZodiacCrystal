using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Controllers
{
    // Signed-in customers' "Recently Viewed" history, kept on the server so it
    // follows them across devices. Guests keep theirs in the browser and it is
    // merged in here when they sign in.
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class RecentlyViewedController : ControllerBase
    {
        // Shown on the site.
        private const int MaxShown = 12;
        // Kept per user; older rows beyond this are pruned.
        private const int MaxStored = 30;
        // Views older than this expire.
        private static readonly TimeSpan Expiry = TimeSpan.FromDays(90);

        private readonly CrystalsDbContext _context;

        public RecentlyViewedController(CrystalsDbContext context)
        {
            _context = context;
        }

        // GET: api/recentlyviewed  ->  [12, 7, 3]  (product ids, most recent first)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<int>>> GetMine()
        {
            var userId = GetCurrentUserId();
            var cutoff = DateTime.UtcNow - Expiry;

            var ids = await _context.RecentlyViewed
                .AsNoTracking()
                .Where(r => r.UserId == userId && r.ViewedAt >= cutoff && r.Product.IsActive)
                .OrderByDescending(r => r.ViewedAt)
                .Select(r => r.ProductId)
                .Take(MaxShown)
                .ToListAsync();

            return Ok(ids);
        }

        // POST: api/recentlyviewed/5  - records (or bumps) a view.
        [HttpPost("{productId}")]
        public async Task<IActionResult> Record(int productId)
        {
            if (!await _context.Products.AnyAsync(p => p.ProductId == productId && p.IsActive))
            {
                return NotFound(new { message = "Product not found" });
            }

            var userId = GetCurrentUserId();
            await UpsertAsync(userId, new[] { productId }, DateTime.UtcNow);
            await PruneAsync(userId);

            return NoContent();
        }

        // POST: api/recentlyviewed/merge  { "productIds": [9, 4] }
        // Called right after sign-in with what was browsed as a guest.
        [HttpPost("merge")]
        public async Task<IActionResult> Merge(MergeRecentlyViewedDto dto)
        {
            var ids = dto.ProductIds.Distinct().Take(MaxShown).ToList();
            if (ids.Count == 0)
            {
                return NoContent();
            }

            var validIds = await _context.Products
                .Where(p => ids.Contains(p.ProductId) && p.IsActive)
                .Select(p => p.ProductId)
                .ToListAsync();

            // Keep the guest order: first id = most recent, so give it the newest time.
            var now = DateTime.UtcNow;
            var userId = GetCurrentUserId();
            var ordered = ids.Where(validIds.Contains).ToList();
            for (var i = ordered.Count - 1; i >= 0; i--)
            {
                await UpsertAsync(userId, new[] { ordered[i] }, now.AddMilliseconds(-i));
            }
            await PruneAsync(userId);

            return NoContent();
        }

        // DELETE: api/recentlyviewed/5
        [HttpDelete("{productId}")]
        public async Task<IActionResult> Remove(int productId)
        {
            var userId = GetCurrentUserId();
            await _context.RecentlyViewed
                .Where(r => r.UserId == userId && r.ProductId == productId)
                .ExecuteDeleteAsync();

            return NoContent();
        }

        // DELETE: api/recentlyviewed  - "Clear history".
        [HttpDelete]
        public async Task<IActionResult> Clear()
        {
            var userId = GetCurrentUserId();
            await _context.RecentlyViewed
                .Where(r => r.UserId == userId)
                .ExecuteDeleteAsync();

            return NoContent();
        }

        private async Task UpsertAsync(int userId, IEnumerable<int> productIds, DateTime viewedAt)
        {
            foreach (var productId in productIds)
            {
                var updated = await _context.RecentlyViewed
                    .Where(r => r.UserId == userId && r.ProductId == productId)
                    .ExecuteUpdateAsync(s => s.SetProperty(r => r.ViewedAt, viewedAt));

                if (updated > 0)
                {
                    continue;
                }

                _context.RecentlyViewed.Add(new RecentlyViewed
                {
                    UserId = userId,
                    ProductId = productId,
                    ViewedAt = viewedAt
                });

                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException)
                {
                    // Same product recorded at the same moment from another tab -
                    // the unique index rejected the duplicate; the row exists, fine.
                    _context.ChangeTracker.Clear();
                }
            }
        }

        // Drops expired rows and anything beyond MaxStored for this user.
        private async Task PruneAsync(int userId)
        {
            var cutoff = DateTime.UtcNow - Expiry;

            var keepIds = await _context.RecentlyViewed
                .Where(r => r.UserId == userId && r.ViewedAt >= cutoff)
                .OrderByDescending(r => r.ViewedAt)
                .Select(r => r.RecentlyViewedId)
                .Take(MaxStored)
                .ToListAsync();

            await _context.RecentlyViewed
                .Where(r => r.UserId == userId && !keepIds.Contains(r.RecentlyViewedId))
                .ExecuteDeleteAsync();
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }
    }
}
