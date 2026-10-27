-- Real-time in-app notifications (order placed / order status changed).
-- Stored in SQL Server so offline users still see them after logging back in;
-- delivered live over SignalR when the user is connected. Idempotent, safe to run again.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Notifications')
BEGIN
    CREATE TABLE dbo.Notifications
    (
        NotificationId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        OrderId INT NULL,
        Title NVARCHAR(150) NOT NULL,
        Message NVARCHAR(500) NOT NULL,
        Type NVARCHAR(30) NOT NULL,
        IsRead BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_Notifications_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId) ON DELETE SET NULL
    );

    CREATE INDEX IX_Notifications_UserId_IsRead ON dbo.Notifications(UserId, IsRead);
END
