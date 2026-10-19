-- Customer return/refund requests + the delivery date they are measured from.
--
-- Orders.DeliveredAt: set when an admin marks an order Delivered. The return
-- window (7 days) runs from this date. Existing delivered orders are backfilled
-- from PaidAt (COD orders are marked paid on delivery), falling back to OrderDate.
--
-- ReturnRequests.Status: 'Requested' -> 'Approved' -> 'Refunded', or 'Rejected'.
-- One request per order (unique OrderId).

ALTER TABLE Orders ADD DeliveredAt DATETIME2 NULL;
GO

UPDATE Orders SET DeliveredAt = COALESCE(PaidAt, OrderDate) WHERE Status = 'Delivered';
GO

CREATE TABLE ReturnRequests (
    ReturnRequestId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ReturnRequests PRIMARY KEY,
    OrderId         INT            NOT NULL,
    UserId          INT            NOT NULL,
    Reason          NVARCHAR(30)   NOT NULL,
    Details         NVARCHAR(1000) NULL,
    Status          NVARCHAR(20)   NOT NULL CONSTRAINT DF_ReturnRequests_Status DEFAULT 'Requested',
    AdminNote       NVARCHAR(500)  NULL,
    Restocked       BIT            NOT NULL CONSTRAINT DF_ReturnRequests_Restocked DEFAULT 0,
    CreatedAt       DATETIME2      NOT NULL CONSTRAINT DF_ReturnRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
    ResolvedAt      DATETIME2      NULL,
    CONSTRAINT FK_ReturnRequests_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId),
    CONSTRAINT FK_ReturnRequests_Users  FOREIGN KEY (UserId)  REFERENCES dbo.Users(UserId)
);
GO

CREATE UNIQUE INDEX UQ_ReturnRequests_OrderId ON ReturnRequests (OrderId);
CREATE INDEX IX_ReturnRequests_UserId ON ReturnRequests (UserId);
CREATE INDEX IX_ReturnRequests_Status ON ReturnRequests (Status);
GO
