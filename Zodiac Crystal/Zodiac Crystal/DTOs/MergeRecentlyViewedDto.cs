using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class MergeRecentlyViewedDto
    {
        // Product ids viewed as a guest, most recent first.
        [MaxLength(20)]
        public List<int> ProductIds { get; set; } = new();
    }
}
