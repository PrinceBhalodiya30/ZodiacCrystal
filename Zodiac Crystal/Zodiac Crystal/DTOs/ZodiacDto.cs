namespace Zodiac_Crystal.DTOs
{
    public class ZodiacDto
    {
        public int ZodiacId { get; set; }

        public string Name { get; set; } = null!;

        public string? Symbol { get; set; }

        public string? Description { get; set; }

        public string? ImageUrl { get; set; }
    }
}