-- Server copy of each signed-in customer's cart (the cart itself lives in the browser),
-- so a cart left idle for a day can get one reminder email.

CREATE TABLE SavedCarts (
    UserId INT NOT NULL CONSTRAINT PK_SavedCarts PRIMARY KEY
        CONSTRAINT FK_SavedCarts_Users FOREIGN KEY REFERENCES Users(UserId) ON DELETE CASCADE,
    -- [{"productId":1,"quantity":2}, ...]
    ItemsJson NVARCHAR(MAX) NOT NULL,
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    -- Last reminder sent; a changed cart can be reminded about again, at most once a week.
    ReminderSentAt DATETIME2 NULL
);

CREATE INDEX IX_SavedCarts_UpdatedAt ON SavedCarts (UpdatedAt);
