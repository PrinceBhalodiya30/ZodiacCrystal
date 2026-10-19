using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class CancelOrderDto
    {
        // One of CancellationReasons.All.
        [StringLength(100)]
        public string? Reason { get; set; }
    }
}
