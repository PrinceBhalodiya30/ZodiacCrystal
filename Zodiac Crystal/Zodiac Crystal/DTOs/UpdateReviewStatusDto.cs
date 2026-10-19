using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class UpdateReviewStatusDto
    {
        [Required]
        public string Status { get; set; } = null!;
    }
}
