using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    // Tells every active admin (bell notification + email) when an order drops a
    // product to the low-stock threshold or below. Only a *crossing* triggers an
    // alert (stock was above the threshold before the order, at/below after), so
    // admins aren't emailed again for every further sale of an already-low item.
    public class LowStockAlertService
    {
        private readonly CrystalsDbContext _context;
        private readonly NotificationService _notificationService;
        private readonly IEmailService _emailService;
        private readonly ILogger<LowStockAlertService> _logger;

        public LowStockAlertService(
            CrystalsDbContext context,
            NotificationService notificationService,
            IEmailService emailService,
            ILogger<LowStockAlertService> logger)
        {
            _context = context;
            _notificationService = notificationService;
            _emailService = emailService;
            _logger = logger;
        }

        // Call after the order is committed. stockBefore: each product's stock
        // before the order reduced it. Never throws - alerts are best effort.
        public async Task AlertIfCrossedAsync(IEnumerable<(Product Product, int StockBefore)> changes)
        {
            try
            {
                var crossed = changes
                    .Where(c => c.StockBefore > StockRules.LowStockThreshold &&
                                c.Product.StockQuantity <= StockRules.LowStockThreshold)
                    .Select(c => c.Product)
                    .ToList();

                if (crossed.Count == 0)
                {
                    return;
                }

                var admins = await _context.Users
                    .AsNoTracking()
                    .Where(u => u.Role == "Admin" && u.IsActive && !u.IsDeleted)
                    .Select(u => new { u.UserId, u.Name, u.Email })
                    .ToListAsync();

                var lines = crossed.Select(p => (p.Name, p.Sku, p.StockQuantity)).ToList();

                foreach (var admin in admins)
                {
                    foreach (var product in crossed)
                    {
                        await _notificationService.NotifyLowStockAsync(admin.UserId, product.Name, product.StockQuantity);
                    }

                    try
                    {
                        await _emailService.SendLowStockAlertAsync(admin.Email, admin.Name, lines);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Low-stock alert email failed for admin {AdminUserId}", admin.UserId);
                    }
                }

                _logger.LogInformation("Low-stock alert sent for products {ProductIds}",
                    string.Join(",", crossed.Select(p => p.ProductId)));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Low-stock alert failed");
            }
        }
    }
}
