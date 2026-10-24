-- Migration: Add DeliveryInstructions column to Orders table
-- Stores optional customer notes (e.g. "Leave with building security", "Call before arrival").
-- Nullable NVARCHAR(300), 100% backward-compatible, does not impact existing rows.

USE CrystalsDB;
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Orders' AND COLUMN_NAME = 'DeliveryInstructions'
)
BEGIN
    ALTER TABLE dbo.Orders
    ADD DeliveryInstructions NVARCHAR(300) NULL;
END
GO
