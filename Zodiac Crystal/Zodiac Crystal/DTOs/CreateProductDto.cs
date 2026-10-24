using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class CreateProductDto
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

        [Range(0, int.MaxValue)]
        public int StockQuantity { get; set; }

        [Range(1, int.MaxValue)]
        public int CategoryId { get; set; }

        public bool IsActive { get; set; } = true;

        public List<int> ZodiacIds { get; set; } = new();
    }
}
