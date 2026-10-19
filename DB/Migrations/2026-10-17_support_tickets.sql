-- 2026-10-17: Help Center support tickets.
--
-- Idempotent and non-destructive. A ticket is a conversation between a
-- customer and the store, optionally about one order (OrderId is NULL for
-- general questions; several tickets per order are allowed). Lifecycle (see
-- TicketStatuses): Open <-> AwaitingCustomer -> Resolved -> Closed. Resolved
-- tickets are closed automatically after a few days (TicketAutoCloseService).
-- Messages with IsInternal = 1 are admin-only notes the customer never sees.

SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.SupportTickets', N'U') IS NULL
    CREATE TABLE dbo.SupportTickets
    (
        SupportTicketId INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_SupportTickets PRIMARY KEY,
        UserId          INT NOT NULL,
        OrderId         INT NULL,
        Category        NVARCHAR(30) NOT NULL,
        Subject         NVARCHAR(150) NOT NULL,
        Status          NVARCHAR(20) NOT NULL CONSTRAINT DF_SupportTickets_Status DEFAULT (N'Open'),
        -- Who needs to read the latest message: drives the unread dots.
        CustomerUnread  BIT NOT NULL CONSTRAINT DF_SupportTickets_CustomerUnread DEFAULT (0),
        AdminUnread     BIT NOT NULL CONSTRAINT DF_SupportTickets_AdminUnread DEFAULT (1),
        Rating          TINYINT NULL,
        RatingComment   NVARCHAR(500) NULL,
        CreatedAt       DATETIME2 NOT NULL CONSTRAINT DF_SupportTickets_CreatedAt DEFAULT (SYSUTCDATETIME()),
        LastMessageAt   DATETIME2 NOT NULL CONSTRAINT DF_SupportTickets_LastMessageAt DEFAULT (SYSUTCDATETIME()),
        ResolvedAt      DATETIME2 NULL,
        ClosedAt        DATETIME2 NULL,
        CONSTRAINT FK_SupportTickets_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
        CONSTRAINT FK_SupportTickets_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders (OrderId)
    );
GO

IF OBJECT_ID(N'dbo.CK_SupportTickets_Status', N'C') IS NULL
    ALTER TABLE dbo.SupportTickets ADD CONSTRAINT CK_SupportTickets_Status
        CHECK (Status IN (N'Open', N'AwaitingCustomer', N'Resolved', N'Closed'));
GO

IF OBJECT_ID(N'dbo.CK_SupportTickets_Rating', N'C') IS NULL
    ALTER TABLE dbo.SupportTickets ADD CONSTRAINT CK_SupportTickets_Rating
        CHECK (Rating IS NULL OR Rating BETWEEN 1 AND 5);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SupportTickets_UserId' AND object_id = OBJECT_ID(N'dbo.SupportTickets'))
    CREATE NONCLUSTERED INDEX IX_SupportTickets_UserId ON dbo.SupportTickets (UserId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SupportTickets_Status' AND object_id = OBJECT_ID(N'dbo.SupportTickets'))
    CREATE NONCLUSTERED INDEX IX_SupportTickets_Status ON dbo.SupportTickets (Status, LastMessageAt);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SupportTickets_OrderId' AND object_id = OBJECT_ID(N'dbo.SupportTickets'))
    CREATE NONCLUSTERED INDEX IX_SupportTickets_OrderId ON dbo.SupportTickets (OrderId) WHERE OrderId IS NOT NULL;
GO

IF OBJECT_ID(N'dbo.TicketMessages', N'U') IS NULL
    CREATE TABLE dbo.TicketMessages
    (
        TicketMessageId INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_TicketMessages PRIMARY KEY,
        SupportTicketId INT NOT NULL,
        SenderUserId    INT NOT NULL,
        IsFromAdmin     BIT NOT NULL CONSTRAINT DF_TicketMessages_IsFromAdmin DEFAULT (0),
        IsInternal      BIT NOT NULL CONSTRAINT DF_TicketMessages_IsInternal DEFAULT (0),
        Body            NVARCHAR(2000) NOT NULL,
        -- Up to 3 photo URLs, '|' separated (same re-encoded JPEGs as review photos).
        AttachmentUrls  NVARCHAR(1600) NULL,
        CreatedAt       DATETIME2 NOT NULL CONSTRAINT DF_TicketMessages_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_TicketMessages_SupportTickets FOREIGN KEY (SupportTicketId)
            REFERENCES dbo.SupportTickets (SupportTicketId) ON DELETE CASCADE,
        CONSTRAINT FK_TicketMessages_Users FOREIGN KEY (SenderUserId) REFERENCES dbo.Users (UserId)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TicketMessages_SupportTicketId' AND object_id = OBJECT_ID(N'dbo.TicketMessages'))
    CREATE NONCLUSTERED INDEX IX_TicketMessages_SupportTicketId ON dbo.TicketMessages (SupportTicketId, CreatedAt);
GO
