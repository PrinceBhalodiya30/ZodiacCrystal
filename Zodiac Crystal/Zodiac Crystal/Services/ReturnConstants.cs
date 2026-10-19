namespace Zodiac_Crystal.Services
{
    public static class ReturnStatuses
    {
        public const string Requested = "Requested";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";
        public const string Refunded = "Refunded";

        // Still being handled - blocks e.g. account deletion.
        public static readonly string[] Open = { Requested, Approved };
    }

    public static class ReturnReasons
    {
        public static readonly IReadOnlyDictionary<string, string> Labels = new Dictionary<string, string>
        {
            ["Damaged"] = "Item arrived damaged",
            ["WrongItem"] = "Received the wrong item",
            ["NotAsDescribed"] = "Not as described",
            ["ChangedMind"] = "Changed my mind",
            ["Other"] = "Other"
        };

        public static string Label(string reason) => Labels.TryGetValue(reason, out var label) ? label : reason;
    }

    public static class ReturnPolicy
    {
        // Days after delivery during which a customer may request a return.
        public const int WindowDays = 7;

        // Null when the order can't be returned at all (not delivered / not paid).
        public static DateTime? WindowEndsAt(Models.Order order) =>
            order.Status == "Delivered" && order.PaymentStatus == PaymentStatuses.Paid && order.DeliveredAt != null
                ? order.DeliveredAt.Value.AddDays(WindowDays)
                : null;
    }

    public static class StockRules
    {
        // Matches the storefront's "Only N left" label and the stock CSV's "Low Stock".
        public const int LowStockThreshold = 5;
    }
}
