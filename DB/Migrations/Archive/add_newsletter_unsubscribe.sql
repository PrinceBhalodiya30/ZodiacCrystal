-- Adds unsubscribe support to the newsletter.
-- Subscribers are never deleted: unsubscribing just marks them inactive, so we
-- keep proof of when they left and can't accidentally email them again.
-- Every subscriber gets a secret token for their one-click unsubscribe link.

ALTER TABLE NewsletterSubscribers ADD IsActive BIT NOT NULL CONSTRAINT DF_NewsletterSubscribers_IsActive DEFAULT 1;
ALTER TABLE NewsletterSubscribers ADD UnsubscribedAt DATETIME2 NULL;
ALTER TABLE NewsletterSubscribers ADD UnsubscribeToken NVARCHAR(64) NULL;
GO

UPDATE NewsletterSubscribers
SET UnsubscribeToken = LOWER(REPLACE(CONVERT(NVARCHAR(36), NEWID()), '-', '') + REPLACE(CONVERT(NVARCHAR(36), NEWID()), '-', ''))
WHERE UnsubscribeToken IS NULL;
GO

ALTER TABLE NewsletterSubscribers ALTER COLUMN UnsubscribeToken NVARCHAR(64) NOT NULL;
CREATE UNIQUE INDEX IX_NewsletterSubscribers_UnsubscribeToken ON NewsletterSubscribers (UnsubscribeToken);
GO
