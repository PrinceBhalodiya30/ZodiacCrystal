-- 2026-10-16: back-in-stock alerts and wishlist price-drop notices.
--
-- Idempotent and non-destructive.
--   * StockAlerts: one row per customer waiting for an out-of-stock product.
--     The row is deleted once the "back in stock" email has been sent.
--   * Wishlists.AlertPrice: the price a price-drop notice is measured from
--     (the price when saved, then the price last told to the customer).
--     Existing rows get NULL and are filled with the current price on the next
--     background run, so nobody is emailed about drops that happened before
--     this feature existed.
--   * Notifications.ProductId: lets the bell open the product page.

SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.StockAlerts', N'U') IS NULL
    CREATE TABLE dbo.StockAlerts
    (
        StockAlertId INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_StockAlerts PRIMARY KEY,
        UserId       INT NOT NULL,
        ProductId    INT NOT NULL,
        CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_StockAlerts_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_StockAlerts_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId) ON DELETE CASCADE,
        CONSTRAINT FK_StockAlerts_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId) ON DELETE CASCADE
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_StockAlerts_UserId_ProductId' AND object_id = OBJECT_ID(N'dbo.StockAlerts'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_StockAlerts_UserId_ProductId ON dbo.StockAlerts (UserId, ProductId);
GO

-- The background job looks alerts up by product.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_StockAlerts_ProductId' AND object_id = OBJECT_ID(N'dbo.StockAlerts'))
    CREATE NONCLUSTERED INDEX IX_StockAlerts_ProductId ON dbo.StockAlerts (ProductId);
GO

IF COL_LENGTH(N'dbo.Wishlists', N'AlertPrice') IS NULL
    ALTER TABLE dbo.Wishlists ADD AlertPrice DECIMAL(10, 2) NULL;
GO

IF COL_LENGTH(N'dbo.Notifications', N'ProductId') IS NULL
    ALTER TABLE dbo.Notifications ADD ProductId INT NULL;
GO

IF OBJECT_ID(N'dbo.FK_Notifications_Products', N'F') IS NULL
    ALTER TABLE dbo.Notifications ADD CONSTRAINT FK_Notifications_Products
        FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId) ON DELETE SET NULL;
GO
