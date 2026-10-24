using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Data
{
    public static class DatabaseSeeder
    {
        public static async Task SeedAsync(IServiceProvider serviceProvider)
        {
            using var scope = serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<CrystalsDbContext>();
            var logger = scope.ServiceProvider.GetService<ILoggerFactory>()?.CreateLogger("DatabaseSeeder");

            try
            {
                // Ensure CRYSTAL-010 welcome coupon exists
                var welcomeExists = await context.Coupons
                    .AnyAsync(c => c.Code == "CRYSTAL-010");

                if (!welcomeExists)
                {
                    var welcomeCoupon = new Coupon
                    {
                        Code = "CRYSTAL-010",
                        Description = "10% off your first crystal purchase (Newsletter subscriber welcome gift)",
                        DiscountType = "Percentage",
                        DiscountValue = 10m,
                        MinimumOrderAmount = 0m,
                        StartDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                        EndDate = new DateTime(2036, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                        UsageLimit = 100000,
                        UsedCount = 0,
                        MaxUsesPerUser = 1,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };

                    context.Coupons.Add(welcomeCoupon);
                    await context.SaveChangesAsync();
                    logger?.LogInformation("Seeded default welcome coupon CRYSTAL-010 successfully.");
                }
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "An error occurred while seeding default welcome coupon.");
            }
        }
    }
}
