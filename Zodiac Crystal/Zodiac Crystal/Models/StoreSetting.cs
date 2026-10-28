using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

public partial class StoreSetting
{
    [Key]
    public int Id { get; set; }

    public bool AnnouncementEnabled { get; set; } = true;

    [StringLength(500)]
    public string AnnouncementText { get; set; } = "Free shipping on orders over ₹999 · Cash on Delivery available · 7-day returns";

    [StringLength(255)]
    public string? AnnouncementLink { get; set; }

    [StringLength(50)]
    public string AnnouncementStyle { get; set; } = "emerald";

    [Column(TypeName = "decimal(18, 2)")]
    public decimal FreeShippingThreshold { get; set; } = 999m;

    [Column(TypeName = "decimal(18, 2)")]
    public decimal FlatShippingRate { get; set; } = 50m;

    [StringLength(200)]
    public string HeroEyebrow { get; set; } = "Natural Minerals & Astrological Alignments";

    [StringLength(300)]
    public string HeroTitle { get; set; } = "Discover Crystals Aligned with Your Zodiac";

    [StringLength(1000)]
    public string HeroSubtitle { get; set; } = "Hand-selected crystals, raw clusters, polished towers, and gemstone jewelry intuitively paired to resonate with your astrological blueprint and daily intentions.";

    public bool MoonBannerEnabled { get; set; } = true;

    [StringLength(50)]
    public string MoonBannerMode { get; set; } = "auto";

    [StringLength(500)]
    public string? MoonBannerCustomText { get; set; }

    [StringLength(100)]
    public string? MoonBannerCustomCrystal { get; set; }

    [StringLength(200)]
    public string? MoonBannerCustomBenefit { get; set; }

    [StringLength(255)]
    public string? MoonBannerCustomLink { get; set; }

    public bool MoonBannerShowModal { get; set; } = true;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public int? UpdatedByUserId { get; set; }

    [ForeignKey(nameof(UpdatedByUserId))]
    public virtual User? UpdatedByUser { get; set; }
}

