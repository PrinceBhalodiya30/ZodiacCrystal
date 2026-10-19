using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

// A Help Center conversation between a customer and the store, optionally about
// one order. Lifecycle (see TicketStatuses): Open <-> AwaitingCustomer ->
// Resolved -> Closed. Messages live in TicketMessage.
public partial class SupportTicket
{
    [Key]
    public int SupportTicketId { get; set; }

    public int UserId { get; set; }

    public int? OrderId { get; set; }

    [StringLength(30)]
    public string Category { get; set; } = null!;

    [StringLength(150)]
    public string Subject { get; set; } = null!;

    [StringLength(20)]
    public string Status { get; set; } = "Open";

    // The latest message hasn't been read by that side yet.
    public bool CustomerUnread { get; set; }

    public bool AdminUnread { get; set; } = true;

    // 1-5 stars, given by the customer once the ticket is resolved.
    public byte? Rating { get; set; }

    [StringLength(500)]
    public string? RatingComment { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime LastMessageAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public DateTime? ClosedAt { get; set; }

    // Last reply / resolution email to the customer (not the confirmation).
    // Used to throttle repeated emails; see SupportPolicy.EmailThrottleMinutes.
    public DateTime? CustomerEmailedAt { get; set; }

    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;

    [ForeignKey("OrderId")]
    public virtual Order? Order { get; set; }

    public virtual ICollection<TicketMessage> Messages { get; set; } = new List<TicketMessage>();
}
