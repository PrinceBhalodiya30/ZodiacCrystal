using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class UpdateOrderStatusDto
    {
        [Required]
        [StringLength(20)]
        [RegularExpression("^(Pending|Confirmed|Shipped|Delivered|Cancelled)$", ErrorMessage = "Status must be one of: Pending, Confirmed, Shipped, Delivered, Cancelled")]
        public string Status { get; set; } = null!;

        // Only used when Status is Shipped. A blank tracking number is generated.
        [StringLength(50)]
        public string? CourierName { get; set; }

        [StringLength(50)]
        public string? TrackingNumber { get; set; }
    }
}
