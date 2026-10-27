CREATE TABLE NewsletterSubscribers (
    NewsletterSubscriberId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_NewsletterSubscribers PRIMARY KEY,
    Email NVARCHAR(256) NOT NULL,
    SubscribedAt DATETIME2 NOT NULL CONSTRAINT DF_NewsletterSubscribers_SubscribedAt DEFAULT (sysutcdatetime())
);

CREATE UNIQUE INDEX UQ_NewsletterSubscribers_Email ON NewsletterSubscribers(Email);
