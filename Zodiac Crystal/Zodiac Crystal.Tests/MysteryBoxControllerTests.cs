using Braintree;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Zodiac_Crystal.Controllers;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Services;
using Zodiac_Crystal.Tests.Infrastructure;

namespace Zodiac_Crystal.Tests;

// Mystery box purchase (COD and card with a faked Braintree gateway) against a
// real SQL Server database. Each test seeds exactly ItemCount products, so the
// box can only be those products and stock assertions are deterministic.
[Collection(SqlServerCollection.Name)]
public class MysteryBoxControllerTests(SqlServerFixture db)
{
    private const int Stock = 5;

    private readonly MysteryBoxHarness _harness = new() { CardConfigured = true };

    // 3 x 1000 = 3000 >= MinValue (2500), so a box can be assembled.
    private async Task<(string Cs, int UserId, int[] ProductIds, int CategoryId)> SeedAsync(decimal price = 1000m, int count = 3)
    {
        var cs = await db.CreateDatabaseAsync();
        await using var ctx = SqlServerFixture.CreateContext(cs);
        var user = await TestData.AddUserAsync(ctx);
        var category = await TestData.AddCategoryAsync(ctx);
        var ids = new int[count];
        for (var i = 0; i < count; i++)
        {
            ids[i] = (await TestData.AddProductAsync(ctx, Stock, price, category.CategoryId)).ProductId;
        }
        return (cs, user.UserId, ids, category.CategoryId);
    }

    private async Task<ActionResult<OrderDto>> PurchaseAsync(string cs, int userId, CreateMysteryBoxOrderDto dto)
    {
        await using var ctx = SqlServerFixture.CreateContext(cs);
        return await _harness.Create(ctx, userId).Purchase(dto);
    }

    private static OrderDto AssertCreated(ActionResult<OrderDto> result)
    {
        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        return Assert.IsType<OrderDto>(created.Value);
    }

    private static CreateMysteryBoxOrderDto CardOrder(string? idempotencyKey = null) =>
        MysteryBoxHarness.Order(idempotencyKey, paymentMethod: "Card", nonce: "fake-valid-nonce");

    private static async Task AssertStockAsync(string cs, int[] productIds, int expected)
    {
        foreach (var id in productIds)
        {
            Assert.Equal(expected, await TestData.StockOfAsync(cs, id));
        }
    }

    private static async Task AssertNothingSavedAsync(string cs, int[] productIds)
    {
        await AssertStockAsync(cs, productIds, Stock);
        await using var ctx = SqlServerFixture.CreateContext(cs);
        Assert.Equal(0, await ctx.Orders.CountAsync());
        Assert.Equal(0, await ctx.OrderItems.CountAsync());
    }

    // Same trick as CardCheckoutTests: the "charge" queues an invalid product
    // (Price must be > 0) on the same context, so the SaveChanges that records
    // the payment fails after a successful charge.
    private void ChargeSucceedsThenSaveFails(ContextHolder holder, int categoryId, string transactionId)
    {
        _harness.Transactions
            .Setup(t => t.SaleAsync(It.IsAny<TransactionRequest>()))
            .Returns(() =>
            {
                holder.Context!.Products.Add(new Zodiac_Crystal.Models.Product
                {
                    Sku = "BROKEN-" + Guid.NewGuid().ToString("N")[..8],
                    Name = "breaks the save",
                    Price = -1m,
                    CategoryId = categoryId
                });
                return Task.FromResult(FakeBraintree.Success(FakeBraintree.MakeTransaction(transactionId)));
            });
    }

    [Fact]
    public async Task Cod_purchase_creates_one_order_and_reserves_one_of_each_item()
    {
        var (cs, userId, productIds, _) = await SeedAsync();

        var dto = AssertCreated(await PurchaseAsync(cs, userId, MysteryBoxHarness.Order()));

        Assert.Equal(MysteryBoxController.MysteryBoxCouponCode, dto.CouponCode);
        Assert.Equal(1499m, dto.TotalAmount);
        Assert.Equal(3000m - 1499m, dto.DiscountAmount);
        Assert.Equal(PaymentMethods.CashOnDelivery, dto.PaymentMethod);
        await AssertStockAsync(cs, productIds, Stock - 1);

        await using var ctx = SqlServerFixture.CreateContext(cs);
        var order = await ctx.Orders.Include(o => o.OrderItems).SingleAsync();
        Assert.Equal(dto.OrderId, order.OrderId);
        Assert.Equal(productIds.OrderBy(i => i), order.OrderItems.Select(i => i.ProductId).OrderBy(i => i));
        Assert.All(order.OrderItems, i => Assert.Equal(1, i.Quantity));
        _harness.Transactions.Verify(t => t.SaleAsync(It.IsAny<TransactionRequest>()), Times.Never());
    }

    [Fact]
    public async Task Card_purchase_charges_box_price_and_marks_paid()
    {
        var (cs, userId, productIds, _) = await SeedAsync();
        _harness.Transactions
            .Setup(t => t.SaleAsync(It.IsAny<TransactionRequest>()))
            .ReturnsAsync(FakeBraintree.Success(FakeBraintree.MakeTransaction("tx-box-ok")));

        var dto = AssertCreated(await PurchaseAsync(cs, userId, CardOrder()));

        Assert.Equal(PaymentStatuses.Paid, dto.PaymentStatus);
        await AssertStockAsync(cs, productIds, Stock - 1);
        _harness.Transactions.Verify(t => t.SaleAsync(It.Is<TransactionRequest>(r => r.Amount == 1499m)), Times.Once());
    }

    [Fact]
    public async Task Catalog_below_minimum_value_is_rejected_and_nothing_changes()
    {
        // 3 x 500 = 1500 < MinValue.
        var (cs, userId, productIds, _) = await SeedAsync(price: 500m);

        var result = await PurchaseAsync(cs, userId, MysteryBoxHarness.Order());

        Assert.IsType<BadRequestObjectResult>(result.Result);
        await AssertNothingSavedAsync(cs, productIds);
    }

    [Fact]
    public async Task Too_few_in_stock_products_is_rejected_and_nothing_changes()
    {
        var (cs, userId, productIds, _) = await SeedAsync(price: 2000m, count: 2);

        var result = await PurchaseAsync(cs, userId, MysteryBoxHarness.Order());

        Assert.IsType<BadRequestObjectResult>(result.Result);
        await AssertNothingSavedAsync(cs, productIds);
    }

    [Fact]
    public async Task Same_idempotency_key_twice_returns_same_order_and_charges_once()
    {
        var (cs, userId, productIds, _) = await SeedAsync();
        _harness.Transactions
            .Setup(t => t.SaleAsync(It.IsAny<TransactionRequest>()))
            .ReturnsAsync(FakeBraintree.Success(FakeBraintree.MakeTransaction("tx-box-once")));
        const string key = "box-key-0001";

        var first = AssertCreated(await PurchaseAsync(cs, userId, CardOrder(key)));
        var second = AssertCreated(await PurchaseAsync(cs, userId, CardOrder(key)));

        Assert.Equal(first.OrderId, second.OrderId);
        await AssertStockAsync(cs, productIds, Stock - 1);
        await using var ctx = SqlServerFixture.CreateContext(cs);
        Assert.Equal(1, await ctx.Orders.CountAsync());
        _harness.Transactions.Verify(t => t.SaleAsync(It.IsAny<TransactionRequest>()), Times.Once());
    }

    [Fact]
    public async Task Declined_card_rolls_back_order_and_stock()
    {
        var (cs, userId, productIds, _) = await SeedAsync();
        _harness.Transactions
            .Setup(t => t.SaleAsync(It.IsAny<TransactionRequest>()))
            .ReturnsAsync(FakeBraintree.Failure());

        var result = await PurchaseAsync(cs, userId, CardOrder());

        Assert.IsType<BadRequestObjectResult>(result.Result);
        await AssertNothingSavedAsync(cs, productIds);
    }

    [Fact]
    public async Task Charge_ok_but_save_fails_refunds_the_charge()
    {
        var (cs, userId, productIds, categoryId) = await SeedAsync();
        var holder = new ContextHolder();
        ChargeSucceedsThenSaveFails(holder, categoryId, "tx-box-refund-ok");
        // Already-refunded transaction: RefundAsync reports success without a void/refund call.
        _harness.Transactions
            .Setup(t => t.FindAsync("tx-box-refund-ok"))
            .ReturnsAsync(FakeBraintree.MakeTransaction("tx-box-refund-ok", new List<string> { "refund-1" }));

        await using (var ctx = SqlServerFixture.CreateContext(cs))
        {
            holder.Context = ctx;
            var result = await _harness.Create(ctx, userId).Purchase(CardOrder());
            Assert.Equal(500, Assert.IsType<ObjectResult>(result.Result).StatusCode);
        }

        _harness.Transactions.Verify(t => t.FindAsync("tx-box-refund-ok"), Times.Once());
        await AssertNothingSavedAsync(cs, productIds);
        await using var check = SqlServerFixture.CreateContext(cs);
        Assert.Equal(0, await check.PaymentFailures.CountAsync());
    }

    [Fact]
    public async Task Charge_ok_save_fails_and_refund_fails_records_PaymentFailure()
    {
        var (cs, userId, productIds, categoryId) = await SeedAsync();
        var holder = new ContextHolder();
        ChargeSucceedsThenSaveFails(holder, categoryId, "tx-box-refund-broken");
        _harness.Transactions
            .Setup(t => t.FindAsync("tx-box-refund-broken"))
            .ThrowsAsync(new HttpRequestException("Braintree unreachable in test"));

        await using (var ctx = SqlServerFixture.CreateContext(cs))
        {
            holder.Context = ctx;
            var result = await _harness.Create(ctx, userId).Purchase(CardOrder());
            Assert.Equal(500, Assert.IsType<ObjectResult>(result.Result).StatusCode);
        }

        await AssertNothingSavedAsync(cs, productIds);
        await using var check = SqlServerFixture.CreateContext(cs);
        var failure = await check.PaymentFailures.SingleAsync();
        Assert.Equal("tx-box-refund-broken", failure.TransactionId);
        Assert.Equal(userId, failure.UserId);
        Assert.Equal(1499m, failure.Amount);
        Assert.False(failure.Resolved);
    }

    private sealed class ContextHolder
    {
        public Zodiac_Crystal.Data.CrystalsDbContext? Context { get; set; }
    }
}
