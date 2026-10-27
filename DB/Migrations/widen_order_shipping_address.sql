-- A saved address's two lines (200 + 200) are joined into the order's shipping address,
-- which only allowed 300 characters; widen it so those orders don't fail.

ALTER TABLE Orders ALTER COLUMN ShippingAddress NVARCHAR(410) NOT NULL;
