namespace Zodiac_Crystal.DTOs
{
    public class CouponValidationResultDto
    {
        public bool Valid { get; set; }

        public string? Code { get; set; }

        public decimal DiscountAmount { get; set; }

        public string Message { get; set; } = null!;
    }
}
