-- Adds threshold-based shipping charge support. Existing orders default to
-- ShippingFee = 0 so their already-stored TotalAmount remains correct/unchanged.
ALTER TABLE Orders ADD ShippingFee DECIMAL(10, 2) NOT NULL DEFAULT 0;
