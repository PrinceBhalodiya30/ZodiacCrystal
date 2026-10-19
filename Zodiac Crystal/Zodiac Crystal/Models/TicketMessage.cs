using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

// One message in a support ticket. IsInternal messages are admin-only notes.
public partial class TicketMessage
{
    [Key]
    public int TicketMessageId { get; set; }

    public int SupportTicketId { get; set; }

    public int SenderUserId { get; set; }

    public bool IsFromAdmin { get; set; }

    public bool IsInternal { get; set; }

    [StringLength(2000)]
    public string Body { get; set; } = null!;

    // Photo URLs separated by '|'.
    [StringLength(1600)]
    public string? AttachmentUrls { get; set; }

    public DateTime CreatedAt { get; set; }

    // Set when an admin edits / (soft) deletes their own message.
    public DateTime? EditedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    [ForeignKey("SupportTicketId")]
    public virtual SupportTicket SupportTicket { get; set; } = null!;

    [ForeignKey("SenderUserId")]
    public virtual User Sender { get; set; } = null!;
}
