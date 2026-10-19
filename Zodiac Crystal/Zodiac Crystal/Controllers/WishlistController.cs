using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class WishlistController : ControllerBase
    {
        private readonly CrystalsDbContext _context;

        public WishlistController(CrystalsDbContext context)
        {
            _context = context;
        }

        // GET: api/wishlist
        [HttpGet]
        public async Task<ActionResult<IEnumerable<WishlistItemDto>>> GetMyWishlist()
        {
            var userId = GetCurrentUserId();

            var wishlistEntries = await _context.Wishlists
                .AsNoTracking()
                .Where(w => w.UserId == userId)
                .OrderByDescending(w => w.CreatedAt)
                .ToListAsync();

            if (wishlistEntries.Count == 0)
            {
                return Ok(new List<WishlistItemDto>());
            }

            var productIds = wishlistEntries.Select(w => w.ProductId).ToList();

            var products = await _context.Products
                .Where(p => productIds.Contains(p.ProductId))
                .Select(p => new
                {
                    p.ProductId,
                    p.Name,
                    p.Price,
                    PrimaryImageUrl = p.ProductImages
                        .Where(pi => pi.IsPrimary)
                        .Select(pi => pi.ImageUrl)
                        .FirstOrDefault(),
                    p.StockQuantity,
                    p.IsActive
                })
                .ToListAsync();

            var productLookup = products.ToDictionary(p => p.ProductId);

            // Products removed from the catalog leave orphaned wishlist rows behind;
            // drop them here instead of letting the page break on a missing product.
            var orphaned = wishlistEntries.Where(w => !productLookup.ContainsKey(w.ProductId)).ToList();
            if (orphaned.Count > 0)
            {
                _context.Wishlists.RemoveRange(orphaned);
                await _context.SaveChangesAsync();
            }

            var items = wishlistEntries
                .Where(w => productLookup.ContainsKey(w.ProductId))
                .Select(w =>
                {
                    var p = productLookup[w.ProductId];
                    return new WishlistItemDto
                    {
                        ProductId = p.ProductId,
                        ProductName = p.Name,
                        Price = p.Price,
                        PrimaryImageUrl = p.PrimaryImageUrl,
                        StockQuantity = p.StockQuantity,
                        IsActive = p.IsActive,
                        AddedAt = w.CreatedAt
                    };
                })
                .ToList();

            return Ok(items);
        }

        // POST: api/wishlist/5
        [HttpPost("{productId}")]
        public async Task<IActionResult> AddToWishlist(int productId)
        {
            var userId = GetCurrentUserId();

            var product = await _context.Products
                .AsNoTracking()
                .Where(p => p.ProductId == productId)
                .Select(p => new { p.Price })
                .FirstOrDefaultAsync();
            if (product == null)
            {
                return NotFound(new { message = "Product not found" });
            }

            var alreadyExists = await _context.Wishlists
                .AnyAsync(w => w.UserId == userId && w.ProductId == productId);

            if (!alreadyExists)
            {
                _context.Wishlists.Add(new Wishlist
                {
                    UserId = userId,
                    ProductId = productId,
                    // Price-drop notices are measured from the price when saved.
                    AlertPrice = product.Price
                });

                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Added to wishlist" });
        }

        // DELETE: api/wishlist/5
        [HttpDelete("{productId}")]
        public async Task<IActionResult> RemoveFromWishlist(int productId)
        {
            var userId = GetCurrentUserId();

            var item = await _context.Wishlists
                .FirstOrDefaultAsync(w => w.UserId == userId && w.ProductId == productId);

            if (item == null)
            {
                return NotFound(new { message = "Item not found in wishlist" });
            }

            _context.Wishlists.Remove(item);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }
    }
}
