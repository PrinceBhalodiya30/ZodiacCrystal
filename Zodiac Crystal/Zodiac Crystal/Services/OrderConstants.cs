using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    // Why a customer cancelled their own order. Stored as the label itself.
    public static class CancellationReasons
    {
        public static readonly string[] All =
        {
            "Ordered by mistake",
            "Found a better price elsewhere",
            "Delivery is taking too long",
            "Want to change items or address",
            "No longer needed",
            "Other"
        };
    }

    // A calculated estimate, not courier data: business days after shipping
    // (or after the order, before it ships). Matches the "few business days"
    // promise on the Shipping & Returns page.
    public static class DeliveryEstimate
    {
        public const int ShippedMinDays = 3;
        public const int ShippedMaxDays = 5;
        public const int UnshippedMinDays = 5;
        public const int UnshippedMaxDays = 8;

        // Null once the order is delivered or cancelled.
        public static (DateTime From, DateTime To)? Window(Order order)
        {
            if (order.Status == "Delivered" || order.Status == "Cancelled")
            {
                return null;
            }

            return order.ShippedAt is DateTime shippedAt
                ? (AddBusinessDays(shippedAt, ShippedMinDays), AddBusinessDays(shippedAt, ShippedMaxDays))
                : (AddBusinessDays(order.OrderDate, UnshippedMinDays), AddBusinessDays(order.OrderDate, UnshippedMaxDays));
        }

        private static DateTime AddBusinessDays(DateTime start, int days)
        {
            var date = start.Date;
            while (days > 0)
            {
                date = date.AddDays(1);
                if (date.DayOfWeek != DayOfWeek.Saturday && date.DayOfWeek != DayOfWeek.Sunday)
                {
                    days--;
                }
            }
            return date;
        }
    }
}
