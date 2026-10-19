namespace Zodiac_Crystal.DTOs
{
    public class WishlistItemDto
    {
        public int ProductId { get; set; }

        public string ProductName { get; set; } = null!;

        public decimal Price { get; set; }

        public string? PrimaryImageUrl { get; set; }

        public int StockQuantity { get; set; }

        public bool IsActive { get; set; }

        public DateTime AddedAt { get; set; }
    }
}
