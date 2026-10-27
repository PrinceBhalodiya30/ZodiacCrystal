-- Migration: Add MarketingBadge column to Products table
-- Enables marketing ribbon pills (e.g. Bestseller, Rare Specimen, Trending) on product cards and product details.

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Products' AND COLUMN_NAME = 'MarketingBadge'
)
BEGIN
    ALTER TABLE dbo.Products ADD [MarketingBadge] nvarchar(50) NULL;
END
GO

-- Set initial badges for demonstration
UPDATE dbo.Products SET [MarketingBadge] = 'Bestseller' WHERE [ProductId] = 1 AND [MarketingBadge] IS NULL;
UPDATE dbo.Products SET [MarketingBadge] = 'Trending' WHERE [ProductId] = 2 AND [MarketingBadge] IS NULL;
UPDATE dbo.Products SET [MarketingBadge] = 'Rare Specimen' WHERE [ProductId] = 10 AND [MarketingBadge] IS NULL;
GO
