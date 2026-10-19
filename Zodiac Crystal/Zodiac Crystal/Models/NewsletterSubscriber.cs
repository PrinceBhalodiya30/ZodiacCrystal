using System;
using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.Models;

public partial class NewsletterSubscriber
{
    [Key]
    public int NewsletterSubscriberId { get; set; }

    [StringLength(256)]
    public string Email { get; set; } = null!;

    public DateTime SubscribedAt { get; set; }

    // Unsubscribed people stay in the table (inactive) as proof they opted out.
    public bool IsActive { get; set; } = true;

    public DateTime? UnsubscribedAt { get; set; }

    // Secret for the subscriber's one-click unsubscribe link.
    [StringLength(64)]
    public string UnsubscribeToken { get; set; } = null!;
}
