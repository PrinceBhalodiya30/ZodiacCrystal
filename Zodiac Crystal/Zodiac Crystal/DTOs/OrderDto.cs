namespace Zodiac_Crystal.DTOs
{
    public class OrderDto
    {
        public int OrderId { get; set; }

        public DateTime OrderDate { get; set; }

        public decimal TotalAmount { get; set; }

        public string Status { get; set; } = null!;

        public string ShippingName { get; set; } = null!;

        public string ShippingEmail { get; set; } = null!;

        public string ShippingAddress { get; set; } = null!;

        public string City { get; set; } = null!;

        public string State { get; set; } = null!;

        public string PostalCode { get; set; } = null!;

        public string Phone { get; set; } = null!;

        public decimal? Latitude { get; set; }

        public decimal? Longitude { get; set; }

        public string? CouponCode { get; set; }

        public decimal DiscountAmount { get; set; }

        public decimal ShippingFee { get; set; }

        public string PaymentMethod { get; set; } = null!;

        public string PaymentStatus { get; set; } = null!;

        public DateTime? PaidAt { get; set; }

        public DateTime? ConfirmedAt { get; set; }

        public DateTime? ShippedAt { get; set; }

        public string? CourierName { get; set; }

        public string? TrackingNumber { get; set; }

        public DateTime? DeliveredAt { get; set; }

        // Calculated (see DeliveryEstimate); null once delivered or cancelled.
        public DateTime? EstimatedDeliveryFrom { get; set; }

        public DateTime? EstimatedDeliveryTo { get; set; }

        public string? CancellationReason { get; set; }

        // Returns: the existing request's status (null if none), and whether the
        // customer can still request one (delivered, paid, within the window).
        public string? ReturnStatus { get; set; }

        public string? ReturnAdminNote { get; set; }

        public bool CanRequestReturn { get; set; }

        public DateTime? ReturnWindowEndsAt { get; set; }

        public List<OrderItemDto> Items { get; set; } = new();
    }
}
