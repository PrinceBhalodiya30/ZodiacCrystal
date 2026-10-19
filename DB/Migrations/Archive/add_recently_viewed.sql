-- Per-user "Recently Viewed" history, stored on the server so it follows the
-- customer across devices (like Amazon/Flipkart). One row per user+product;
-- viewing again just bumps ViewedAt. Rows older than 90 days are ignored and
-- pruned by the API. Idempotent, safe to run again.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RecentlyViewed')
BEGIN
    CREATE TABLE dbo.RecentlyViewed
    (
        RecentlyViewedId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        ProductId INT NOT NULL,
        ViewedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_RecentlyViewed_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
        CONSTRAINT FK_RecentlyViewed_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId) ON DELETE CASCADE,
        CONSTRAINT UQ_RecentlyViewed_User_Product UNIQUE (UserId, ProductId)
    );

    CREATE INDEX IX_RecentlyViewed_UserId_ViewedAt ON dbo.RecentlyViewed(UserId, ViewedAt DESC);
END
