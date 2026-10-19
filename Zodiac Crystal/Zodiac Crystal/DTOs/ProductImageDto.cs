namespace Zodiac_Crystal.DTOs
{
    public class ProductImageDto
    {
        public int ProductImageId { get; set; }

        public int ProductId { get; set; }

        public string ImageUrl { get; set; } = null!;

        public bool IsPrimary { get; set; }
    }
}