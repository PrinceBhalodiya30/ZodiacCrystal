using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;

namespace Zodiac_Crystal.Services
{
    // Hourly background job: emails customers whose saved cart has sat untouched for a day.
    // One reminder per cart change, and never more than one a week per customer.
    public class CartReminderService : BackgroundService
    {
        private static readonly TimeSpan CheckEvery = TimeSpan.FromHours(1);
        private static readonly TimeSpan IdleFor = TimeSpan.FromDays(1);
        private static readonly TimeSpan MinGapBetweenReminders = TimeSpan.FromDays(7);
        // Ignore carts abandoned long ago (e.g. when this feature is first switched on).
        private static readonly TimeSpan MaxAge = TimeSpan.FromDays(7);
        private const int BatchSize = 50;

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<CartReminderService> _logger;

        public CartReminderService(IServiceScopeFactory scopeFactory, ILogger<CartReminderService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(CheckEvery);
            do
            {
                try
                {
                    await SendDueRemindersAsync(stoppingToken);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    _logger.LogError(ex, "Abandoned-cart reminder run failed");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }

        private record Line(int ProductId, int Quantity);

        // Internal so tests can run a single pass without waiting for the timer.
        internal async Task SendDueRemindersAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<CrystalsDbContext>();
            var email = scope.ServiceProvider.GetRequiredService<IEmailService>();

            var now = DateTime.UtcNow;
            var idleSince = now - IdleFor;
            var oldest = now - MaxAge;
            var lastReminderBefore = now - MinGapBetweenReminders;

            var due = await context.SavedCarts
                .Include(c => c.User)
                .Where(c => c.UpdatedAt <= idleSince && c.UpdatedAt >= oldest)
                .Where(c => c.ReminderSentAt == null ||
                            (c.ReminderSentAt < c.UpdatedAt && c.ReminderSentAt <= lastReminderBefore))
                .Where(c => c.User.IsActive && !c.User.IsDeleted)
                .OrderBy(c => c.UpdatedAt)
                .Take(BatchSize)
                .ToListAsync(ct);

            foreach (var cart in due)
            {
                // Claim the cart before sending: the update only matches if no other
                // run (a second app instance, an overlapping deploy) has stamped it
                // since this one read it, so each reminder goes out at most once.
                // Claimed even when nothing is sent, so a cart that can't be used is
                // not retried every hour.
                var claimed = await context.SavedCarts
                    .Where(c => c.UserId == cart.UserId &&
                                c.UpdatedAt == cart.UpdatedAt &&
                                c.ReminderSentAt == cart.ReminderSentAt)
                    .ExecuteUpdateAsync(set => set.SetProperty(c => c.ReminderSentAt, now), ct);

                if (claimed == 0)
                {
                    continue;
                }

                // One bad cart must not stop the reminders for the carts after it.
                try
                {
                    await SendReminderAsync(context, email, cart.User.Email, cart.User.Name, cart.ItemsJson, ct);
                }
                catch (JsonException ex)
                {
                    _logger.LogWarning(ex, "Saved cart for user {UserId} has unreadable items; skipped", cart.UserId);
                }
                catch (Exception ex) when (!ct.IsCancellationRequested)
                {
                    _logger.LogWarning(ex, "Could not send cart reminder to user {UserId}", cart.UserId);
                }
            }
        }

        private static async Task SendReminderAsync(
            CrystalsDbContext context, IEmailService email, string toEmail, string toName,
            string itemsJson, CancellationToken ct)
        {
            var lines = JsonSerializer.Deserialize<List<Line>>(itemsJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            var ids = lines.Select(l => l.ProductId).ToList();

            // Only remind about things that can still be bought.
            var products = await context.Products
                .AsNoTracking()
                .Where(p => ids.Contains(p.ProductId) && p.IsActive && p.StockQuantity > 0)
                .Select(p => new { p.ProductId, p.Name, p.Price })
                .ToListAsync(ct);

            var items = lines
                .Join(products, l => l.ProductId, p => p.ProductId, (l, p) => (p.Name, p.Price, l.Quantity))
                .ToList();

            if (items.Count > 0)
            {
                await email.SendCartReminderAsync(toEmail, toName, items);
            }
        }
    }
}
