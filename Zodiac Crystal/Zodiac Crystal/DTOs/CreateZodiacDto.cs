using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class CreateZodiacDto
    {
        [Required]
        [StringLength(50)]
        public string Name { get; set; } = null!;

        [StringLength(10)]
        public string? Symbol { get; set; }

        [StringLength(500)]
        public string? Description { get; set; }

        [StringLength(500)]
        [Url(ErrorMessage = "ImageUrl must be a valid URL")]
        public string? ImageUrl { get; set; }
    }
}
