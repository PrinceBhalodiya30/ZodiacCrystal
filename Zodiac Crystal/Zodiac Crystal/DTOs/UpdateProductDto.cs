using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class UpdateProductDto
    {
        [Required]
        [StringLength(50)]
        public string SKU { get; set; } = null!;

        [Required]
        [StringLength(150)]
        public string Name { get; set; } = null!;

        public string? Description { get; set; }

        [Range(0.01, double.MaxValue, ErrorMessage = "Price must be greater than 0")]
        public decimal Price { get; set; }

        [Range(0.01, double.MaxValue, ErrorMessage = "Compare-at price must be greater than 0")]
        public decimal? CompareAtPrice { get; set; }

        [StringLength(200)]
        public string? WaterSafe { get; set; }

        [StringLength(200)]
        public string? SunlightExposure { get; set; }

        [StringLength(150)]
        public string? Chakra { get; set; }

        [StringLength(100)]
        public string? Element { get; set; }

        [StringLength(50)]
        public string? MarketingBadge { get; set; }

        // No StockQuantity: saving a stock number read when the form opened would
        // erase any orders placed since. Stock changes go through adjust-stock,
        // which applies a delta to the current value instead.

        [Range(1, int.MaxValue)]
        public int CategoryId { get; set; }

        public bool IsActive { get; set; }

        public List<int> ZodiacIds { get; set; } = new();
    }
}
