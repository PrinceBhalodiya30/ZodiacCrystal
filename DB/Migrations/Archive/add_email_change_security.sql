-- Email-change hardening:
--  * Users.SessionVersion is copied into every login token; bumping it signs out
--    every other device (done on email change and on "this wasn't me" undo).
--  * EmailChangeRequests holds the pending change + hashed code in the database,
--    so an API restart (or a second server) doesn't lose it.
--  * EmailChangeReverts holds the one-time "this wasn't me" link sent to the old
--    address (hash only), which restores that address.

ALTER TABLE Users ADD SessionVersion INT NOT NULL
    CONSTRAINT DF_Users_SessionVersion DEFAULT 0;

CREATE TABLE EmailChangeRequests (
    UserId INT NOT NULL CONSTRAINT PK_EmailChangeRequests PRIMARY KEY
        CONSTRAINT FK_EmailChangeRequests_Users FOREIGN KEY REFERENCES Users(UserId) ON DELETE CASCADE,
    NewEmail NVARCHAR(256) NOT NULL,
    OtpHash VARBINARY(32) NOT NULL,
    SentAt DATETIME2 NOT NULL,
    ExpiresAt DATETIME2 NOT NULL,
    FailedAttempts INT NOT NULL CONSTRAINT DF_EmailChangeRequests_FailedAttempts DEFAULT 0
);

CREATE TABLE EmailChangeReverts (
    RevertId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EmailChangeReverts PRIMARY KEY,
    UserId INT NOT NULL
        CONSTRAINT FK_EmailChangeReverts_Users FOREIGN KEY REFERENCES Users(UserId) ON DELETE CASCADE,
    OldEmail NVARCHAR(256) NOT NULL,
    NewEmail NVARCHAR(256) NOT NULL,
    TokenHash VARBINARY(32) NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_EmailChangeReverts_CreatedAt DEFAULT SYSUTCDATETIME(),
    ExpiresAt DATETIME2 NOT NULL,
    UsedAt DATETIME2 NULL
);

CREATE UNIQUE INDEX UQ_EmailChangeReverts_TokenHash ON EmailChangeReverts (TokenHash);
CREATE INDEX IX_EmailChangeReverts_UserId ON EmailChangeReverts (UserId);
