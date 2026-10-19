using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

public partial class Notification
{
    [Key]
    public int NotificationId { get; set; }

    public int UserId { get; set; }

    public int? OrderId { get; set; }

    // Set on "Coupon" notifications only.
    public int? CouponId { get; set; }

    // Set on "BackInStock" / "PriceDrop" notifications: the product to open.
    public int? ProductId { get; set; }

    [StringLength(150)]
    public string Title { get; set; } = null!;

    [StringLength(500)]
    public string Message { get; set; } = null!;

    // e.g. "OrderPlaced", "OrderStatusChanged", "Coupon"
    [StringLength(30)]
    public string Type { get; set; } = null!;

    public bool IsRead { get; set; }

    public DateTime CreatedAt { get; set; }

    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;

    [ForeignKey("OrderId")]
    public virtual Order? Order { get; set; }

    [ForeignKey("CouponId")]
    public virtual Coupon? Coupon { get; set; }

    [ForeignKey("ProductId")]
    public virtual Product? Product { get; set; }
}
