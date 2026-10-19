using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class UpdateCouponDto : IValidatableObject
    {
        [Required]
        [StringLength(50)]
        public string Code { get; set; } = null!;

        [StringLength(500)]
        public string? Description { get; set; }

        [Required]
        [RegularExpression("^(Percentage|Fixed)$", ErrorMessage = "DiscountType must be 'Percentage' or 'Fixed'")]
        public string DiscountType { get; set; } = null!;

        [Range(0.01, double.MaxValue, ErrorMessage = "DiscountValue must be greater than 0")]
        public decimal DiscountValue { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "MinimumOrderAmount must be 0 or greater")]
        public decimal MinimumOrderAmount { get; set; }

        [Required]
        public DateTime StartDate { get; set; }

        [Required]
        public DateTime EndDate { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "UsageLimit must be at least 1")]
        public int UsageLimit { get; set; }

        // Optional: how many orders one customer may use this coupon on. Empty = no limit.
        [Range(1, int.MaxValue, ErrorMessage = "Max uses per customer must be at least 1, or left empty")]
        public int? MaxUsesPerUser { get; set; }

        public bool IsActive { get; set; }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            if (DiscountType == "Percentage" && DiscountValue > 100)
            {
                yield return new ValidationResult(
                    "DiscountValue cannot exceed 100 when DiscountType is 'Percentage'",
                    new[] { nameof(DiscountValue) });
            }

            if (EndDate <= StartDate)
            {
                yield return new ValidationResult(
                    "EndDate must be after StartDate",
                    new[] { nameof(EndDate) });
            }
        }
    }
}
