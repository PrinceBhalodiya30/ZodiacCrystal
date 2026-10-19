using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    // Shared by OrdersController and MysteryBoxController's checkout paths.
    public static class CheckoutSafety
    {
        public const string IdempotencyIndexName = "UX_Orders_UserId_IdempotencyKey";

        // True when a save failed only because another request with the same
        // idempotency key placed its order first.
        public static bool IsDuplicateIdempotencyKey(DbUpdateException ex)
        {
            return ex.InnerException is SqlException sql
                && (sql.Number == 2601 || sql.Number == 2627)
                && sql.Message.Contains(IdempotencyIndexName, StringComparison.OrdinalIgnoreCase);
        }

        // Records a charge whose reversal failed, so staff have a list to refund
        // from rather than only a log line. Called after the order's transaction
        // is rolled back, so this saves on its own. Never throws: a failure here
        // must not hide the original error from the customer.
        public static async Task RecordPaymentFailureAsync(
            CrystalsDbContext context, ILogger logger, int userId, string transactionId, decimal amount, string reason)
        {
            try
            {
                // Drop the rolled-back order and its items, or SaveChanges would
                // try to insert them again.
                context.ChangeTracker.Clear();
                context.PaymentFailures.Add(new PaymentFailure
                {
                    UserId = userId,
                    TransactionId = transactionId,
                    Amount = amount,
                    Reason = reason.Length > 500 ? reason[..500] : reason
                });
                await context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                logger.LogCritical(ex, "Could not record payment failure for transaction {TransactionId}", transactionId);
            }
        }
    }
}
