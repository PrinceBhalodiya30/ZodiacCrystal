using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;

namespace Zodiac_Crystal.Services
{
    // Hourly background job: closes support tickets that have stayed Resolved
    // for SupportPolicy.AutoCloseAfterDays without the customer replying.
    public class TicketAutoCloseService : BackgroundService
    {
        private static readonly TimeSpan CheckEvery = TimeSpan.FromHours(1);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<TicketAutoCloseService> _logger;

        public TicketAutoCloseService(IServiceScopeFactory scopeFactory, ILogger<TicketAutoCloseService> logger)
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
                    await CloseResolvedTicketsAsync(stoppingToken);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    _logger.LogError(ex, "Support ticket auto-close run failed");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }

        // Internal so tests can run a single pass without waiting for the timer.
        internal async Task CloseResolvedTicketsAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<CrystalsDbContext>();

            var now = DateTime.UtcNow;
            var resolvedBefore = now.AddDays(-SupportPolicy.AutoCloseAfterDays);

            var closed = await context.SupportTickets
                .Where(t => t.Status == TicketStatuses.Resolved && t.ResolvedAt != null && t.ResolvedAt <= resolvedBefore)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(t => t.Status, TicketStatuses.Closed)
                    .SetProperty(t => t.ClosedAt, now), ct);

            if (closed > 0)
            {
                _logger.LogInformation("Auto-closed {Count} resolved support tickets", closed);
            }
        }
    }
}
