-- 2026-10-16: customer photos on product reviews.
--
-- Idempotent and non-destructive. Each photo is moderated on its own
-- (Pending -> Approved/Rejected), so a review's stars and text still appear
-- straight away while its photos wait for an admin. Photos are removed with
-- their review.

SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.ReviewImages', N'U') IS NULL
    CREATE TABLE dbo.ReviewImages
    (
        ReviewImageId INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_ReviewImages PRIMARY KEY,
        ReviewId      INT NOT NULL,
        ImageUrl      NVARCHAR(500) NOT NULL,
        Status        NVARCHAR(20) NOT NULL CONSTRAINT DF_ReviewImages_Status DEFAULT (N'Pending'),
        SortOrder     INT NOT NULL CONSTRAINT DF_ReviewImages_SortOrder DEFAULT (0),
        CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_ReviewImages_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_ReviewImages_ProductReviews FOREIGN KEY (ReviewId)
            REFERENCES dbo.ProductReviews (ReviewId) ON DELETE CASCADE
    );
GO

IF OBJECT_ID(N'dbo.CK_ReviewImages_Status', N'C') IS NULL
    ALTER TABLE dbo.ReviewImages ADD CONSTRAINT CK_ReviewImages_Status
        CHECK (Status IN (N'Pending', N'Approved', N'Rejected'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ReviewImages_ReviewId' AND object_id = OBJECT_ID(N'dbo.ReviewImages'))
    CREATE NONCLUSTERED INDEX IX_ReviewImages_ReviewId ON dbo.ReviewImages (ReviewId);
GO
