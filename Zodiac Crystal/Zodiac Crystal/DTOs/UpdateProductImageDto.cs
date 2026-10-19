using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class UpdateProductImageDto
    {
        [Range(1, int.MaxValue)]
        public int ProductId { get; set; }

        [Required]
        [StringLength(2000)]
        [Url(ErrorMessage = "ImageUrl must be a valid URL")]
        public string ImageUrl { get; set; } = null!;

        public bool IsPrimary { get; set; }
    }
}
