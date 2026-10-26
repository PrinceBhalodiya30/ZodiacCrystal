using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class UpdateZodiacDto
    {
        [Required]
        [StringLength(50)]
        public string Name { get; set; } = null!;

        [StringLength(100)]
        public string? RashiName { get; set; }

        [StringLength(255)]
        public string? Symbol { get; set; }

        [StringLength(500)]
        public string? Description { get; set; }

        [StringLength(500)]
        public string? ImageUrl { get; set; }
    }
}
