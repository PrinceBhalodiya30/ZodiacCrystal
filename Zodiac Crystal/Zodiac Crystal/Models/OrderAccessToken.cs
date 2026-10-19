using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

// A secure "view your order" link emailed to a guest. Only the SHA-256 hash of
// the random token is stored; the link stops working after ExpiresAt or once revoked.
public partial class OrderAccessToken
{
    [Key]
    public int OrderAccessTokenId { get; set; }

    public int OrderId { get; set; }

    [StringLength(64)]
    public string TokenHash { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime? LastUsedAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    [ForeignKey("OrderId")]
    public virtual Order Order { get; set; } = null!;
}
