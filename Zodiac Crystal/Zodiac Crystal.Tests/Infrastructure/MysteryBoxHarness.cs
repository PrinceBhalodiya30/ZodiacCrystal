using System.Net;
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

// Builds MysteryBoxController directly (as if for one HTTP request) with the
// same fakes as OrdersHarness: email, SignalR, offline India Post lookup and
// the Braintree gateway swapped in by FakeBraintree.
public sealed class MysteryBoxHarness
{
    public Mock<IEmailService> Email { get; } = new();

    // The gateway inside BraintreePaymentService. Only used when CardConfigured.
    public Mock<IBraintreeGateway> Gateway { get; } = new();
    public Mock<ITransactionGateway> Transactions { get; } = new();

    public bool CardConfigured { get; init; }

    public MysteryBoxHarness()
    {
        Gateway.Setup(g => g.Transaction).Returns(Transactions.Object);
    }

    public MysteryBoxController Create(CrystalsDbContext ctx, int userId)
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

        var controller = new MysteryBoxController(
            ctx,
            NullLogger<MysteryBoxController>.Instance,
            payments,
            notifications,
            Email.Object,
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

    public static CreateMysteryBoxOrderDto Order(string? idempotencyKey = null, string paymentMethod = "COD", string? nonce = null) => new()
    {
        ShippingName = "Test Customer",
        ShippingEmail = "customer@example.test",
        ShippingAddress = "1 Test Street",
        City = "Mumbai",
        State = "Maharashtra",
        PostalCode = "400001",
        Phone = "9876543210",
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
