-- Coupon announcements: an admin can notify every customer about an active coupon
-- (in-app bell only, no email).
--
-- Coupons.NotifiedAt: when the announcement went out, so it is only sent once.
-- Notifications.CouponId: the coupon a "Coupon" notification is about. The bell
-- hides it once the coupon stops working (expired, deactivated, used up), and it
-- is removed with the coupon. Idempotent, safe to run again.

IF COL_LENGTH('dbo.Coupons', 'NotifiedAt') IS NULL
    ALTER TABLE dbo.Coupons ADD NotifiedAt DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.Notifications', 'CouponId') IS NULL
BEGIN
    ALTER TABLE dbo.Notifications ADD CouponId INT NULL
        CONSTRAINT FK_Notifications_Coupons FOREIGN KEY REFERENCES dbo.Coupons(CouponId) ON DELETE CASCADE;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_CouponId')
    CREATE INDEX IX_Notifications_CouponId ON dbo.Notifications(CouponId);
