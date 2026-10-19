using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Tests.Infrastructure;

public static class TestData
{
    public static async Task<User> AddUserAsync(CrystalsDbContext ctx, string? email = null)
    {
        var user = new User
        {
            Name = "Test Customer",
            Email = email ?? $"user-{Guid.NewGuid():N}@example.test",
            PasswordHash = "not-a-real-hash",
            Role = "User",
            IsActive = true
        };
        ctx.Users.Add(user);
        await ctx.SaveChangesAsync();
        return user;
    }

    public static async Task<Category> AddCategoryAsync(CrystalsDbContext ctx)
    {
        var category = new Category { Name = "Test Category " + Guid.NewGuid().ToString("N")[..6], IsActive = true };
        ctx.Categories.Add(category);
        await ctx.SaveChangesAsync();
        return category;
    }

    public static async Task<Product> AddProductAsync(CrystalsDbContext ctx, int stock, decimal price = 500m, int? categoryId = null)
    {
        categoryId ??= (await AddCategoryAsync(ctx)).CategoryId;
        var product = new Product
        {
            Sku = "SKU-" + Guid.NewGuid().ToString("N")[..10],
            Name = "Test Crystal",
            Price = price,
            StockQuantity = stock,
            CategoryId = categoryId.Value,
            IsActive = true
        };
        ctx.Products.Add(product);
        await ctx.SaveChangesAsync();
        return product;
    }

    public static Coupon NewCoupon(string code = "SAVE10") => new()
    {
        Code = code,
        DiscountType = "Percentage",
        DiscountValue = 10m,
        MinimumOrderAmount = 0m,
        StartDate = DateTime.UtcNow.AddDays(-1),
        EndDate = DateTime.UtcNow.AddDays(30),
        UsageLimit = 100,
        UsedCount = 0,
        IsActive = true
    };

    public static async Task<Coupon> AddCouponAsync(CrystalsDbContext ctx, Action<Coupon>? configure = null)
    {
        var coupon = NewCoupon();
        configure?.Invoke(coupon);
        ctx.Coupons.Add(coupon);
        await ctx.SaveChangesAsync();
        return coupon;
    }

    public static async Task<int> StockOfAsync(string cs, int productId)
    {
        await using var ctx = SqlServerFixture.CreateContext(cs);
        return await ctx.Products.AsNoTracking().Where(p => p.ProductId == productId).Select(p => p.StockQuantity).SingleAsync();
    }
}
