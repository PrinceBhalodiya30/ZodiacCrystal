using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

// One-time "this wasn't me" link emailed to the old address after an email change.
// Only the hash of the link's token is stored.
public partial class EmailChangeRevert
{
    [Key]
    public int RevertId { get; set; }

    public int UserId { get; set; }

    [StringLength(256)]
    public string OldEmail { get; set; } = null!;

    [StringLength(256)]
    public string NewEmail { get; set; } = null!;

    [MaxLength(32)]
    public byte[] TokenHash { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime? UsedAt { get; set; }

    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;
}
