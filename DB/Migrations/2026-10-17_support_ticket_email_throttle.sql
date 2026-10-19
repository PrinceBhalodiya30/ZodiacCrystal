-- 2026-10-17: support ticket email throttle.
--
-- Idempotent and non-destructive. Records when the customer was last emailed
-- about a ticket, so a burst of admin replies (or a reply followed by "Mark
-- resolved") sends one email instead of several. Run after
-- 2026-10-17_support_tickets.sql.

SET XACT_ABORT ON;
GO

IF COL_LENGTH(N'dbo.SupportTickets', N'CustomerEmailedAt') IS NULL
    ALTER TABLE dbo.SupportTickets ADD CustomerEmailedAt DATETIME2 NULL;
GO
