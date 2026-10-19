using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

public partial class RecentlyViewed
{
    [Key]
    public int RecentlyViewedId { get; set; }

    public int UserId { get; set; }

    public int ProductId { get; set; }

    public DateTime ViewedAt { get; set; }

    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;

    [ForeignKey("ProductId")]
    public virtual Product Product { get; set; } = null!;
}
