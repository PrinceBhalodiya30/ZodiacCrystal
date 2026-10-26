-- Migration: Add RashiName column to ZodiacSigns table and backfill default Vedic names
-- Enables administrators to edit and customize Indian Zodiac (Vedic Rashi) names directly.

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'ZodiacSigns' AND COLUMN_NAME = 'RashiName'
)
BEGIN
    ALTER TABLE dbo.ZodiacSigns ADD [RashiName] nvarchar(100) NULL;
END
GO

-- Backfill default Indian Vedic names with Devanagari script for existing signs
UPDATE dbo.ZodiacSigns SET [RashiName] = N'Mesha (मेष)' WHERE [Name] = 'Aries' AND [RashiName] IS NULL;
UPDATE dbo.ZodiacSigns SET [RashiName] = N'Vrishabha (वृषभ)' WHERE [Name] = 'Taurus' AND [RashiName] IS NULL;
UPDATE dbo.ZodiacSigns SET [RashiName] = N'Mithuna (मिथुन)' WHERE [Name] = 'Gemini' AND [RashiName] IS NULL;
UPDATE dbo.ZodiacSigns SET [RashiName] = N'Karka (कर्क)' WHERE [Name] = 'Cancer' AND [RashiName] IS NULL;
UPDATE dbo.ZodiacSigns SET [RashiName] = N'Simha (सिंह)' WHERE [Name] = 'Leo' AND [RashiName] IS NULL;
UPDATE dbo.ZodiacSigns SET [RashiName] = N'Kanya (कन्या)' WHERE [Name] = 'Virgo' AND [RashiName] IS NULL;
UPDATE dbo.ZodiacSigns SET [RashiName] = N'Tula (तुला)' WHERE [Name] = 'Libra' AND [RashiName] IS NULL;
UPDATE dbo.ZodiacSigns SET [RashiName] = N'Vrishchika (वृश्चिक)' WHERE [Name] = 'Scorpio' AND [RashiName] IS NULL;
UPDATE dbo.ZodiacSigns SET [RashiName] = N'Dhanu (धनु)' WHERE [Name] = 'Sagittarius' AND [RashiName] IS NULL;
UPDATE dbo.ZodiacSigns SET [RashiName] = N'Makara (मकर)' WHERE [Name] = 'Capricorn' AND [RashiName] IS NULL;
UPDATE dbo.ZodiacSigns SET [RashiName] = N'Kumbha (कुंभ)' WHERE [Name] = 'Aquarius' AND [RashiName] IS NULL;
UPDATE dbo.ZodiacSigns SET [RashiName] = N'Meena (मीन)' WHERE [Name] = 'Pisces' AND [RashiName] IS NULL;
GO
