using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

// Server copy of a signed-in customer's cart, used only for abandoned-cart reminders.
// The browser's cart stays the source of truth.
public partial class SavedCart
{
    [Key]
    public int UserId { get; set; }

    // [{"productId":1,"quantity":2}, ...]
    public string ItemsJson { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }

    public DateTime? ReminderSentAt { get; set; }

    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;
}
