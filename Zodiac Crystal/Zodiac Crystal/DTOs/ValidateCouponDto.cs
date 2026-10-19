using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class ValidateCouponDto
    {
        [Required]
        [StringLength(50)]
        public string Code { get; set; } = null!;

        [Range(0, double.MaxValue)]
        public decimal OrderAmount { get; set; }
    }
}
