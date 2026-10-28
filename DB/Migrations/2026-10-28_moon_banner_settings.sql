-- Migration: Add MoonBanner configuration columns to StoreSettings
-- Allows merchants to toggle and customize the daily celestial/moon transit banner from /admin/settings

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'StoreSettings'
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'MoonBannerEnabled')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [MoonBannerEnabled] BIT NOT NULL CONSTRAINT DF_StoreSettings_MoonBannerEnabled DEFAULT 1;
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'MoonBannerMode')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [MoonBannerMode] NVARCHAR(50) NOT NULL CONSTRAINT DF_StoreSettings_MoonBannerMode DEFAULT N'auto';
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'MoonBannerCustomText')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [MoonBannerCustomText] NVARCHAR(500) NULL;
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'MoonBannerCustomCrystal')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [MoonBannerCustomCrystal] NVARCHAR(100) NULL;
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'MoonBannerCustomBenefit')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [MoonBannerCustomBenefit] NVARCHAR(200) NULL;
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'MoonBannerCustomLink')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [MoonBannerCustomLink] NVARCHAR(255) NULL;
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'MoonBannerShowModal')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [MoonBannerShowModal] BIT NOT NULL CONSTRAINT DF_StoreSettings_MoonBannerShowModal DEFAULT 1;
    END
END
GO

