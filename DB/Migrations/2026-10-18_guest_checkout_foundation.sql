-- 2026-10-18: guest checkout, phase 1 (foundation).
--
-- Idempotent and non-destructive. No existing rows change.
--
-- 1. Users.Role gains 'Guest': a hidden account created for an email verified
--    at guest checkout. Orders, returns and tickets keep their existing
--    NOT NULL UserId foreign keys - a guest simply owns them through this row.
--    Guests can't log in; registering with the same email upgrades the row
--    to 'User' and keeps its orders.
-- 2. OrderAccessTokens: the secure "view your order" links emailed to guests.
--    Only a SHA-256 hash of each token is stored, so a database leak doesn't
--    expose working links. Links expire and can be revoked.

SET XACT_ABORT ON;
GO

-- Replace the role check only if it doesn't already allow 'Guest'.
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_Users_Role' AND parent_object_id = OBJECT_ID(N'dbo.Users')
      AND definition NOT LIKE N'%Guest%')
    ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_Role;
GO

IF OBJECT_ID(N'dbo.CK_Users_Role', N'C') IS NULL
    ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_Role
        CHECK ([Role] = 'Admin' OR [Role] = 'User' OR [Role] = 'Guest');
GO

IF OBJECT_ID(N'dbo.OrderAccessTokens', N'U') IS NULL
    CREATE TABLE dbo.OrderAccessTokens
    (
        OrderAccessTokenId INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_OrderAccessTokens PRIMARY KEY,
        OrderId            INT NOT NULL,
        -- Hex SHA-256 of the random token in the emailed link.
        TokenHash          CHAR(64) NOT NULL,
        CreatedAt          DATETIME2 NOT NULL CONSTRAINT DF_OrderAccessTokens_CreatedAt DEFAULT (SYSUTCDATETIME()),
        ExpiresAt          DATETIME2 NOT NULL,
        LastUsedAt         DATETIME2 NULL,
        RevokedAt          DATETIME2 NULL,
        CONSTRAINT FK_OrderAccessTokens_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders (OrderId) ON DELETE CASCADE
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_OrderAccessTokens_TokenHash' AND object_id = OBJECT_ID(N'dbo.OrderAccessTokens'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_OrderAccessTokens_TokenHash ON dbo.OrderAccessTokens (TokenHash);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_OrderAccessTokens_OrderId' AND object_id = OBJECT_ID(N'dbo.OrderAccessTokens'))
    CREATE NONCLUSTERED INDEX IX_OrderAccessTokens_OrderId ON dbo.OrderAccessTokens (OrderId);
GO
