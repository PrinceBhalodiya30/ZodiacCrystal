-- 2026-10-16: indexes for the storefront's hot read paths.
--
-- Idempotent and non-destructive (each index is only created if missing).
--   * Products.CategoryId: category tiles/counts and the category filter.
--   * ProductImages.ProductId: loading each product's images.
--   * ProductZodiacs.ZodiacId: the "Shop by Zodiac" filter (the PK is
--     (ProductId, ZodiacId), so it can't seek on ZodiacId alone).
--   * Orders (UserId, OrderDate DESC): a customer's order history, newest first.

SET XACT_ABORT ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Products_CategoryId' AND object_id = OBJECT_ID(N'dbo.Products'))
    CREATE NONCLUSTERED INDEX IX_Products_CategoryId ON dbo.Products (CategoryId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ProductImages_ProductId' AND object_id = OBJECT_ID(N'dbo.ProductImages'))
    CREATE NONCLUSTERED INDEX IX_ProductImages_ProductId ON dbo.ProductImages (ProductId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ProductZodiacs_ZodiacId' AND object_id = OBJECT_ID(N'dbo.ProductZodiacs'))
    CREATE NONCLUSTERED INDEX IX_ProductZodiacs_ZodiacId ON dbo.ProductZodiacs (ZodiacId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Orders_UserId_OrderDate' AND object_id = OBJECT_ID(N'dbo.Orders'))
    CREATE NONCLUSTERED INDEX IX_Orders_UserId_OrderDate ON dbo.Orders (UserId, OrderDate DESC);
GO
