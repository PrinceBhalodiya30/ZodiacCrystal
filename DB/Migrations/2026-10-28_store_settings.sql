-- Migration: StoreSettings table for Store Announcement Bar, Shipping Rules, and Hero CMS
-- Allows merchants to customize live storefront banner, free shipping threshold, and hero copy without developer deployments.

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'StoreSettings'
)
BEGIN
    CREATE TABLE dbo.StoreSettings (
        [Id] INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_StoreSettings PRIMARY KEY CLUSTERED,
        [AnnouncementEnabled] BIT NOT NULL CONSTRAINT DF_StoreSettings_AnnouncementEnabled DEFAULT 1,
        [AnnouncementText] NVARCHAR(500) NOT NULL CONSTRAINT DF_StoreSettings_AnnouncementText DEFAULT N'Free shipping on orders over ₹999 · Cash on Delivery available · 7-day returns',
        [AnnouncementLink] NVARCHAR(255) NULL,
        [AnnouncementStyle] NVARCHAR(50) NOT NULL CONSTRAINT DF_StoreSettings_AnnouncementStyle DEFAULT N'emerald',
        [FreeShippingThreshold] DECIMAL(18,2) NOT NULL CONSTRAINT DF_StoreSettings_FreeShippingThreshold DEFAULT 999.00,
        [FlatShippingRate] DECIMAL(18,2) NOT NULL CONSTRAINT DF_StoreSettings_FlatShippingRate DEFAULT 50.00,
        [HeroEyebrow] NVARCHAR(200) NOT NULL CONSTRAINT DF_StoreSettings_HeroEyebrow DEFAULT N'Natural Minerals & Astrological Alignments',
        [HeroTitle] NVARCHAR(300) NOT NULL CONSTRAINT DF_StoreSettings_HeroTitle DEFAULT N'Discover Crystals Aligned with Your Zodiac',
        [HeroSubtitle] NVARCHAR(1000) NOT NULL CONSTRAINT DF_StoreSettings_HeroSubtitle DEFAULT N'Hand-selected crystals, raw clusters, polished towers, and gemstone jewelry intuitively paired to resonate with your astrological blueprint and daily intentions.',
        [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT DF_StoreSettings_UpdatedAt DEFAULT SYSUTCDATETIME(),
        [UpdatedByUserId] INT NULL
    );
END
GO

-- Seed single default configuration row if empty
IF NOT EXISTS (SELECT 1 FROM dbo.StoreSettings)
BEGIN
    INSERT INTO dbo.StoreSettings (
        [AnnouncementEnabled],
        [AnnouncementText],
        [AnnouncementLink],
        [AnnouncementStyle],
        [FreeShippingThreshold],
        [FlatShippingRate],
        [HeroEyebrow],
        [HeroTitle],
        [HeroSubtitle],
        [UpdatedAt]
    ) VALUES (
        1,
        N'Free shipping on orders over ₹999 · Cash on Delivery available · 7-day returns',
        NULL,
        N'emerald',
        999.00,
        50.00,
        N'Natural Minerals & Astrological Alignments',
        N'Discover Crystals Aligned with Your Zodiac',
        N'Hand-selected crystals, raw clusters, polished towers, and gemstone jewelry intuitively paired to resonate with your astrological blueprint and daily intentions.',
        SYSUTCDATETIME()
    );
END
GO
