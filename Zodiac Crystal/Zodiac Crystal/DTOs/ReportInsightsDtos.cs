namespace Zodiac_Crystal.DTOs
{
    public class ZodiacSalesDto
    {
        public int ZodiacId { get; set; }
        public string ZodiacName { get; set; } = null!;
        public string? Symbol { get; set; }
        public int QuantitySold { get; set; }
        public decimal Revenue { get; set; }

        public string VedicRashi => ZodiacName switch
        {
            "Aries" => "Mesha (मेष)",
            "Taurus" => "Vrishabha (वृषभ)",
            "Gemini" => "Mithuna (मिथुन)",
            "Cancer" => "Karka (कर्क)",
            "Leo" => "Simha (सिंह)",
            "Virgo" => "Kanya (कन्या)",
            "Libra" => "Tula (तुला)",
            "Scorpio" => "Vrishchika (वृश्चिक)",
            "Sagittarius" => "Dhanu (धनु)",
            "Capricorn" => "Makara (मकर)",
            "Aquarius" => "Kumbha (कुंभ)",
            "Pisces" => "Meena (मीन)",
            _ => string.Empty
        };

        public string DisplayName => string.IsNullOrEmpty(VedicRashi) ? ZodiacName : $"{ZodiacName} · {VedicRashi}";
    }

    public class CouponPerformanceDto
    {
        public string Code { get; set; } = null!;
        public int OrderCount { get; set; }
        public decimal DiscountGiven { get; set; }
        // Order totals (after the discount) of the orders that used the coupon.
        public decimal Sales { get; set; }
        public bool IsActive { get; set; }
    }

    public class UnsoldProductDto
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = null!;
        public string Sku { get; set; } = null!;
        public string CategoryName { get; set; } = null!;
        public int StockQuantity { get; set; }
        public decimal Price { get; set; }
    }

    public class UnsoldProductsDto
    {
        public int TotalCount { get; set; }
        public List<UnsoldProductDto> Items { get; set; } = new();
    }

    // Dashboard "Store insights": orders placed in the range, by current status,
    // payment method and (for customer cancellations) reason.
    public class OrderInsightsDto
    {
        public List<StatusCountDto> StatusCounts { get; set; } = new();
        public List<PaymentMethodSalesDto> PaymentMethods { get; set; } = new();
        public List<CancellationReasonCountDto> CancellationReasons { get; set; } = new();

        // Not range-bound: orders still Shipped longer than the delivery estimate.
        public int OverdueDeliveries { get; set; }
    }

    public class StatusCountDto
    {
        public string Status { get; set; } = null!;
        public int Count { get; set; }
    }

    public class PaymentMethodSalesDto
    {
        public string Method { get; set; } = null!;
        public int Orders { get; set; }
        // Same revenue rule as the rest of the reports (not cancelled, not refunded).
        public decimal Revenue { get; set; }
    }

    public class CancellationReasonCountDto
    {
        public string Reason { get; set; } = null!;
        public int Count { get; set; }
    }
}
