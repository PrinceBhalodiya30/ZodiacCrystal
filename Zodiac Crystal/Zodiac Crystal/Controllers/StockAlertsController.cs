using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Controllers
{
    // "Email me when it's back" on out-of-stock product pages. The alert itself
    // is sent by ProductAlertService, which removes the request afterwards.
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class StockAlertsController : ControllerBase
    {
        private readonly CrystalsDbContext _context;

        public StockAlertsController(CrystalsDbContext context)
        {
            _context = context;
        }

        // GET: api/stockalerts/5 - whether the current user is waiting for this product.
        [HttpGet("{productId}")]
        public async Task<ActionResult<object>> GetStatus(int productId)
        {
            var userId = GetCurrentUserId();
            var subscribed = await _context.StockAlerts
                .AnyAsync(a => a.UserId == userId && a.ProductId == productId);

            return Ok(new { subscribed });
        }

        // POST: api/stockalerts/5
        [HttpPost("{productId}")]
        public async Task<IActionResult> Subscribe(int productId)
        {
            if (User.IsInRole("Admin"))
            {
                return BadRequest(new { message = "Stock alerts are for customer accounts." });
            }

            var product = await _context.Products
                .AsNoTracking()
                .Where(p => p.ProductId == productId && p.IsActive)
                .Select(p => new { p.StockQuantity })
                .FirstOrDefaultAsync();

            if (product == null)
            {
                return NotFound(new { message = "Product not found" });
            }

            if (product.StockQuantity > 0)
            {
                return BadRequest(new { message = "This product is in stock now." });
            }

            var userId = GetCurrentUserId();
            var exists = await _context.StockAlerts.AnyAsync(a => a.UserId == userId && a.ProductId == productId);
            if (!exists)
            {
                _context.StockAlerts.Add(new StockAlert { UserId = userId, ProductId = productId });
                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException)
                {
                    // A double click raced past the check; the unique index kept one row.
                }
            }

            return Ok(new { message = "We'll email you when it's back in stock." });
        }

        // DELETE: api/stockalerts/5
        [HttpDelete("{productId}")]
        public async Task<IActionResult> Unsubscribe(int productId)
        {
            var userId = GetCurrentUserId();
            await _context.StockAlerts
                .Where(a => a.UserId == userId && a.ProductId == productId)
                .ExecuteDeleteAsync();

            return NoContent();
        }

        private int GetCurrentUserId() =>
            int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    }
}
