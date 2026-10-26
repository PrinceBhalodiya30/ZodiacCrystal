-- Migration: Update ZodiacSigns.Symbol to hold modern SVG icon paths instead of legacy emoji tiles
-- Date: 2026-10-26

IF EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'ZodiacSigns' 
      AND COLUMN_NAME = 'Symbol' 
      AND CHARACTER_MAXIMUM_LENGTH < 255
)
BEGIN
    ALTER TABLE dbo.ZodiacSigns ALTER COLUMN [Symbol] NVARCHAR(255) NULL;
END
GO

-- Backfill all 12 zodiac signs with clean SVG icon paths and remove purple emojis
UPDATE dbo.ZodiacSigns SET Symbol = '/zodiac/aries.svg'       WHERE Name = 'Aries';
UPDATE dbo.ZodiacSigns SET Symbol = '/zodiac/taurus.svg'      WHERE Name = 'Taurus';
UPDATE dbo.ZodiacSigns SET Symbol = '/zodiac/gemini.svg'      WHERE Name = 'Gemini';
UPDATE dbo.ZodiacSigns SET Symbol = '/zodiac/cancer.svg'      WHERE Name = 'Cancer';
UPDATE dbo.ZodiacSigns SET Symbol = '/zodiac/leo.svg'         WHERE Name = 'Leo';
UPDATE dbo.ZodiacSigns SET Symbol = '/zodiac/virgo.svg'       WHERE Name = 'Virgo';
UPDATE dbo.ZodiacSigns SET Symbol = '/zodiac/libra.svg'       WHERE Name = 'Libra';
UPDATE dbo.ZodiacSigns SET Symbol = '/zodiac/scorpio.svg'     WHERE Name = 'Scorpio';
UPDATE dbo.ZodiacSigns SET Symbol = '/zodiac/sagittarius.svg' WHERE Name = 'Sagittarius';
UPDATE dbo.ZodiacSigns SET Symbol = '/zodiac/capricorn.svg'   WHERE Name = 'Capricorn';
UPDATE dbo.ZodiacSigns SET Symbol = '/zodiac/aquarius.svg'    WHERE Name = 'Aquarius';
UPDATE dbo.ZodiacSigns SET Symbol = '/zodiac/pisces.svg'      WHERE Name = 'Pisces';
GO
