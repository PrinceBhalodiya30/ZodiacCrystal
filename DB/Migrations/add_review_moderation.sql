-- Adds review moderation support: status, admin reply, soft delete.
-- Existing reviews default to 'Approved' so current product-page behavior is unchanged.

ALTER TABLE ProductReviews ADD Status NVARCHAR(20) NOT NULL DEFAULT 'Approved';
ALTER TABLE ProductReviews ADD AdminReply NVARCHAR(1000) NULL;
ALTER TABLE ProductReviews ADD AdminReplyAt DATETIME2 NULL;
ALTER TABLE ProductReviews ADD IsDeleted BIT NOT NULL DEFAULT 0;
ALTER TABLE ProductReviews ADD DeletedAt DATETIME2 NULL;
