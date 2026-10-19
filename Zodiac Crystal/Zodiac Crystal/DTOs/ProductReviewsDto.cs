namespace Zodiac_Crystal.DTOs
{
    public class ProductReviewsDto
    {
        public double AverageRating { get; set; }

        public int ReviewCount { get; set; }

        public List<ReviewDto> Reviews { get; set; } = new();
    }
}
