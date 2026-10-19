namespace Zodiac_Crystal.DTOs
{
    public class OrderSummaryDto
    {
        public int OrderId { get; set; }

        public DateTime OrderDate { get; set; }

        public decimal TotalAmount { get; set; }

        public string Status { get; set; } = null!;

        public string PaymentMethod { get; set; } = null!;

        public string PaymentStatus { get; set; } = null!;

        public string? TrackingNumber { get; set; }

        public DateTime? DeliveredAt { get; set; }

        public DateTime? ShippedAt { get; set; }

        public List<string> ProductNames { get; set; } = new();

        // Lines for the My Orders card (thumbnails + names), in order-item order.
        public List<OrderSummaryItemDto> Items { get; set; } = new();
    }

    public class OrderSummaryItemDto
    {
        public int ProductId { get; set; }

        public string ProductName { get; set; } = null!;

        public int Quantity { get; set; }

        public decimal UnitPrice { get; set; }

        public decimal Subtotal { get; set; }

        public string? ImageUrl { get; set; }
    }
}
