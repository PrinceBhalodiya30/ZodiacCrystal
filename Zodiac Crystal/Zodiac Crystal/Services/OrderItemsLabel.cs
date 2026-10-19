using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    // Short product-based name for an order in notifications and email
    // subjects: "Amethyst Bracelet" or "Amethyst Bracelet + 2 more items".
    // Returns null when no product names are available, so callers can fall
    // back to the plain "Order #12" wording.
    public static class OrderItemsLabel
    {
        public static string? Describe(Order order) =>
            Describe(order.OrderItems.OrderBy(i => i.OrderItemId).Select(i => i.Product?.Name));

        public static string? Describe(IEnumerable<string?> productNames)
        {
            var names = productNames
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .Select(n => n!.Trim())
                .Distinct()
                .ToList();

            return names.Count switch
            {
                0 => null,
                1 => names[0],
                2 => $"{names[0]} + 1 more item",
                _ => $"{names[0]} + {names.Count - 1} more items"
            };
        }

        // "is" for a single product, "are" when the label lists several.
        public static string Verb(string label) => label.Contains(" + ") ? "are" : "is";
    }
}
