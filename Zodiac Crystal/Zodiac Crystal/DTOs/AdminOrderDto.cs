namespace Zodiac_Crystal.DTOs
{
    public class AdminOrderDto
    {
        public int OrderId { get; set; }

        public string CustomerName { get; set; } = null!;

        public string CustomerEmail { get; set; } = null!;

        public DateTime OrderDate { get; set; }

        public decimal TotalAmount { get; set; }

        public string? CouponCode { get; set; }

        public decimal DiscountAmount { get; set; }

        public decimal ShippingFee { get; set; }

        public string Status { get; set; } = null!;

        public string PaymentMethod { get; set; } = null!;

        public string PaymentStatus { get; set; } = null!;
    }
}
