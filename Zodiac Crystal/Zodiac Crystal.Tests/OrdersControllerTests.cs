using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Services;
using Zodiac_Crystal.Tests.Infrastructure;

namespace Zodiac_Crystal.Tests;

// Cash-on-delivery checkout, idempotent replay and cancellation, run through
// OrdersController against a real SQL Server database (no Braintree involved).
[Collection(SqlServerCollection.Name)]
public class OrdersControllerTests(SqlServerFixture db)
{
    private readonly OrdersHarness _harness = new();

    private async Task<(string Cs, int UserId, int ProductId)> SeedAsync(int stock = 10, decimal price = 500m)
    {
        var cs = await db.CreateDatabaseAsync();
        await using var ctx = SqlServerFixture.CreateContext(cs);
        var user = await TestData.AddUserAsync(ctx);
        var product = await TestData.AddProductAsync(ctx, stock, price);
        return (cs, user.UserId, product.ProductId);
    }

    private async Task<ActionResult<OrderDto>> PlaceAsync(string cs, int userId, CreateOrderDto dto)
    {
        await using var ctx = SqlServerFixture.CreateContext(cs);
        return await _harness.Create(ctx, userId).CreateOrder(dto);
    }

    private static OrderDto AssertCreated(ActionResult<OrderDto> result)
    {
        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        return Assert.IsType<OrderDto>(created.Value);
    }

    private static string MessageOf(IActionResult? result)
    {
        var obj = Assert.IsAssignableFrom<ObjectResult>(result);
        return (string)obj.Value!.GetType().GetProperty("message")!.GetValue(obj.Value)!;
    }

    [Fact]
    public async Task Cod_order_reserves_stock_and_creates_order()
    {
        var (cs, userId, productId) = await SeedAsync(stock: 10, price: 500m);

        var dto = AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 3)));

        Assert.Equal(7, await TestData.StockOfAsync(cs, productId));
        Assert.Equal("Pending", dto.Status);
        Assert.Equal(PaymentMethods.CashOnDelivery, dto.PaymentMethod);
        Assert.Equal(1500m, dto.TotalAmount); // >= 999, so free shipping

        await using var ctx = SqlServerFixture.CreateContext(cs);
        var order = await ctx.Orders.Include(o => o.OrderItems).SingleAsync();
        Assert.Equal(dto.OrderId, order.OrderId);
        Assert.Equal(3, Assert.Single(order.OrderItems).Quantity);
        _harness.Email.Verify(e => e.SendOrderConfirmationAsync(It.IsAny<Zodiac_Crystal.Models.Order>()), Moq.Times.Once());
    }

    [Fact]
    public async Task Ordering_all_remaining_stock_succeeds()
    {
        var (cs, userId, productId) = await SeedAsync(stock: 4);

        AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 4)));

        Assert.Equal(0, await TestData.StockOfAsync(cs, productId));
    }

    [Fact]
    public async Task Insufficient_stock_returns_400_and_leaves_stock_unchanged()
    {
        var (cs, userId, productId) = await SeedAsync(stock: 2);

        var result = await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 3));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(2, await TestData.StockOfAsync(cs, productId));
        await using var ctx = SqlServerFixture.CreateContext(cs);
        Assert.Equal(0, await ctx.Orders.CountAsync());
    }

    [Fact]
    public async Task Coupon_at_usage_limit_is_rejected_and_nothing_is_written()
    {
        var (cs, userId, productId) = await SeedAsync(stock: 10);
        await using (var seed = SqlServerFixture.CreateContext(cs))
        {
            await TestData.AddCouponAsync(seed, c => { c.UsageLimit = 1; c.UsedCount = 1; });
        }

        var result = await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 1, couponCode: "save10"));

        Assert.Equal("This coupon has reached its usage limit", MessageOf(result.Result));
        Assert.Equal(10, await TestData.StockOfAsync(cs, productId));
        await using var ctx = SqlServerFixture.CreateContext(cs);
        Assert.Equal(0, await ctx.Orders.CountAsync());
        Assert.Equal(1, (await ctx.Coupons.SingleAsync()).UsedCount);
    }

    [Fact]
    public async Task Valid_coupon_is_applied_and_its_use_counted()
    {
        var (cs, userId, productId) = await SeedAsync(stock: 10, price: 1000m);
        await using (var seed = SqlServerFixture.CreateContext(cs))
        {
            await TestData.AddCouponAsync(seed);
        }

        var dto = AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 1, couponCode: "SAVE10")));

        Assert.Equal(100m, dto.DiscountAmount);
        Assert.Equal(900m, dto.TotalAmount);
        await using var ctx = SqlServerFixture.CreateContext(cs);
        Assert.Equal(1, (await ctx.Coupons.SingleAsync()).UsedCount);
    }

    [Fact]
    public async Task Per_user_coupon_limit_is_enforced_at_checkout()
    {
        var (cs, userId, productId) = await SeedAsync(stock: 10);
        await using (var seed = SqlServerFixture.CreateContext(cs))
        {
            await TestData.AddCouponAsync(seed, c => c.MaxUsesPerUser = 1);
        }

        AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 1, couponCode: "SAVE10")));
        var second = await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 1, couponCode: "SAVE10"));

        Assert.Equal("You've already used this coupon", MessageOf(second.Result));
        Assert.Equal(9, await TestData.StockOfAsync(cs, productId));
    }

    [Fact]
    public async Task Same_idempotency_key_twice_returns_same_order_and_reserves_once()
    {
        var (cs, userId, productId) = await SeedAsync(stock: 10);
        const string key = "checkout-attempt-0001";

        var first = AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 2, idempotencyKey: key)));
        var second = AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 2, idempotencyKey: key)));

        Assert.Equal(first.OrderId, second.OrderId);
        Assert.Equal(8, await TestData.StockOfAsync(cs, productId));
        await using var ctx = SqlServerFixture.CreateContext(cs);
        Assert.Equal(1, await ctx.Orders.CountAsync());
    }

    [Fact]
    public async Task Idempotency_replay_wins_even_if_stock_has_since_run_out()
    {
        var (cs, userId, productId) = await SeedAsync(stock: 2);
        const string key = "checkout-attempt-0002";

        var first = AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 2, idempotencyKey: key)));
        var replay = AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 2, idempotencyKey: key)));

        Assert.Equal(first.OrderId, replay.OrderId);
        Assert.Equal(0, await TestData.StockOfAsync(cs, productId));
    }

    [Fact]
    public async Task Different_idempotency_keys_create_separate_orders()
    {
        var (cs, userId, productId) = await SeedAsync(stock: 10);

        var a = AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 1, idempotencyKey: "key-aaaaaaaa")));
        var b = AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 1, idempotencyKey: "key-bbbbbbbb")));

        Assert.NotEqual(a.OrderId, b.OrderId);
        Assert.Equal(8, await TestData.StockOfAsync(cs, productId));
    }

    [Fact]
    public async Task Cancel_restores_stock_and_marks_cod_payment_cancelled()
    {
        var (cs, userId, productId) = await SeedAsync(stock: 10);
        var placed = AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 4)));
        Assert.Equal(6, await TestData.StockOfAsync(cs, productId));

        IActionResult result;
        await using (var ctx = SqlServerFixture.CreateContext(cs))
        {
            result = await _harness.Create(ctx, userId).CancelOrder(placed.OrderId, new CancelOrderDto { Reason = "Other" });
        }

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(10, await TestData.StockOfAsync(cs, productId));
        await using var check = SqlServerFixture.CreateContext(cs);
        var order = await check.Orders.SingleAsync();
        Assert.Equal("Cancelled", order.Status);
        Assert.Equal(PaymentStatuses.Cancelled, order.PaymentStatus);
        Assert.Equal("Other", order.CancellationReason);
    }

    [Fact]
    public async Task Cancelling_twice_restores_stock_only_once()
    {
        var (cs, userId, productId) = await SeedAsync(stock: 10);
        var placed = AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 4)));

        await using (var ctx = SqlServerFixture.CreateContext(cs))
        {
            Assert.IsType<NoContentResult>(await _harness.Create(ctx, userId).CancelOrder(placed.OrderId, null));
        }
        await using (var ctx = SqlServerFixture.CreateContext(cs))
        {
            Assert.IsType<BadRequestObjectResult>(await _harness.Create(ctx, userId).CancelOrder(placed.OrderId, null));
        }

        Assert.Equal(10, await TestData.StockOfAsync(cs, productId));
    }

    [Fact]
    public async Task Cancel_of_another_customers_order_is_not_found()
    {
        var (cs, userId, productId) = await SeedAsync(stock: 10);
        var placed = AssertCreated(await PlaceAsync(cs, userId, OrdersHarness.Order(productId, 1)));
        int otherUserId;
        await using (var seed = SqlServerFixture.CreateContext(cs))
        {
            otherUserId = (await TestData.AddUserAsync(seed)).UserId;
        }

        await using var ctx = SqlServerFixture.CreateContext(cs);
        Assert.IsType<NotFoundObjectResult>(await _harness.Create(ctx, otherUserId).CancelOrder(placed.OrderId, null));
        Assert.Equal(9, await TestData.StockOfAsync(cs, productId));
    }
}
