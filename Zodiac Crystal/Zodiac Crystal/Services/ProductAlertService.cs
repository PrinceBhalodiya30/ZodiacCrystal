using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;

namespace Zodiac_Crystal.Services
{
    // Background job for customer product alerts:
    //  * Back in stock: customers who asked (StockAlerts) are told once a product
    //    they wanted is active and has stock again. The request is then removed.
    //  * Wishlist price drop: customers are told when a saved product's price
    //    falls at least MinDropFraction below Wishlists.AlertPrice, which then
    //    moves down to the new price so the same drop is never announced twice.
    //
    // Runs right after any stock/product change (NotificationService.BroadcastStockAsync
    // pokes ProductAlertTrigger - every stock path already calls it: admin edits,
    // restocks, orders, cancellations, returns), and also every CheckEvery as a
    // safety net. Each customer gets one email per run listing all their
    // products, plus a bell notification per product.
    public class ProductAlertService : BackgroundService
    {
        private static readonly TimeSpan CheckEvery = TimeSpan.FromMinutes(15);
        // After a wake-up, let the change commit and any burst of edits settle.
        private static readonly TimeSpan SettleDelay = TimeSpan.FromSeconds(3);
        // Ignore tiny changes (e.g. ₹499 → ₹495) so customers only hear about real savings.
        internal const decimal MinDropFraction = 0.05m;
        private const int BatchSize = 200;

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ProductAlertTrigger _trigger;
        private readonly ILogger<ProductAlertService> _logger;

        public ProductAlertService(IServiceScopeFactory scopeFactory, ProductAlertTrigger trigger, ILogger<ProductAlertService> logger)
        {
            _scopeFactory = scopeFactory;
            _trigger = trigger;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RunOnceAsync(stoppingToken);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    _logger.LogError(ex, "Product alert run failed");
                }

                // Sleep until a stock change wakes us, or CheckEvery passes.
                using var wait = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                wait.CancelAfter(CheckEvery);
                try
                {
                    await _trigger.WaitAsync(wait.Token);
                    await Task.Delay(SettleDelay, stoppingToken);
                }
                catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
                {
                    // Scheduled check.
                }
            }
        }

        // Internal so tests can run a single pass without waiting for the timer.
        internal async Task RunOnceAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<CrystalsDbContext>();
            var email = scope.ServiceProvider.GetRequiredService<IEmailService>();
            var notifications = scope.ServiceProvider.GetRequiredService<NotificationService>();

            await SendBackInStockAsync(context, email, notifications, ct);
            await SendPriceDropsAsync(context, email, notifications, ct);
        }

        private async Task SendBackInStockAsync(
            CrystalsDbContext context, IEmailService email, NotificationService notifications, CancellationToken ct)
        {
            var due = await context.StockAlerts
                .AsNoTracking()
                .Where(a => a.Product.IsActive && a.Product.StockQuantity > 0)
                .Where(a => a.User.IsActive && !a.User.IsDeleted)
                .OrderBy(a => a.StockAlertId)
                .Take(BatchSize)
                .Select(a => new
                {
                    a.StockAlertId,
                    a.UserId,
                    a.User.Email,
                    UserName = a.User.Name,
                    a.ProductId,
                    ProductName = a.Product.Name,
                    a.Product.Price
                })
                .ToListAsync(ct);

            foreach (var customer in due.GroupBy(a => a.UserId))
            {
                // Claim each request by deleting it before sending: only the run
                // that deletes the row sends, so a second app instance or an
                // overlapping run can't email the same alert twice.
                var claimed = new List<(int ProductId, string Name, decimal Price)>();
                foreach (var alert in customer)
                {
                    var deleted = await context.StockAlerts
                        .Where(a => a.StockAlertId == alert.StockAlertId)
                        .ExecuteDeleteAsync(ct);
                    if (deleted > 0)
                    {
                        claimed.Add((alert.ProductId, alert.ProductName, alert.Price));
                    }
                }

                if (claimed.Count == 0)
                {
                    continue;
                }

                var first = customer.First();
                // One customer's failure must not stop the alerts for the rest.
                try
                {
                    foreach (var product in claimed)
                    {
                        await notifications.NotifyBackInStockAsync(first.UserId, product.ProductId, product.Name);
                    }
                    await email.SendBackInStockAsync(first.Email, first.UserName, claimed);
                }
                catch (Exception ex) when (!ct.IsCancellationRequested)
                {
                    _logger.LogWarning(ex, "Could not send back-in-stock alert to user {UserId}", first.UserId);
                }
            }
        }

        private async Task SendPriceDropsAsync(
            CrystalsDbContext context, IEmailService email, NotificationService notifications, CancellationToken ct)
        {
            // Rows saved before this feature existed start from today's price, so
            // customers aren't told about drops that happened long ago.
            // Plain SQL: EF can't translate a setter that reads another table.
            await context.Database.ExecuteSqlRawAsync(@"
                UPDATE w SET w.AlertPrice = p.Price
                FROM dbo.Wishlists AS w
                INNER JOIN dbo.Products AS p ON p.ProductId = w.ProductId
                WHERE w.AlertPrice IS NULL", ct);

            var threshold = 1 - MinDropFraction;
            var due = await context.Wishlists
                .AsNoTracking()
                .Where(w => w.AlertPrice != null && w.Product.Price <= w.AlertPrice * threshold)
                // Only worth announcing if it can actually be bought now; the
                // baseline stays put, so the drop is announced once it's back.
                .Where(w => w.Product.IsActive && w.Product.StockQuantity > 0)
                .Where(w => w.User.IsActive && !w.User.IsDeleted && w.User.Role == UserRoles.User)
                .OrderBy(w => w.WishlistId)
                .Take(BatchSize)
                .Select(w => new
                {
                    w.WishlistId,
                    w.UserId,
                    w.User.Email,
                    UserName = w.User.Name,
                    w.ProductId,
                    ProductName = w.Product.Name,
                    OldPrice = w.AlertPrice!.Value,
                    NewPrice = w.Product.Price
                })
                .ToListAsync(ct);

            foreach (var customer in due.GroupBy(w => w.UserId))
            {
                // Claim by moving the baseline down to the new price, only if no
                // other run has moved it since this one read it.
                var claimed = new List<(int ProductId, string Name, decimal OldPrice, decimal NewPrice)>();
                foreach (var item in customer)
                {
                    var updated = await context.Wishlists
                        .Where(w => w.WishlistId == item.WishlistId && w.AlertPrice == item.OldPrice)
                        .ExecuteUpdateAsync(s => s.SetProperty(w => w.AlertPrice, item.NewPrice), ct);
                    if (updated > 0)
                    {
                        claimed.Add((item.ProductId, item.ProductName, item.OldPrice, item.NewPrice));
                    }
                }

                if (claimed.Count == 0)
                {
                    continue;
                }

                var first = customer.First();
                try
                {
                    foreach (var product in claimed)
                    {
                        await notifications.NotifyPriceDropAsync(first.UserId, product.ProductId, product.Name, product.OldPrice, product.NewPrice);
                    }
                    await email.SendPriceDropAsync(first.Email, first.UserName, claimed);
                }
                catch (Exception ex) when (!ct.IsCancellationRequested)
                {
                    _logger.LogWarning(ex, "Could not send price-drop alert to user {UserId}", first.UserId);
                }
            }
        }
    }
}
