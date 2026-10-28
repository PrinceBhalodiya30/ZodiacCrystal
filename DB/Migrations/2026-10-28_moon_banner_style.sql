-- Migration: Add MoonBannerStyle column to StoreSettings
-- Allows merchants to choose cosmic color palettes (midnight, amethyst, gold, sapphire, ruby) from /admin/settings

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'StoreSettings'
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StoreSettings' AND COLUMN_NAME = 'MoonBannerStyle')
    BEGIN
        ALTER TABLE dbo.StoreSettings ADD [MoonBannerStyle] NVARCHAR(50) NOT NULL CONSTRAINT DF_StoreSettings_MoonBannerStyle DEFAULT N'midnight';
    END
END
GO
