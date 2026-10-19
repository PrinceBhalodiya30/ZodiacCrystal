using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CartController : ControllerBase
    {
        private const int MaxLines = 100;

        private readonly CrystalsDbContext _context;

        public CartController(CrystalsDbContext context)
        {
            _context = context;
        }

        public class CartLine
        {
            [Range(1, int.MaxValue)]
            public int ProductId { get; set; }

            [Range(1, 1000)]
            public int Quantity { get; set; }
        }

        // PUT: api/cart
        // The browser sends its cart whenever it changes, so an idle cart can get a
        // reminder email (CartReminderService). An empty cart removes the copy.
        [HttpPut]
        public async Task<IActionResult> SaveCart([FromBody] List<CartLine> items)
        {
            if (items.Count > MaxLines)
            {
                return BadRequest(new { message = "The cart has too many lines." });
            }

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var saved = await _context.SavedCarts.FindAsync(userId);

            if (items.Count == 0)
            {
                if (saved != null)
                {
                    _context.SavedCarts.Remove(saved);
                    await _context.SaveChangesAsync();
                }
                return NoContent();
            }

            var json = JsonSerializer.Serialize(
                items.Select(i => new { productId = i.ProductId, quantity = i.Quantity }));

            if (saved == null)
            {
                _context.SavedCarts.Add(new SavedCart { UserId = userId, ItemsJson = json, UpdatedAt = DateTime.UtcNow });
            }
            else if (saved.ItemsJson != json)
            {
                // A changed cart restarts the idle clock. ReminderSentAt is kept, so the
                // reminder service can hold back a second email for a week.
                saved.ItemsJson = json;
                saved.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
