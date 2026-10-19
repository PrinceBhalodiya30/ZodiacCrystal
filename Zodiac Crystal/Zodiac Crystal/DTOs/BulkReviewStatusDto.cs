using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class BulkReviewStatusDto
    {
        [Required]
        public List<int> ReviewIds { get; set; } = new();

        [Required]
        public string Status { get; set; } = null!;
    }
}
