-- Migration: Add Intention column to Products table
-- Enables curated Sacred Intention merchandising (wealth, love, protection, peace, intuition, energy)

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Products' AND COLUMN_NAME = 'Intention'
)
BEGIN
    ALTER TABLE dbo.Products ADD [Intention] nvarchar(50) NULL;
END
GO

-- Seed initial intentions based on mineral properties
UPDATE dbo.Products SET [Intention] = 'wealth'
WHERE [Intention] IS NULL AND (
    Name LIKE '%Pyrite%' OR Name LIKE '%Citrine%' OR Name LIKE '%Tiger%' 
    OR Name LIKE '%Aventurine%' OR Name LIKE '%Jade%' OR Name LIKE '%Malachite%'
);

UPDATE dbo.Products SET [Intention] = 'love'
WHERE [Intention] IS NULL AND (
    Name LIKE '%Rose Quartz%' OR Name LIKE '%Moonstone%' OR Name LIKE '%Rhodonite%' 
    OR Name LIKE '%Kunzite%' OR Name LIKE '%Emerald%'
);

UPDATE dbo.Products SET [Intention] = 'protection'
WHERE [Intention] IS NULL AND (
    Name LIKE '%Obsidian%' OR Name LIKE '%Tourmaline%' OR Name LIKE '%Smoky%' 
    OR Name LIKE '%Hematite%' OR Name LIKE '%Shungite%'
);

UPDATE dbo.Products SET [Intention] = 'peace'
WHERE [Intention] IS NULL AND (
    Name LIKE '%Amethyst%' OR Name LIKE '%Selenite%' OR Name LIKE '%Blue Quartz%' 
    OR Name LIKE '%Celestite%' OR Name LIKE '%Lepidolite%' OR Name LIKE '%Howlite%'
);

UPDATE dbo.Products SET [Intention] = 'intuition'
WHERE [Intention] IS NULL AND (
    Name LIKE '%Clear Quartz%' OR Name LIKE '%Lapis%' OR Name LIKE '%Labradorite%' 
    OR Name LIKE '%Fluorite%' OR Name LIKE '%Sodalite%' OR Name LIKE '%Apatite%' OR Name LIKE '%Amazonite%'
);

UPDATE dbo.Products SET [Intention] = 'energy'
WHERE [Intention] IS NULL AND (
    Name LIKE '%Carnelian%' OR Name LIKE '%Jasper%' OR Name LIKE '%Sunstone%' 
    OR Name LIKE '%Garnet%' OR Name LIKE '%Bloodstone%'
);

-- Fallback for any remaining unassigned crystals
UPDATE dbo.Products SET [Intention] = 'peace' WHERE [Intention] IS NULL;
GO

