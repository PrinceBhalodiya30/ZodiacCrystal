using System.Net;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Security.Claims;
using Braintree;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Zodiac_Crystal.Controllers;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Hubs;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Tests.Infrastructure;

// Builds OrdersController directly (as if for one HTTP request) against a real
// test database, with every outside service faked: email, SignalR, the India
// Post PIN lookup (offline, so the check is skipped) and the Braintree gateway.
public sealed class OrdersHarness
{
    public Mock<IEmailService> Email { get; } = new();

    // The gateway inside BraintreePaymentService. Only used when CardConfigured.
    public Mock<IBraintreeGateway> Gateway { get; } = new();
    public Mock<ITransactionGateway> Transactions { get; } = new();

    public bool CardConfigured { get; init; }

    public OrdersHarness()
    {
        Gateway.Setup(g => g.Transaction).Returns(Transactions.Object);
    }

    public OrdersController Create(CrystalsDbContext ctx, int userId)
    {
        var hub = new Mock<IHubContext<NotificationHub>> { DefaultValue = DefaultValue.Mock };
        var notifications = new NotificationService(ctx, hub.Object, NullLogger<NotificationService>.Instance, new ProductAlertTrigger());

        // Placeholder values only so IsConfigured is true; the real gateway is
        // never created because FakeBraintree swaps it out.
        var settings = CardConfigured
            ? new BraintreeSettings { MerchantId = "test-merchant", PublicKey = "test-public", PrivateKey = "test-private" }
            : new BraintreeSettings();
        var payments = new BraintreePaymentService(Microsoft.Extensions.Options.Options.Create(settings), NullLogger<BraintreePaymentService>.Instance);
        FakeBraintree.InstallGateway(payments, Gateway.Object);

        var address = new AddressCheckService(
            new HttpClient(new OfflineHandler()) { BaseAddress = new Uri("http://india-post.invalid/") },
            new MemoryCache(new MemoryCacheOptions()),
            NullLogger<AddressCheckService>.Instance);

        var lowStock = new LowStockAlertService(ctx, notifications, Email.Object, NullLogger<LowStockAlertService>.Instance);

        var controller = new OrdersController(
            ctx,
            NullLogger<OrdersController>.Instance,
            new CouponValidationService(),
            new InvoicePdfService(),
            notifications,
            Email.Object,
            payments,
            lowStock,
            address);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, "User") },
                    "Test"))
            }
        };
        return controller;
    }

    public static CreateOrderDto Order(int productId, int quantity, string? couponCode = null, string? idempotencyKey = null,
        string paymentMethod = "COD", string? nonce = null) => new()
    {
        Items = { new OrderItemInputDto { ProductId = productId, Quantity = quantity } },
        ShippingName = "Test Customer",
        ShippingEmail = "customer@example.test",
        ShippingAddress = "1 Test Street",
        City = "Mumbai",
        State = "Maharashtra",
        PostalCode = "400001",
        Phone = "9876543210",
        CouponCode = couponCode,
        IdempotencyKey = idempotencyKey,
        PaymentMethod = paymentMethod,
        PaymentNonce = nonce
    };

    // Any India Post request fails as "service unreachable", which the
    // address check treats as "skip the PIN check".
    private sealed class OfflineHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            throw new HttpRequestException("offline in tests", null, HttpStatusCode.ServiceUnavailable);
    }
}

// BraintreePaymentService is a concrete class with non-virtual methods and no
// interface, so it can't be mocked directly. Its only seam is the private
// Lazy<IBraintreeGateway> _gateway field, which is replaced here by reflection.
// If that field is renamed, these helpers fail loudly rather than silently
// hitting the real Braintree.
public static class FakeBraintree
{
    public static void InstallGateway(BraintreePaymentService service, IBraintreeGateway gateway)
    {
        var field = typeof(BraintreePaymentService).GetField("_gateway", BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new InvalidOperationException("BraintreePaymentService._gateway not found - update FakeBraintree.");
        field.SetValue(service, new Lazy<IBraintreeGateway>(() => gateway));
    }

    public static Transaction MakeTransaction(string id, List<string>? refundIds = null)
    {
        var tx = (Transaction)RuntimeHelpers.GetUninitializedObject(typeof(Transaction));
        Set(tx, "Id", id);
        Set(tx, "RefundIds", refundIds ?? new List<string>());
        return tx;
    }

    public static Result<Transaction> Success(Transaction tx)
    {
        var result = new Mock<Result<Transaction>>();
        result.Setup(r => r.IsSuccess()).Returns(true);
        result.Setup(r => r.Target).Returns(tx);
        return result.Object;
    }

    // A validation failure (e.g. a bad nonce): no Transaction attached.
    public static Result<Transaction> Failure(string message = "Declined in test")
    {
        var result = new Mock<Result<Transaction>>();
        result.Setup(r => r.IsSuccess()).Returns(false);
        result.Setup(r => r.Transaction).Returns((Transaction)null!);
        result.Setup(r => r.Message).Returns(message);
        return result.Object;
    }

    private static void Set(object target, string property, object? value)
    {
        var prop = target.GetType().GetProperty(property, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)
            ?? throw new InvalidOperationException($"Braintree.Transaction.{property} not found");
        var setter = prop.GetSetMethod(true);
        if (setter != null)
        {
            setter.Invoke(target, new[] { value });
            return;
        }
        var backing = target.GetType().GetField($"<{property}>k__BackingField", BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new InvalidOperationException($"Braintree.Transaction.{property} has no setter");
        backing.SetValue(target, value);
    }
}
