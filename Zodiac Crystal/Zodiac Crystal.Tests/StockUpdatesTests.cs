using Zodiac_Crystal.Services;
using Zodiac_Crystal.Tests.Infrastructure;

namespace Zodiac_Crystal.Tests;

[Collection(SqlServerCollection.Name)]
public class StockUpdatesTests(SqlServerFixture db)
{
    [Fact]
    public async Task TryReserve_takes_exactly_the_remaining_stock()
    {
        var cs = await db.CreateDatabaseAsync();
        await using var ctx = SqlServerFixture.CreateContext(cs);
        var product = await TestData.AddProductAsync(ctx, stock: 5);

        Assert.True(await ctx.Products.TryReserveAsync(product.ProductId, 5));
        Assert.Equal(0, await TestData.StockOfAsync(cs, product.ProductId));
    }

    [Fact]
    public async Task TryReserve_fails_one_over_the_stock_and_changes_nothing()
    {
        var cs = await db.CreateDatabaseAsync();
        await using var ctx = SqlServerFixture.CreateContext(cs);
        var product = await TestData.AddProductAsync(ctx, stock: 5);

        Assert.False(await ctx.Products.TryReserveAsync(product.ProductId, 6));
        Assert.Equal(5, await TestData.StockOfAsync(cs, product.ProductId));
    }

    [Fact]
    public async Task TryReserve_fails_for_unknown_product()
    {
        var cs = await db.CreateDatabaseAsync();
        await using var ctx = SqlServerFixture.CreateContext(cs);

        Assert.False(await ctx.Products.TryReserveAsync(999_999, 1));
    }

    [Fact]
    public async Task Restore_adds_units_back()
    {
        var cs = await db.CreateDatabaseAsync();
        await using var ctx = SqlServerFixture.CreateContext(cs);
        var product = await TestData.AddProductAsync(ctx, stock: 2);

        var rows = await ctx.Products.RestoreAsync(product.ProductId, 3);

        Assert.Equal(1, rows);
        Assert.Equal(5, await TestData.StockOfAsync(cs, product.ProductId));
    }
}
