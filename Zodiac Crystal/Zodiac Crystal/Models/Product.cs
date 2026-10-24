using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Zodiac_Crystal.Models;

[Index("Sku", Name = "UQ__Products__CA1ECF0D4A82C034", IsUnique = true)]
public partial class Product
{
    [Key]
    public int ProductId { get; set; }

    [Column("SKU")]
    [StringLength(50)]
    public string Sku { get; set; } = null!;

    [StringLength(150)]
    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    [Column(TypeName = "decimal(10, 2)")]
    public decimal Price { get; set; }

    // The "was" price shown struck through next to Price when set and higher
    // than Price - purely a display/marketing field, never used in totals or
    // discount calculations (coupons/loyalty points still apply off Price).
    [Column(TypeName = "decimal(10, 2)")]
    public decimal? CompareAtPrice { get; set; }

    [StringLength(200)]
    public string? WaterSafe { get; set; }

    [StringLength(200)]
    public string? SunlightExposure { get; set; }

    [StringLength(150)]
    public string? Chakra { get; set; }

    [StringLength(100)]
    public string? Element { get; set; }

    public int StockQuantity { get; set; }

    public int CategoryId { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    [ForeignKey("CategoryId")]
    [InverseProperty("Products")]
    public virtual Category Category { get; set; } = null!;

    [InverseProperty("Product")]
    public virtual ICollection<ProductImage> ProductImages { get; set; } = new List<ProductImage>();

    [ForeignKey("ProductId")]
    [InverseProperty("Products")]
    public virtual ICollection<ZodiacSign> Zodiacs { get; set; } = new List<ZodiacSign>();
}
