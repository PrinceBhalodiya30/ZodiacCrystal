-- 2026-10-14: data integrity constraints and missing indexes (audit M7).
--
-- Idempotent and non-destructive: every object is added only if missing, and
-- each CHECK is only added after confirming no existing row violates it - if
-- one does, the script stops with an error naming it and changes nothing for
-- that constraint, so the data can be reviewed first.
--
-- Already present before this script (not repeated here): unique Users.Email
-- (UQ_Users_Email, case-insensitive collation), IX_Orders_UserId,
-- IX_OrderItems_OrderId, CK_OrderItems_Quantity, the ProductReviews rating
-- check, CK_Orders_Status and CK_Users_Role.

SET XACT_ABORT ON;
GO

-- Products: stock can't go below zero (the app already guards every stock
-- write; this is the database-level backstop) and prices must be positive.
IF OBJECT_ID(N'dbo.CK_Products_StockQuantity_NonNegative', N'C') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.Products WHERE StockQuantity < 0)
        THROW 50001, 'Products has rows with negative StockQuantity; fix them before adding CK_Products_StockQuantity_NonNegative.', 1;
    ALTER TABLE dbo.Products ADD CONSTRAINT CK_Products_StockQuantity_NonNegative CHECK (StockQuantity >= 0);
END
GO

IF OBJECT_ID(N'dbo.CK_Products_Price_Positive', N'C') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.Products WHERE Price <= 0)
        THROW 50002, 'Products has rows with Price <= 0; fix them before adding CK_Products_Price_Positive.', 1;
    ALTER TABLE dbo.Products ADD CONSTRAINT CK_Products_Price_Positive CHECK (Price > 0);
END
GO

IF OBJECT_ID(N'dbo.CK_Products_CompareAtPrice_Positive', N'C') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.Products WHERE CompareAtPrice <= 0)
        THROW 50003, 'Products has rows with CompareAtPrice <= 0; fix them before adding CK_Products_CompareAtPrice_Positive.', 1;
    ALTER TABLE dbo.Products ADD CONSTRAINT CK_Products_CompareAtPrice_Positive CHECK (CompareAtPrice IS NULL OR CompareAtPrice > 0);
END
GO

-- Order money columns are never negative.
IF OBJECT_ID(N'dbo.CK_Orders_Amounts_NonNegative', N'C') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.Orders WHERE TotalAmount < 0 OR DiscountAmount < 0 OR ShippingFee < 0)
        THROW 50004, 'Orders has rows with negative amounts; fix them before adding CK_Orders_Amounts_NonNegative.', 1;
    ALTER TABLE dbo.Orders ADD CONSTRAINT CK_Orders_Amounts_NonNegative
        CHECK (TotalAmount >= 0 AND DiscountAmount >= 0 AND ShippingFee >= 0);
END
GO

IF OBJECT_ID(N'dbo.CK_OrderItems_Prices_NonNegative', N'C') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.OrderItems WHERE UnitPrice < 0 OR Subtotal < 0)
        THROW 50005, 'OrderItems has rows with negative prices; fix them before adding CK_OrderItems_Prices_NonNegative.', 1;
    ALTER TABLE dbo.OrderItems ADD CONSTRAINT CK_OrderItems_Prices_NonNegative CHECK (UnitPrice >= 0 AND Subtotal >= 0);
END
GO

-- Coupons: the usage counter never goes negative. There is deliberately no
-- UsedCount <= UsageLimit check: admins may lower a limit below the current
-- count to stop a coupon early.
IF OBJECT_ID(N'dbo.CK_Coupons_UsedCount_NonNegative', N'C') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.Coupons WHERE UsedCount < 0)
        THROW 50006, 'Coupons has rows with negative UsedCount; fix them before adding CK_Coupons_UsedCount_NonNegative.', 1;
    ALTER TABLE dbo.Coupons ADD CONSTRAINT CK_Coupons_UsedCount_NonNegative CHECK (UsedCount >= 0);
END
GO

-- Indexes for the queries the app runs most: admin order lists filtered by
-- status and sorted newest first, date-range reports, and per-product sales.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Orders_Status_OrderDate' AND object_id = OBJECT_ID(N'dbo.Orders'))
    CREATE NONCLUSTERED INDEX IX_Orders_Status_OrderDate ON dbo.Orders (Status, OrderDate DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Orders_OrderDate' AND object_id = OBJECT_ID(N'dbo.Orders'))
    CREATE NONCLUSTERED INDEX IX_Orders_OrderDate ON dbo.Orders (OrderDate DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_OrderItems_ProductId' AND object_id = OBJECT_ID(N'dbo.OrderItems'))
    CREATE NONCLUSTERED INDEX IX_OrderItems_ProductId ON dbo.OrderItems (ProductId);
GO
