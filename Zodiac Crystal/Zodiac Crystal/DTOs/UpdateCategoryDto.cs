using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class UpdateCategoryDto
    {
        [Required]
        [StringLength(100)]
        public string Name { get; set; } = null!;

        [StringLength(500)]
        public string? Description { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "ParentCategoryId must be a valid id")]
        public int? ParentCategoryId { get; set; }

        public bool IsActive { get; set; }
    }
}
