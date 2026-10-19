using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

public partial class AuditLog
{
    [Key]
    public int AuditLogId { get; set; }

    public int AdminUserId { get; set; }

    // e.g. "OrderStatusChanged", "CouponCreated", "CouponUpdated", "CouponDeleted",
    // "UserDeactivated", "UserActivated", "ReviewDeleted"
    [StringLength(50)]
    public string Action { get; set; } = null!;

    // e.g. "Order", "Coupon", "User", "Review"
    [StringLength(50)]
    public string EntityType { get; set; } = null!;

    public int? EntityId { get; set; }

    // Short human-readable summary, e.g. "Pending -> Confirmed" or "Code: WELCOME10".
    // Deliberately not a full before/after diff - this is meant to answer "what
    // happened", not to be a complete change-history system.
    [StringLength(500)]
    public string? Details { get; set; }

    public DateTime CreatedAt { get; set; }

    [ForeignKey("AdminUserId")]
    public virtual User AdminUser { get; set; } = null!;
}
