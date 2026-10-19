using Braintree;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Tests.Infrastructure;

namespace Zodiac_Crystal.Tests;

// Card checkout with a faked Braintree gateway (see FakeBraintree for how).
[Collection(SqlServerCollection.Name)]
public class CardCheckoutTests(SqlServerFixture db)
{
    private readonly OrdersHarness _harness = new() { CardConfigured = true };

    private async Task<(string Cs, int UserId, int ProductId, int CategoryId)> SeedWithCouponAsync()
    {
        var cs = await db.CreateDatabaseAsync();
        await using var ctx = SqlServerFixture.CreateContext(cs);
        var user = await TestData.AddUserAsync(ctx);
        var product = await TestData.AddProductAsync(ctx, stock: 10, price: 1000m);
        await TestData.AddCouponAsync(ctx);
        return (cs, user.UserId, product.ProductId, product.CategoryId);
    }

    private static CreateOrderDto CardOrder(int productId) =>
        OrdersHarness.Order(productId, 2, couponCode: "SAVE10", paymentMethod: "Card", nonce: "fake-valid-nonce");

    private async Task AssertNothingSavedAsync(string cs, int productId)
    {
        Assert.Equal(10, await TestData.StockOfAsync(cs, productId));
        await using var ctx = SqlServerFixture.CreateContext(cs);
        Assert.Equal(0, await ctx.Orders.CountAsync());
        Assert.Equal(0, (await ctx.Coupons.SingleAsync()).UsedCount);
    }

    // Makes the second SaveChanges (the one that records the payment) fail, by
    // having the "charge" queue an invalid product (Price must be > 0) on the
    // same context. Returns a successful charge.
    private void ChargeSucceedsThenSaveFails(CrystalsDbContextHolder holder, int categoryId, string transactionId)
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
    public async Task Successful_charge_marks_order_paid()
    {
        var (cs, userId, productId, _) = await SeedWithCouponAsync();
        _harness.Transactions
            .Setup(t => t.SaleAsync(It.IsAny<TransactionRequest>()))
            .ReturnsAsync(FakeBraintree.Success(FakeBraintree.MakeTransaction("tx-ok-1")));

        await using var ctx = SqlServerFixture.CreateContext(cs);
        var result = await _harness.Create(ctx, userId).CreateOrder(CardOrder(productId));

        var dto = Assert.IsType<OrderDto>(Assert.IsType<CreatedAtActionResult>(result.Result).Value);
        Assert.Equal("Paid", dto.PaymentStatus);
        Assert.Equal(8, await TestData.StockOfAsync(cs, productId));
        _harness.Transactions.Verify(t => t.SaleAsync(It.Is<TransactionRequest>(r => r.Amount == dto.TotalAmount)), Times.Once());
    }

    [Fact]
    public async Task Declined_card_rolls_back_order_stock_and_coupon()
    {
        var (cs, userId, productId, _) = await SeedWithCouponAsync();
        _harness.Transactions
            .Setup(t => t.SaleAsync(It.IsAny<TransactionRequest>()))
            .ReturnsAsync(FakeBraintree.Failure());

        await using (var ctx = SqlServerFixture.CreateContext(cs))
        {
            var result = await _harness.Create(ctx, userId).CreateOrder(CardOrder(productId));
            Assert.IsType<BadRequestObjectResult>(result.Result);
        }

        await AssertNothingSavedAsync(cs, productId);
    }

    [Fact]
    public async Task Charge_ok_but_save_fails_refunds_the_charge()
    {
        var (cs, userId, productId, categoryId) = await SeedWithCouponAsync();
        var holder = new CrystalsDbContextHolder();
        ChargeSucceedsThenSaveFails(holder, categoryId, "tx-refund-ok");
        // Already-refunded transaction: RefundAsync reports success without a void/refund call.
        _harness.Transactions
            .Setup(t => t.FindAsync("tx-refund-ok"))
            .ReturnsAsync(FakeBraintree.MakeTransaction("tx-refund-ok", new List<string> { "refund-1" }));

        await using (var ctx = SqlServerFixture.CreateContext(cs))
        {
            holder.Context = ctx;
            var result = await _harness.Create(ctx, userId).CreateOrder(CardOrder(productId));
            Assert.Equal(500, Assert.IsType<ObjectResult>(result.Result).StatusCode);
        }

        _harness.Transactions.Verify(t => t.FindAsync("tx-refund-ok"), Times.Once());
        await AssertNothingSavedAsync(cs, productId);
        await using var check = SqlServerFixture.CreateContext(cs);
        Assert.Equal(0, await check.PaymentFailures.CountAsync());
    }

    [Fact]
    public async Task Charge_ok_save_fails_and_refund_fails_records_PaymentFailure()
    {
        var (cs, userId, productId, categoryId) = await SeedWithCouponAsync();
        var holder = new CrystalsDbContextHolder();
        ChargeSucceedsThenSaveFails(holder, categoryId, "tx-refund-broken");
        _harness.Transactions
            .Setup(t => t.FindAsync("tx-refund-broken"))
            .ThrowsAsync(new HttpRequestException("Braintree unreachable in test"));

        await using (var ctx = SqlServerFixture.CreateContext(cs))
        {
            holder.Context = ctx;
            var result = await _harness.Create(ctx, userId).CreateOrder(CardOrder(productId));
            Assert.Equal(500, Assert.IsType<ObjectResult>(result.Result).StatusCode);
        }

        await AssertNothingSavedAsync(cs, productId);
        await using var check = SqlServerFixture.CreateContext(cs);
        var failure = await check.PaymentFailures.SingleAsync();
        Assert.Equal("tx-refund-broken", failure.TransactionId);
        Assert.Equal(userId, failure.UserId);
        Assert.Equal(1800m, failure.Amount); // 2 x 1000, 10% off, free shipping
        Assert.False(failure.Resolved);
    }

    [Fact]
    public async Task Card_order_without_nonce_is_rejected_before_any_charge()
    {
        var (cs, userId, productId, _) = await SeedWithCouponAsync();
        var dto = CardOrder(productId);
        dto.PaymentNonce = null;

        await using (var ctx = SqlServerFixture.CreateContext(cs))
        {
            Assert.IsType<BadRequestObjectResult>((await _harness.Create(ctx, userId).CreateOrder(dto)).Result);
        }

        _harness.Transactions.Verify(t => t.SaleAsync(It.IsAny<TransactionRequest>()), Times.Never());
        await AssertNothingSavedAsync(cs, productId);
    }

    private sealed class CrystalsDbContextHolder
    {
        public Zodiac_Crystal.Data.CrystalsDbContext? Context { get; set; }
    }
}
