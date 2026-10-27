-- Adds payment tracking to orders (Braintree card payments + Cash on Delivery).
--   PaymentMethod:        'Card' | 'COD'
--   PaymentStatus:        'Pending' | 'Paid' | 'Refunded' | 'Cancelled'
--   PaymentTransactionId: Braintree transaction id for card payments
--   PaidAt:               when the payment was captured (card) or collected (COD on delivery)
-- Existing orders become Cash on Delivery; their payment status is backfilled
-- from the order status so history stays consistent.

ALTER TABLE Orders ADD PaymentMethod NVARCHAR(20) NOT NULL CONSTRAINT DF_Orders_PaymentMethod DEFAULT 'COD';
ALTER TABLE Orders ADD PaymentStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_Orders_PaymentStatus DEFAULT 'Pending';
ALTER TABLE Orders ADD PaymentTransactionId NVARCHAR(64) NULL;
ALTER TABLE Orders ADD PaidAt DATETIME2 NULL;
GO

UPDATE Orders SET PaymentStatus = 'Paid', PaidAt = OrderDate WHERE Status = 'Delivered';
UPDATE Orders SET PaymentStatus = 'Cancelled' WHERE Status = 'Cancelled';
GO
