-- Migration: Add soft-delete support to Users table
-- Adds IsDeleted / DeletedAt columns used by the Admin "Delete User" feature.
-- Soft-delete only: no existing rows are removed, no FKs are touched.

USE CrystalsDB;
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'IsDeleted'
)
BEGIN
    ALTER TABLE dbo.Users
    ADD IsDeleted BIT NOT NULL CONSTRAINT DF_Users_IsDeleted DEFAULT (0);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'DeletedAt'
)
BEGIN
    ALTER TABLE dbo.Users
    ADD DeletedAt DATETIME2 NULL;
END
GO
