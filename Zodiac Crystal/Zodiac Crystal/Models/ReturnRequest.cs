using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

// A customer's request to return a delivered order. Lifecycle (see ReturnStatuses):
// Requested -> Approved -> Refunded, or Requested -> Rejected. One per order.
public partial class ReturnRequest
{
    [Key]
    public int ReturnRequestId { get; set; }

    public int OrderId { get; set; }

    public int UserId { get; set; }

    [StringLength(30)]
    public string Reason { get; set; } = null!;

    [StringLength(1000)]
    public string? Details { get; set; }

    [StringLength(20)]
    public string Status { get; set; } = "Requested";

    [StringLength(500)]
    public string? AdminNote { get; set; }

    // Whether the returned items were put back into stock when refunded.
    public bool Restocked { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    [ForeignKey("OrderId")]
    public virtual Order Order { get; set; } = null!;

    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;
}
