-- 2026-10-16: checkout idempotency keys and a record of failed payment reversals.
--
-- Idempotent and non-destructive.
--   * Orders.IdempotencyKey: sent by the checkout page, one per checkout attempt.
--     A retried or double-submitted request with the same key returns the order
--     already placed instead of creating (and charging) a second one. Unique per
--     customer; existing rows get NULL and are ignored by the filtered index.
--   * PaymentFailures: a card charge that succeeded for an order that then failed
--     to save, and whose automatic reversal also failed. Staff refund these by
--     hand and mark them Resolved.

SET XACT_ABORT ON;
GO

IF COL_LENGTH(N'dbo.Orders', N'IdempotencyKey') IS NULL
    ALTER TABLE dbo.Orders ADD IdempotencyKey NVARCHAR(64) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Orders_UserId_IdempotencyKey' AND object_id = OBJECT_ID(N'dbo.Orders'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_Orders_UserId_IdempotencyKey ON dbo.Orders (UserId, IdempotencyKey)
        WHERE IdempotencyKey IS NOT NULL;
GO

-- No foreign keys: the order was rolled back, and the row must survive even if
-- the customer's account is later deleted, until the money is returned.
IF OBJECT_ID(N'dbo.PaymentFailures', N'U') IS NULL
    CREATE TABLE dbo.PaymentFailures
    (
        Id            INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_PaymentFailures PRIMARY KEY,
        OrderId       INT NULL,
        UserId        INT NOT NULL,
        TransactionId NVARCHAR(64) NOT NULL,
        Amount        DECIMAL(18, 2) NOT NULL,
        Reason        NVARCHAR(500) NOT NULL,
        CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_PaymentFailures_CreatedAt DEFAULT (SYSUTCDATETIME()),
        Resolved      BIT NOT NULL CONSTRAINT DF_PaymentFailures_Resolved DEFAULT (0),
        ResolvedAt    DATETIME2 NULL
    );
GO

-- Staff look up the unresolved ones.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PaymentFailures_Resolved' AND object_id = OBJECT_ID(N'dbo.PaymentFailures'))
    CREATE NONCLUSTERED INDEX IX_PaymentFailures_Resolved ON dbo.PaymentFailures (Resolved, CreatedAt);
GO
