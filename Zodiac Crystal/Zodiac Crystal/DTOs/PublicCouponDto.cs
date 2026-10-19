namespace Zodiac_Crystal.DTOs
{
    // Deliberately excludes UsageLimit/UsedCount/CreatedAt - those are internal
    // admin bookkeeping, not something a shopper browsing available coupons needs.
    public class PublicCouponDto
    {
        public string Code { get; set; } = null!;

        public string? Description { get; set; }

        public string DiscountType { get; set; } = null!;

        public decimal DiscountValue { get; set; }

        public decimal MinimumOrderAmount { get; set; }

        public DateTime EndDate { get; set; }
    }
}
