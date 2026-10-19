namespace Zodiac_Crystal.DTOs
{
    public class CouponDto
    {
        public int CouponId { get; set; }

        public string Code { get; set; } = null!;

        public string? Description { get; set; }

        public string DiscountType { get; set; } = null!;

        public decimal DiscountValue { get; set; }

        public decimal MinimumOrderAmount { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        public int UsageLimit { get; set; }

        public int UsedCount { get; set; }

        public int? MaxUsesPerUser { get; set; }

        public bool IsActive { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? NotifiedAt { get; set; }
    }
}
