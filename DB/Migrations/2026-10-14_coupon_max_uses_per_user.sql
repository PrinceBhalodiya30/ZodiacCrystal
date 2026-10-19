-- 2026-10-14: optional per-customer coupon limit (audit M1).
--
-- Idempotent and non-destructive. Existing coupons get NULL (no per-customer
-- limit), so they behave exactly as before.

SET XACT_ABORT ON;
GO

IF COL_LENGTH(N'dbo.Coupons', N'MaxUsesPerUser') IS NULL
    ALTER TABLE dbo.Coupons ADD MaxUsesPerUser INT NULL;
GO

IF OBJECT_ID(N'dbo.CK_Coupons_MaxUsesPerUser_Positive', N'C') IS NULL
    ALTER TABLE dbo.Coupons ADD CONSTRAINT CK_Coupons_MaxUsesPerUser_Positive
        CHECK (MaxUsesPerUser IS NULL OR MaxUsesPerUser >= 1);
GO

-- Checkout counts one customer's orders with one coupon under a lock; this
-- index keeps that lock to just those rows instead of the whole Orders table.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Orders_UserId_CouponCode' AND object_id = OBJECT_ID(N'dbo.Orders'))
    CREATE NONCLUSTERED INDEX IX_Orders_UserId_CouponCode ON dbo.Orders (UserId, CouponCode);
GO
