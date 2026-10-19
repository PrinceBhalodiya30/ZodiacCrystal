namespace Zodiac_Crystal.Services
{
    public static class TicketStatuses
    {
        // Waiting for the store to reply.
        public const string Open = "Open";
        // The store replied and is waiting for the customer.
        public const string AwaitingCustomer = "AwaitingCustomer";
        public const string Resolved = "Resolved";
        public const string Closed = "Closed";

        public static readonly string[] All = { Open, AwaitingCustomer, Resolved, Closed };

        // Still being handled - blocks e.g. account deletion, counts for the nav badge.
        public static readonly string[] Active = { Open, AwaitingCustomer };

        public static string Label(string status) => status == AwaitingCustomer ? "Awaiting your reply" : status;
    }

    public static class TicketCategories
    {
        public static readonly IReadOnlyDictionary<string, string> Labels = new Dictionary<string, string>
        {
            ["OrderStatus"] = "Where is my order?",
            ["DamagedOrWrong"] = "Damaged, wrong or missing item",
            ["Payment"] = "Payment or refund",
            ["CancelOrChange"] = "Cancel or change my order",
            ["Product"] = "Product question",
            ["Account"] = "My account",
            ["Other"] = "Something else"
        };

        public const string Pattern = "^(OrderStatus|DamagedOrWrong|Payment|CancelOrChange|Product|Account|Other)$";

        public static string Label(string category) => Labels.TryGetValue(category, out var label) ? label : category;
    }

    public static class SupportPolicy
    {
        // Promised first-reply time, shown to customers and used to flag overdue tickets.
        public const int ReplyWithinHours = 24;

        // Resolved tickets close themselves after this; until then the customer can reopen by replying.
        public const int AutoCloseAfterDays = 7;

        // Stops one customer flooding the inbox.
        public const int MaxActiveTicketsPerUser = 5;

        public const int MaxPhotosPerMessage = 3;

        // An admin may edit or delete their own reply to the customer for this
        // long (the email has already gone out, so later the history stays as
        // sent). Internal notes can be changed any time.
        public const int EditWindowMinutes = 15;

        public static bool CanModify(Models.TicketMessage message, int adminUserId, DateTime now) =>
            message.IsFromAdmin
            && message.DeletedAt == null
            && message.SenderUserId == adminUserId
            && (message.IsInternal || message.CreatedAt >= now.AddMinutes(-EditWindowMinutes));

        // A reply / resolution email is skipped when the customer was already
        // emailed about the ticket this recently and hasn't replied since.
        // The message and bell notification are never skipped.
        public const int EmailThrottleMinutes = 10;

        public static bool ShouldEmailCustomer(Models.SupportTicket ticket, DateTime now)
        {
            if (ticket.CustomerEmailedAt == null || ticket.CustomerEmailedAt < now.AddMinutes(-EmailThrottleMinutes))
            {
                return true;
            }

            // The customer wrote back after our last email: they're in the conversation, so email again.
            var lastCustomerMessage = ticket.Messages
                .Where(m => !m.IsFromAdmin)
                .Select(m => (DateTime?)m.CreatedAt)
                .Max();
            return lastCustomerMessage != null && lastCustomerMessage > ticket.CustomerEmailedAt;
        }

        public const string UrlFolder = "/uploads/support/";

        public static string Folder(string contentRoot) =>
            Path.Combine(contentRoot, "wwwroot", "uploads", "support");
    }
}
