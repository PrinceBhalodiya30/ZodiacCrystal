using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    public interface IEmailService
    {
        Task SendEmailAsync(string toEmail, string toName, string subject, string htmlBody);

        // The order must have User (and, for the confirmation, OrderItems.Product)
        // loaded - the recipient is always the order owner's account email, never
        // an address supplied by the client.
        Task SendOrderConfirmationAsync(Order order);

        Task SendOrderStatusUpdateAsync(Order order, string previousStatus);

        Task SendRegistrationOtpAsync(string toEmail, string toName, string otp, TimeSpan validFor);

        // Sent instead of a code when someone tries to register an email that
        // already has an account, so the sign-up page never reveals that it does.
        Task SendRegistrationAttemptOnExistingAccountAsync(string toEmail, string toName);

        Task SendPasswordResetCodeAsync(string toEmail, string toName, string code, TimeSpan validFor);

        // Security notice after any password change (profile change or reset).
        Task SendPasswordChangedAsync(string toEmail, string toName, bool viaReset);

        // To the NEW address: the code that confirms an email change.
        Task SendEmailChangeCodeAsync(string toEmail, string toName, string code, TimeSpan validFor);

        // To the OLD address: security notice once the email has been changed.
        Task SendEmailChangedAsync(string oldEmail, string toName, string newEmail, string revertToken);

        Task SendAccountDeletedAsync(string toEmail, string toName);

        // Sent once, right after a new account is created.
        Task SendWelcomeAsync(string toEmail, string toName);

        // Abandoned-cart reminder: the still-available items left in the customer's cart.
        Task SendCartReminderAsync(string toEmail, string toName, IReadOnlyList<(string Name, decimal Price, int Quantity)> items);

        // Products the customer asked to hear about that are now back in stock.
        Task SendBackInStockAsync(string toEmail, string toName, IReadOnlyList<(int ProductId, string Name, decimal Price)> products);

        // Wishlist products whose price has fallen since the customer saved them
        // (or since the last price-drop email).
        Task SendPriceDropAsync(string toEmail, string toName, IReadOnlyList<(int ProductId, string Name, decimal OldPrice, decimal NewPrice)> products);

        // To one admin: products that just dropped to (or below) the low-stock threshold.
        Task SendLowStockAlertAsync(string toEmail, string toName, IReadOnlyList<(string Name, string Sku, int Stock)> products);

        // The order must have User loaded; with OrderItems.Product loaded too the
        // subject names the products, otherwise it falls back to "Order #12".
        Task SendReturnUpdateAsync(ReturnRequest returnRequest, Order order);

        // "Find my order": a fresh private link (guests) or, when viewUrl is null,
        // a note to log in to their account (registered customers).
        Task SendOrderLookupAsync(string toEmail, string toName, int orderId, string? viewUrl);

        // One-time code that verifies a guest-checkout email.
        Task SendGuestCheckoutCodeAsync(string toEmail, string otp, TimeSpan validFor);

        // To the customer: their ticket was received, answered or resolved.
        // message is the store's reply (null for "received" / status-only updates).
        Task SendTicketUpdateAsync(SupportTicket ticket, User customer, string? message);

        // To one admin: a customer opened a ticket or replied to one.
        Task SendTicketAdminAlertAsync(string toEmail, string toName, SupportTicket ticket, User customer, string message, bool isNewTicket);
    }
}
