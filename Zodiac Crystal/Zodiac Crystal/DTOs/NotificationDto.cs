namespace Zodiac_Crystal.DTOs
{
    public class NotificationDto
    {
        public int NotificationId { get; set; }
        public int? OrderId { get; set; }
        public string? CouponCode { get; set; }

        // Back-in-stock and price-drop notifications open this product.
        public int? ProductId { get; set; }
        public string Title { get; set; } = null!;
        public string Message { get; set; } = null!;
        public string Type { get; set; } = null!;
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
