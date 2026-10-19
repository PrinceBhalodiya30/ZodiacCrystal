using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

// A card charge that went through for an order that then failed to save, and
// whose automatic reversal also failed. Staff refund it by hand, then mark it
// Resolved. No foreign keys, so the record outlives the user or order.
public partial class PaymentFailure
{
    [Key]
    public int Id { get; set; }

    // Null when the order was rolled back and so never existed.
    public int? OrderId { get; set; }

    public int UserId { get; set; }

    [StringLength(64)]
    public string TransactionId { get; set; } = null!;

    [Column(TypeName = "decimal(18, 2)")]
    public decimal Amount { get; set; }

    [StringLength(500)]
    public string Reason { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public bool Resolved { get; set; }

    public DateTime? ResolvedAt { get; set; }
}
