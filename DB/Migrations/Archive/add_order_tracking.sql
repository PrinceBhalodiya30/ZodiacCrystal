-- Shipment tracking for the customer "Track package" page.
--
-- Orders.CourierName / TrackingNumber: entered (or auto-generated) by the admin
-- when an order is marked Shipped. Demo data only - not linked to a real courier.
-- Orders.ConfirmedAt / ShippedAt: when those steps happened, so the tracking page
-- can show a date for each step. Existing orders are backfilled from the audit log.

ALTER TABLE Orders ADD
    ConfirmedAt    DATETIME2    NULL,
    ShippedAt      DATETIME2    NULL,
    CourierName    NVARCHAR(50) NULL,
    TrackingNumber NVARCHAR(50) NULL;
GO

UPDATE o SET ConfirmedAt = a.CreatedAt
FROM Orders o
CROSS APPLY (
    SELECT MIN(CreatedAt) AS CreatedAt FROM AuditLogs
    WHERE EntityType = 'Order' AND EntityId = o.OrderId
      AND Action = 'OrderStatusChanged' AND Details LIKE '%-> Confirmed'
) a
WHERE a.CreatedAt IS NOT NULL;
GO

UPDATE o SET ShippedAt = a.CreatedAt
FROM Orders o
CROSS APPLY (
    SELECT MIN(CreatedAt) AS CreatedAt FROM AuditLogs
    WHERE EntityType = 'Order' AND EntityId = o.OrderId
      AND Action = 'OrderStatusChanged' AND Details LIKE '%-> Shipped'
) a
WHERE a.CreatedAt IS NOT NULL;
GO
