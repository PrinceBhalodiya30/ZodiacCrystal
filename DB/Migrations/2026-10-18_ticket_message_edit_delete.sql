-- 2026-10-18: edit / delete admin messages in support tickets.
--
-- Idempotent and non-destructive. Deleting is a soft delete: the row and its
-- text stay (admins see it struck through), customers see "This message was
-- removed". Run after 2026-10-17_support_tickets.sql.

SET XACT_ABORT ON;
GO

IF COL_LENGTH(N'dbo.TicketMessages', N'EditedAt') IS NULL
    ALTER TABLE dbo.TicketMessages ADD EditedAt DATETIME2 NULL;
GO

IF COL_LENGTH(N'dbo.TicketMessages', N'DeletedAt') IS NULL
    ALTER TABLE dbo.TicketMessages ADD DeletedAt DATETIME2 NULL;
GO
