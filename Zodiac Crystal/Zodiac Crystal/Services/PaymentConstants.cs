namespace Zodiac_Crystal.Services
{
    public static class PaymentMethods
    {
        public const string Card = "Card";
        public const string CashOnDelivery = "COD";
    }

    public static class PaymentStatuses
    {
        // COD not yet collected (or a card order mid-checkout - never committed).
        public const string Pending = "Pending";

        // Card captured by Braintree, or COD collected on delivery.
        public const string Paid = "Paid";

        // Card payment returned to the customer after cancellation.
        public const string Refunded = "Refunded";

        // COD order cancelled before any money changed hands.
        public const string Cancelled = "Cancelled";
    }

    // One place for how a payment is described to people, so the invoice PDF,
    // order emails and CSV export always use the same wording.
    public static class PaymentLabels
    {
        public static string Method(string paymentMethod) =>
            paymentMethod == PaymentMethods.Card ? "Card (online)" : "Cash on Delivery";

        public static string Describe(Models.Order order) => (order.PaymentMethod, order.PaymentStatus) switch
        {
            (PaymentMethods.Card, PaymentStatuses.Paid) => "Paid by card",
            (PaymentMethods.Card, PaymentStatuses.Refunded) => "Card payment refunded",
            (PaymentMethods.CashOnDelivery, PaymentStatuses.Paid) => "Cash on Delivery (paid)",
            (PaymentMethods.CashOnDelivery, PaymentStatuses.Cancelled) => "Cash on Delivery (cancelled)",
            (PaymentMethods.CashOnDelivery, PaymentStatuses.Refunded) => "Cash on Delivery (refunded)",
            (PaymentMethods.CashOnDelivery, _) => "Cash on Delivery",
            _ => order.PaymentStatus
        };
    }
}
