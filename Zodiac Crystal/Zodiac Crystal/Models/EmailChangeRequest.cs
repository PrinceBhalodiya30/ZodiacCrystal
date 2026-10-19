using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

// A requested-but-unconfirmed email change: one per user, replaced by a new request.
// Only the hash of the code sent to the new address is stored.
public partial class EmailChangeRequest
{
    [Key]
    public int UserId { get; set; }

    [StringLength(256)]
    public string NewEmail { get; set; } = null!;

    [MaxLength(32)]
    public byte[] OtpHash { get; set; } = null!;

    public DateTime SentAt { get; set; }

    public DateTime ExpiresAt { get; set; }

    public int FailedAttempts { get; set; }

    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;
}
