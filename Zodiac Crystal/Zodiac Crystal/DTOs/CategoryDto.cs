namespace Zodiac_Crystal.DTOs
{
    public class CategoryDto
    {
        public int CategoryId { get; set; }

        public string Name { get; set; } = null!;

        public string? Description { get; set; }

        public int? ParentCategoryId { get; set; }

        public bool IsActive { get; set; }
    }
}