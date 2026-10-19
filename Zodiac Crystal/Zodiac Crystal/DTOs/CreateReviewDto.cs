using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class CreateReviewDto
    {
        [Required]
        [Range(1, 5)]
        public int Rating { get; set; }

        [StringLength(1000)]
        public string? Comment { get; set; }
    }
}
