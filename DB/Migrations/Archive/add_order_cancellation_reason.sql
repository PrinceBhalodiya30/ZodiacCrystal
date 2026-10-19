-- Why a customer cancelled their own order (chosen from a fixed list on the
-- site). NULL for older orders and for cancellations made by an admin.
ALTER TABLE Orders ADD CancellationReason NVARCHAR(100) NULL;
GO
