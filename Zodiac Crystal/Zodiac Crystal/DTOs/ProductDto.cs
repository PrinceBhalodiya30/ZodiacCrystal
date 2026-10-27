namespace Zodiac_Crystal.DTOs
{
    public class ProductDto
    {
        public int ProductId { get; set; }

        public string SKU { get; set; } = null!;

        public string Name { get; set; } = null!;

        public string? Description { get; set; }

        public decimal Price { get; set; }

        public decimal? CompareAtPrice { get; set; }

        public string? WaterSafe { get; set; }

        public string? SunlightExposure { get; set; }

        public string? Chakra { get; set; }

        public string? Element { get; set; }

        public string? MarketingBadge { get; set; }

        public int StockQuantity { get; set; }

        public int CategoryId { get; set; }

        public string? CategoryName { get; set; }

        public bool IsActive { get; set; }

        public DateTime CreatedAt { get; set; }

        public double? AverageRating { get; set; }

        public int ReviewCount { get; set; }

        public List<ProductImageDto> Images { get; set; } = new();

        public List<ZodiacDto> Zodiacs { get; set; } = new();
    }
}