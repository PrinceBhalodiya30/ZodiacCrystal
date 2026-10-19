using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class UpdateReviewReplyDto
    {
        [StringLength(1000)]
        public string? Reply { get; set; }
    }
}
