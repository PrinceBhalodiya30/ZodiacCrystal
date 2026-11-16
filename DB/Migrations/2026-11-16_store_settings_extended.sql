-- Migration: Add Marquee Ribbon, Curated Intentions, Mystery Box, Gift Packaging, and Contact Settings columns to StoreSettings
-- Allows merchants to customize these sections in /admin/settings and persist them across all customers, devices, and sessions.

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'StoreSettings'
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'MarqueeRibbonJson')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [MarqueeRibbonJson] NVARCHAR(MAX) NULL;
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'HeroIntentionsJson')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [HeroIntentionsJson] NVARCHAR(MAX) NULL;
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'MysteryBoxJson')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [MysteryBoxJson] NVARCHAR(MAX) NULL;
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'GiftPackagingJson')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [GiftPackagingJson] NVARCHAR(MAX) NULL;
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'StoreContactJson')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [StoreContactJson] NVARCHAR(MAX) NULL;
    END
END
GO
