using System;

namespace Zodiac_Crystal.DTOs;

public class StoreSettingsDto
{
    public int Id { get; set; }
    public bool AnnouncementEnabled { get; set; }
    public string AnnouncementText { get; set; } = string.Empty;
    public string? AnnouncementLink { get; set; }
    public string AnnouncementStyle { get; set; } = "emerald";
    public decimal FreeShippingThreshold { get; set; }
    public decimal FlatShippingRate { get; set; }
    public string HeroEyebrow { get; set; } = string.Empty;
    public string HeroTitle { get; set; } = string.Empty;
    public string HeroSubtitle { get; set; } = string.Empty;
    public bool MoonBannerEnabled { get; set; } = true;
    public string MoonBannerMode { get; set; } = "auto";
    public string? MoonBannerCustomText { get; set; }
    public string? MoonBannerCustomCrystal { get; set; }
    public string? MoonBannerCustomBenefit { get; set; }
    public string? MoonBannerCustomLink { get; set; }
    public bool MoonBannerShowModal { get; set; } = true;
    public DateTime UpdatedAt { get; set; }
    public string? UpdatedByEmail { get; set; }
}

public class UpdateStoreSettingsDto
{
    public bool AnnouncementEnabled { get; set; }

    public string AnnouncementText { get; set; } = string.Empty;

    public string? AnnouncementLink { get; set; }

    public string AnnouncementStyle { get; set; } = "emerald";

    public decimal FreeShippingThreshold { get; set; }

    public decimal FlatShippingRate { get; set; }

    public string HeroEyebrow { get; set; } = string.Empty;

    public string HeroTitle { get; set; } = string.Empty;

    public string HeroSubtitle { get; set; } = string.Empty;

    public bool MoonBannerEnabled { get; set; } = true;

    public string MoonBannerMode { get; set; } = "auto";

    public string? MoonBannerCustomText { get; set; }

    public string? MoonBannerCustomCrystal { get; set; }

    public string? MoonBannerCustomBenefit { get; set; }

    public string? MoonBannerCustomLink { get; set; }

    public bool MoonBannerShowModal { get; set; } = true;
}

