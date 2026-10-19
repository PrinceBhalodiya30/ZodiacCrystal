using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    // Stock changes run as a single UPDATE against the current database value
    // (StockQuantity = StockQuantity +/- n) rather than saving a value read
    // earlier, so concurrent orders, cancellations and admin edits can't
    // overwrite each other. ExecuteUpdate bypasses the change tracker - callers
    // that keep a tracked Product around should reload it afterwards.
    public static class StockUpdates
    {
        // Takes quantity units only if that many are still available. Returns
        // false (and changes nothing) when the product has sold out meanwhile.
        public static async Task<bool> TryReserveAsync(this DbSet<Product> products, int productId, int quantity)
        {
            var rows = await products
                .Where(p => p.ProductId == productId && p.StockQuantity >= quantity)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.StockQuantity, p => p.StockQuantity - quantity));

            return rows > 0;
        }

        // Puts units back, e.g. when an order is cancelled or a return restocked.
        public static Task<int> RestoreAsync(this DbSet<Product> products, int productId, int quantity) =>
            products
                .Where(p => p.ProductId == productId)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.StockQuantity, p => p.StockQuantity + quantity));
    }
}
