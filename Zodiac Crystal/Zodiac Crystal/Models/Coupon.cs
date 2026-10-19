using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

public partial class Coupon
{
    [Key]
    public int CouponId { get; set; }

    [StringLength(50)]
    public string Code { get; set; } = null!;

    [StringLength(500)]
    public string? Description { get; set; }

    [StringLength(20)]
    public string DiscountType { get; set; } = null!;

    [Column(TypeName = "decimal(10, 2)")]
    public decimal DiscountValue { get; set; }

    [Column(TypeName = "decimal(10, 2)")]
    public decimal MinimumOrderAmount { get; set; }

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }

    public int UsageLimit { get; set; }

    public int UsedCount { get; set; }

    // How many orders one customer may place with this coupon; null = no per-customer limit.
    public int? MaxUsesPerUser { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    // When customers were notified about this coupon (null = never).
    public DateTime? NotifiedAt { get; set; }
}
