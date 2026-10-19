-- CrystalsDB baseline schema (authoritative).
--
-- Scripted from the live CrystalsDB catalog on 2026-10-14. It already contains
-- every change from the scripts in Migrations/Archive, so those are never run
-- on a new database. See DB/README.md for the full process.
--
-- Idempotent: each object is created only if it doesn't exist, so running it
-- against an existing CrystalsDB changes nothing. Run while connected to the
-- target database (it does not create or switch databases).

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.Addresses', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Addresses
    (
        [AddressId] int IDENTITY(1,1) NOT NULL,
        [UserId] int NOT NULL,
        [FullName] nvarchar(100) NOT NULL,
        [Phone] nvarchar(20) NOT NULL,
        [AddressLine1] nvarchar(200) NOT NULL,
        [AddressLine2] nvarchar(200) NULL,
        [City] nvarchar(100) NOT NULL,
        [State] nvarchar(100) NOT NULL,
        [PostalCode] nvarchar(20) NOT NULL,
        [Country] nvarchar(100) NOT NULL,
        [AddressType] nvarchar(20) NOT NULL CONSTRAINT [DF__Addresses__Addre__17036CC0] DEFAULT ('Home'),
        [IsDefault] bit NOT NULL CONSTRAINT [DF__Addresses__IsDef__17F790F9] DEFAULT ((0)),
        [CreatedAt] datetime2(7) NOT NULL CONSTRAINT [DF__Addresses__Creat__18EBB532] DEFAULT (sysutcdatetime()),
        [Latitude] decimal(9,6) NULL,
        [Longitude] decimal(9,6) NULL,
        CONSTRAINT [PK__Addresse__091C2AFBB8F2E52D] PRIMARY KEY CLUSTERED ([AddressId])
    );
END
GO

IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditLogs
    (
        [AuditLogId] int IDENTITY(1,1) NOT NULL,
        [AdminUserId] int NOT NULL,
        [Action] nvarchar(50) NOT NULL,
        [EntityType] nvarchar(50) NOT NULL,
        [EntityId] int NULL,
        [Details] nvarchar(500) NULL,
        [CreatedAt] datetime2(7) NOT NULL CONSTRAINT [DF__AuditLogs__Creat__3C34F16F] DEFAULT (sysutcdatetime()),
        CONSTRAINT [PK__AuditLog__EB5F6CBD7A850E04] PRIMARY KEY CLUSTERED ([AuditLogId])
    );
END
GO

IF OBJECT_ID(N'dbo.Categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Categories
    (
        [CategoryId] int IDENTITY(1,1) NOT NULL,
        [Name] nvarchar(100) NOT NULL,
        [Description] nvarchar(500) NULL,
        [ParentCategoryId] int NULL,
        [IsActive] bit NOT NULL CONSTRAINT [DF__Categorie__IsAct__37A5467C] DEFAULT ((1)),
        CONSTRAINT [PK__Categori__19093A0B87A72248] PRIMARY KEY CLUSTERED ([CategoryId])
    );
END
GO

IF OBJECT_ID(N'dbo.Coupons', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Coupons
    (
        [CouponId] int IDENTITY(1,1) NOT NULL,
        [Code] nvarchar(50) NOT NULL,
        [Description] nvarchar(500) NULL,
        [DiscountType] nvarchar(20) NOT NULL,
        [DiscountValue] decimal(10,2) NOT NULL,
        [MinimumOrderAmount] decimal(10,2) NOT NULL CONSTRAINT [DF__Coupons__Minimum__02FC7413] DEFAULT ((0)),
        [StartDate] datetime2(7) NOT NULL,
        [EndDate] datetime2(7) NOT NULL,
        [UsageLimit] int NOT NULL,
        [UsedCount] int NOT NULL CONSTRAINT [DF__Coupons__UsedCou__03F0984C] DEFAULT ((0)),
        [IsActive] bit NOT NULL CONSTRAINT [DF__Coupons__IsActiv__04E4BC85] DEFAULT ((1)),
        [CreatedAt] datetime2(7) NOT NULL CONSTRAINT [DF__Coupons__Created__05D8E0BE] DEFAULT (sysutcdatetime()),
        [NotifiedAt] datetime2(7) NULL,
        CONSTRAINT [PK__Coupons__384AF1BA13639D0B] PRIMARY KEY CLUSTERED ([CouponId])
    );
END
GO

IF OBJECT_ID(N'dbo.EmailChangeRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EmailChangeRequests
    (
        [UserId] int NOT NULL,
        [NewEmail] nvarchar(256) NOT NULL,
        [OtpHash] varbinary(32) NOT NULL,
        [SentAt] datetime2(7) NOT NULL,
        [ExpiresAt] datetime2(7) NOT NULL,
        [FailedAttempts] int NOT NULL CONSTRAINT [DF_EmailChangeRequests_FailedAttempts] DEFAULT ((0)),
        CONSTRAINT [PK_EmailChangeRequests] PRIMARY KEY CLUSTERED ([UserId])
    );
END
GO

IF OBJECT_ID(N'dbo.EmailChangeReverts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EmailChangeReverts
    (
        [RevertId] int IDENTITY(1,1) NOT NULL,
        [UserId] int NOT NULL,
        [OldEmail] nvarchar(256) NOT NULL,
        [NewEmail] nvarchar(256) NOT NULL,
        [TokenHash] varbinary(32) NOT NULL,
        [CreatedAt] datetime2(7) NOT NULL CONSTRAINT [DF_EmailChangeReverts_CreatedAt] DEFAULT (sysutcdatetime()),
        [ExpiresAt] datetime2(7) NOT NULL,
        [UsedAt] datetime2(7) NULL,
        CONSTRAINT [PK_EmailChangeReverts] PRIMARY KEY CLUSTERED ([RevertId])
    );
END
GO

IF OBJECT_ID(N'dbo.NewsletterSubscribers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.NewsletterSubscribers
    (
        [NewsletterSubscriberId] int IDENTITY(1,1) NOT NULL,
        [Email] nvarchar(256) NOT NULL,
        [SubscribedAt] datetime2(7) NOT NULL CONSTRAINT [DF_NewsletterSubscribers_SubscribedAt] DEFAULT (sysutcdatetime()),
        [IsActive] bit NOT NULL CONSTRAINT [DF_NewsletterSubscribers_IsActive] DEFAULT ((1)),
        [UnsubscribedAt] datetime2(7) NULL,
        [UnsubscribeToken] nvarchar(64) NOT NULL,
        CONSTRAINT [PK_NewsletterSubscribers] PRIMARY KEY CLUSTERED ([NewsletterSubscriberId])
    );
END
GO

IF OBJECT_ID(N'dbo.Notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Notifications
    (
        [NotificationId] int IDENTITY(1,1) NOT NULL,
        [UserId] int NOT NULL,
        [OrderId] int NULL,
        [Title] nvarchar(150) NOT NULL,
        [Message] nvarchar(500) NOT NULL,
        [Type] nvarchar(30) NOT NULL,
        [IsRead] bit NOT NULL CONSTRAINT [DF__Notificat__IsRea__41B8C09B] DEFAULT ((0)),
        [CreatedAt] datetime2(7) NOT NULL CONSTRAINT [DF__Notificat__Creat__42ACE4D4] DEFAULT (sysutcdatetime()),
        [CouponId] int NULL,
        CONSTRAINT [PK__Notifica__20CF2E12A7108A1D] PRIMARY KEY CLUSTERED ([NotificationId])
    );
END
GO

IF OBJECT_ID(N'dbo.OrderItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.OrderItems
    (
        [OrderItemId] int IDENTITY(1,1) NOT NULL,
        [OrderId] int NOT NULL,
        [ProductId] int NOT NULL,
        [Quantity] int NOT NULL,
        [UnitPrice] decimal(10,2) NOT NULL,
        [Subtotal] decimal(10,2) NOT NULL,
        CONSTRAINT [PK_OrderItems] PRIMARY KEY CLUSTERED ([OrderItemId])
    );
END
GO

IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Orders
    (
        [OrderId] int IDENTITY(1,1) NOT NULL,
        [UserId] int NOT NULL,
        [OrderDate] datetime2(7) NOT NULL CONSTRAINT [DF_Orders_OrderDate] DEFAULT (getdate()),
        [TotalAmount] decimal(10,2) NOT NULL,
        [Status] nvarchar(20) NOT NULL CONSTRAINT [DF_Orders_Status] DEFAULT ('Pending'),
        [ShippingName] nvarchar(100) NOT NULL,
        [ShippingEmail] nvarchar(256) NOT NULL,
        [ShippingAddress] nvarchar(410) NOT NULL,
        [City] nvarchar(100) NOT NULL,
        [State] nvarchar(100) NOT NULL,
        [PostalCode] nvarchar(20) NOT NULL,
        [Phone] nvarchar(20) NOT NULL,
        [CouponCode] nvarchar(50) NULL,
        [DiscountAmount] decimal(10,2) NOT NULL CONSTRAINT [DF__Orders__Discount__06CD04F7] DEFAULT ((0)),
        [ShippingFee] decimal(10,2) NOT NULL CONSTRAINT [DF__Orders__Shipping__19AACF41] DEFAULT ((0)),
        [PaymentMethod] nvarchar(20) NOT NULL CONSTRAINT [DF_Orders_PaymentMethod] DEFAULT ('COD'),
        [PaymentStatus] nvarchar(20) NOT NULL CONSTRAINT [DF_Orders_PaymentStatus] DEFAULT ('Pending'),
        [PaymentTransactionId] nvarchar(64) NULL,
        [PaidAt] datetime2(7) NULL,
        [DeliveredAt] datetime2(7) NULL,
        [ConfirmedAt] datetime2(7) NULL,
        [ShippedAt] datetime2(7) NULL,
        [CourierName] nvarchar(50) NULL,
        [TrackingNumber] nvarchar(50) NULL,
        [CancellationReason] nvarchar(100) NULL,
        [Latitude] decimal(9,6) NULL,
        [Longitude] decimal(9,6) NULL,
        CONSTRAINT [PK_Orders] PRIMARY KEY CLUSTERED ([OrderId])
    );
END
GO

IF OBJECT_ID(N'dbo.ProductImages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductImages
    (
        [ProductImageId] int IDENTITY(1,1) NOT NULL,
        [ProductId] int NOT NULL,
        [ImageUrl] nvarchar(500) NOT NULL,
        [IsPrimary] bit NOT NULL CONSTRAINT [DF__ProductIm__IsPri__44FF419A] DEFAULT ((0)),
        CONSTRAINT [PK__ProductI__07B2B1B8F1C83069] PRIMARY KEY CLUSTERED ([ProductImageId])
    );
END
GO

IF OBJECT_ID(N'dbo.ProductReviews', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductReviews
    (
        [ReviewId] int IDENTITY(1,1) NOT NULL,
        [ProductId] int NOT NULL,
        [UserId] int NOT NULL,
        [Rating] int NOT NULL,
        [Comment] nvarchar(1000) NULL,
        [CreatedAt] datetime2(7) NOT NULL CONSTRAINT [DF__ProductRe__Creat__72C60C4A] DEFAULT (sysutcdatetime()),
        [Status] nvarchar(20) NOT NULL CONSTRAINT [DF__ProductRe__Statu__73852659] DEFAULT ('Approved'),
        [AdminReply] nvarchar(1000) NULL,
        [AdminReplyAt] datetime2(7) NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT [DF__ProductRe__IsDel__74794A92] DEFAULT ((0)),
        [DeletedAt] datetime2(7) NULL,
        CONSTRAINT [PK__ProductR__74BC79CE1BCC8059] PRIMARY KEY CLUSTERED ([ReviewId])
    );
END
GO

IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Products
    (
        [ProductId] int IDENTITY(1,1) NOT NULL,
        [SKU] nvarchar(50) NOT NULL,
        [Name] nvarchar(150) NOT NULL,
        [Description] nvarchar(MAX) NULL,
        [Price] decimal(10,2) NOT NULL,
        [StockQuantity] int NOT NULL CONSTRAINT [DF__Products__StockQ__3F466844] DEFAULT ((0)),
        [CategoryId] int NOT NULL,
        [IsActive] bit NOT NULL CONSTRAINT [DF__Products__IsActi__403A8C7D] DEFAULT ((1)),
        [CreatedAt] datetime2(7) NOT NULL CONSTRAINT [DF__Products__Create__412EB0B6] DEFAULT (getdate()),
        [CompareAtPrice] decimal(10,2) NULL,
        CONSTRAINT [PK__Products__B40CC6CDF3F78709] PRIMARY KEY CLUSTERED ([ProductId]),
        CONSTRAINT [UQ__Products__CA1ECF0D4A82C034] UNIQUE NONCLUSTERED ([SKU])
    );
END
GO

IF OBJECT_ID(N'dbo.ProductZodiacs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductZodiacs
    (
        [ProductId] int NOT NULL,
        [ZodiacId] int NOT NULL,
        CONSTRAINT [PK__ProductZ__4E722514214B6AA6] PRIMARY KEY CLUSTERED ([ProductId], [ZodiacId])
    );
END
GO

IF OBJECT_ID(N'dbo.RecentlyViewed', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RecentlyViewed
    (
        [RecentlyViewedId] int IDENTITY(1,1) NOT NULL,
        [UserId] int NOT NULL,
        [ProductId] int NOT NULL,
        [ViewedAt] datetime2(7) NOT NULL CONSTRAINT [DF__RecentlyV__Viewe__0EF836A4] DEFAULT (sysutcdatetime()),
        CONSTRAINT [PK__Recently__EDEACF379D201D04] PRIMARY KEY CLUSTERED ([RecentlyViewedId]),
        CONSTRAINT [UQ_RecentlyViewed_User_Product] UNIQUE NONCLUSTERED ([UserId], [ProductId])
    );
END
GO

IF OBJECT_ID(N'dbo.ReturnRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReturnRequests
    (
        [ReturnRequestId] int IDENTITY(1,1) NOT NULL,
        [OrderId] int NOT NULL,
        [UserId] int NOT NULL,
        [Reason] nvarchar(30) NOT NULL,
        [Details] nvarchar(1000) NULL,
        [Status] nvarchar(20) NOT NULL CONSTRAINT [DF_ReturnRequests_Status] DEFAULT ('Requested'),
        [AdminNote] nvarchar(500) NULL,
        [Restocked] bit NOT NULL CONSTRAINT [DF_ReturnRequests_Restocked] DEFAULT ((0)),
        [CreatedAt] datetime2(7) NOT NULL CONSTRAINT [DF_ReturnRequests_CreatedAt] DEFAULT (sysutcdatetime()),
        [ResolvedAt] datetime2(7) NULL,
        CONSTRAINT [PK_ReturnRequests] PRIMARY KEY CLUSTERED ([ReturnRequestId])
    );
END
GO

IF OBJECT_ID(N'dbo.SavedCarts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SavedCarts
    (
        [UserId] int NOT NULL,
        [ItemsJson] nvarchar(MAX) NOT NULL,
        [UpdatedAt] datetime2(7) NOT NULL CONSTRAINT [DF__SavedCart__Updat__4830B400] DEFAULT (sysutcdatetime()),
        [ReminderSentAt] datetime2(7) NULL,
        CONSTRAINT [PK_SavedCarts] PRIMARY KEY CLUSTERED ([UserId])
    );
END
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users
    (
        [UserId] int IDENTITY(1,1) NOT NULL,
        [Name] nvarchar(100) NOT NULL,
        [Email] nvarchar(256) NOT NULL,
        [PasswordHash] nvarchar(500) NOT NULL,
        [Role] nvarchar(20) NOT NULL CONSTRAINT [DF_Users_Role] DEFAULT ('User'),
        [CreatedAt] datetime2(7) NOT NULL CONSTRAINT [DF_Users_CreatedAt] DEFAULT (getdate()),
        [IsActive] bit NOT NULL CONSTRAINT [DF_Users_IsActive] DEFAULT ((1)),
        [IsDeleted] bit NOT NULL CONSTRAINT [DF_Users_IsDeleted] DEFAULT ((0)),
        [DeletedAt] datetime2(7) NULL,
        [SessionVersion] int NOT NULL CONSTRAINT [DF_Users_SessionVersion] DEFAULT ((0)),
        CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([UserId]),
        CONSTRAINT [UQ_Users_Email] UNIQUE NONCLUSTERED ([Email])
    );
END
GO

IF OBJECT_ID(N'dbo.Wishlists', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Wishlists
    (
        [WishlistId] int IDENTITY(1,1) NOT NULL,
        [UserId] int NOT NULL,
        [ProductId] int NOT NULL,
        [CreatedAt] datetime2(7) NOT NULL CONSTRAINT [DF__Wishlists__Creat__778AC167] DEFAULT (sysutcdatetime()),
        CONSTRAINT [PK__Wishlist__233189EB5D47B306] PRIMARY KEY CLUSTERED ([WishlistId])
    );
END
GO

IF OBJECT_ID(N'dbo.ZodiacSigns', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ZodiacSigns
    (
        [ZodiacId] int IDENTITY(1,1) NOT NULL,
        [Name] nvarchar(50) NOT NULL,
        [Symbol] nvarchar(10) NULL,
        [Description] nvarchar(500) NULL,
        [ImageUrl] nvarchar(500) NULL,
        CONSTRAINT [PK__ZodiacSi__A7EE3D9EC16415CB] PRIMARY KEY CLUSTERED ([ZodiacId]),
        CONSTRAINT [UQ__ZodiacSi__737584F65EBA2ECE] UNIQUE NONCLUSTERED ([Name])
    );
END
GO

IF OBJECT_ID(N'dbo.CK_OrderItems_Quantity', N'C') IS NULL
    ALTER TABLE dbo.OrderItems ADD CONSTRAINT [CK_OrderItems_Quantity] CHECK ([Quantity]>(0));
GO

IF OBJECT_ID(N'dbo.CK_Orders_Status', N'C') IS NULL
    ALTER TABLE dbo.Orders ADD CONSTRAINT [CK_Orders_Status] CHECK ([Status]='Cancelled' OR [Status]='Delivered' OR [Status]='Shipped' OR [Status]='Confirmed' OR [Status]='Pending');
GO

IF OBJECT_ID(N'dbo.CK__ProductRe__Ratin__71D1E811', N'C') IS NULL
    ALTER TABLE dbo.ProductReviews ADD CONSTRAINT [CK__ProductRe__Ratin__71D1E811] CHECK ([Rating]>=(1) AND [Rating]<=(5));
GO

IF OBJECT_ID(N'dbo.CK_Users_Role', N'C') IS NULL
    ALTER TABLE dbo.Users ADD CONSTRAINT [CK_Users_Role] CHECK ([Role]='Admin' OR [Role]='User');
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditLogs_CreatedAt' AND object_id = OBJECT_ID(N'dbo.AuditLogs'))
    CREATE NONCLUSTERED INDEX [IX_AuditLogs_CreatedAt] ON dbo.AuditLogs ([CreatedAt]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_Coupons_Code' AND object_id = OBJECT_ID(N'dbo.Coupons'))
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_Coupons_Code] ON dbo.Coupons ([Code]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EmailChangeReverts_UserId' AND object_id = OBJECT_ID(N'dbo.EmailChangeReverts'))
    CREATE NONCLUSTERED INDEX [IX_EmailChangeReverts_UserId] ON dbo.EmailChangeReverts ([UserId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_EmailChangeReverts_TokenHash' AND object_id = OBJECT_ID(N'dbo.EmailChangeReverts'))
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_EmailChangeReverts_TokenHash] ON dbo.EmailChangeReverts ([TokenHash]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_NewsletterSubscribers_UnsubscribeToken' AND object_id = OBJECT_ID(N'dbo.NewsletterSubscribers'))
    CREATE UNIQUE NONCLUSTERED INDEX [IX_NewsletterSubscribers_UnsubscribeToken] ON dbo.NewsletterSubscribers ([UnsubscribeToken]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_NewsletterSubscribers_Email' AND object_id = OBJECT_ID(N'dbo.NewsletterSubscribers'))
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_NewsletterSubscribers_Email] ON dbo.NewsletterSubscribers ([Email]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_CouponId' AND object_id = OBJECT_ID(N'dbo.Notifications'))
    CREATE NONCLUSTERED INDEX [IX_Notifications_CouponId] ON dbo.Notifications ([CouponId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_UserId_IsRead' AND object_id = OBJECT_ID(N'dbo.Notifications'))
    CREATE NONCLUSTERED INDEX [IX_Notifications_UserId_IsRead] ON dbo.Notifications ([UserId], [IsRead]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_OrderItems_OrderId' AND object_id = OBJECT_ID(N'dbo.OrderItems'))
    CREATE NONCLUSTERED INDEX [IX_OrderItems_OrderId] ON dbo.OrderItems ([OrderId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Orders_UserId' AND object_id = OBJECT_ID(N'dbo.Orders'))
    CREATE NONCLUSTERED INDEX [IX_Orders_UserId] ON dbo.Orders ([UserId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_ProductReviews_Product_User' AND object_id = OBJECT_ID(N'dbo.ProductReviews'))
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_ProductReviews_Product_User] ON dbo.ProductReviews ([ProductId], [UserId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_RecentlyViewed_UserId_ViewedAt' AND object_id = OBJECT_ID(N'dbo.RecentlyViewed'))
    CREATE NONCLUSTERED INDEX [IX_RecentlyViewed_UserId_ViewedAt] ON dbo.RecentlyViewed ([UserId], [ViewedAt] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ReturnRequests_Status' AND object_id = OBJECT_ID(N'dbo.ReturnRequests'))
    CREATE NONCLUSTERED INDEX [IX_ReturnRequests_Status] ON dbo.ReturnRequests ([Status]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ReturnRequests_UserId' AND object_id = OBJECT_ID(N'dbo.ReturnRequests'))
    CREATE NONCLUSTERED INDEX [IX_ReturnRequests_UserId] ON dbo.ReturnRequests ([UserId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_ReturnRequests_OrderId' AND object_id = OBJECT_ID(N'dbo.ReturnRequests'))
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_ReturnRequests_OrderId] ON dbo.ReturnRequests ([OrderId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SavedCarts_UpdatedAt' AND object_id = OBJECT_ID(N'dbo.SavedCarts'))
    CREATE NONCLUSTERED INDEX [IX_SavedCarts_UpdatedAt] ON dbo.SavedCarts ([UpdatedAt]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_Wishlists_User_Product' AND object_id = OBJECT_ID(N'dbo.Wishlists'))
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_Wishlists_User_Product] ON dbo.Wishlists ([UserId], [ProductId]);
GO

IF OBJECT_ID(N'dbo.FK__Addresses__UserI__160F4887', N'F') IS NULL
    ALTER TABLE dbo.Addresses ADD CONSTRAINT [FK__Addresses__UserI__160F4887] FOREIGN KEY ([UserId]) REFERENCES dbo.Users ([UserId]);
GO

IF OBJECT_ID(N'dbo.FK_AuditLogs_Users', N'F') IS NULL
    ALTER TABLE dbo.AuditLogs ADD CONSTRAINT [FK_AuditLogs_Users] FOREIGN KEY ([AdminUserId]) REFERENCES dbo.Users ([UserId]);
GO

IF OBJECT_ID(N'dbo.FK_Categories_Parent', N'F') IS NULL
    ALTER TABLE dbo.Categories ADD CONSTRAINT [FK_Categories_Parent] FOREIGN KEY ([ParentCategoryId]) REFERENCES dbo.Categories ([CategoryId]);
GO

IF OBJECT_ID(N'dbo.FK_EmailChangeRequests_Users', N'F') IS NULL
    ALTER TABLE dbo.EmailChangeRequests ADD CONSTRAINT [FK_EmailChangeRequests_Users] FOREIGN KEY ([UserId]) REFERENCES dbo.Users ([UserId]) ON DELETE CASCADE;
GO

IF OBJECT_ID(N'dbo.FK_EmailChangeReverts_Users', N'F') IS NULL
    ALTER TABLE dbo.EmailChangeReverts ADD CONSTRAINT [FK_EmailChangeReverts_Users] FOREIGN KEY ([UserId]) REFERENCES dbo.Users ([UserId]) ON DELETE CASCADE;
GO

IF OBJECT_ID(N'dbo.FK_Notifications_Coupons', N'F') IS NULL
    ALTER TABLE dbo.Notifications ADD CONSTRAINT [FK_Notifications_Coupons] FOREIGN KEY ([CouponId]) REFERENCES dbo.Coupons ([CouponId]) ON DELETE CASCADE;
GO

IF OBJECT_ID(N'dbo.FK_Notifications_Orders', N'F') IS NULL
    ALTER TABLE dbo.Notifications ADD CONSTRAINT [FK_Notifications_Orders] FOREIGN KEY ([OrderId]) REFERENCES dbo.Orders ([OrderId]) ON DELETE SET NULL;
GO

IF OBJECT_ID(N'dbo.FK_Notifications_Users', N'F') IS NULL
    ALTER TABLE dbo.Notifications ADD CONSTRAINT [FK_Notifications_Users] FOREIGN KEY ([UserId]) REFERENCES dbo.Users ([UserId]);
GO

IF OBJECT_ID(N'dbo.FK_OrderItems_Orders', N'F') IS NULL
    ALTER TABLE dbo.OrderItems ADD CONSTRAINT [FK_OrderItems_Orders] FOREIGN KEY ([OrderId]) REFERENCES dbo.Orders ([OrderId]) ON DELETE CASCADE;
GO

IF OBJECT_ID(N'dbo.FK_OrderItems_Products', N'F') IS NULL
    ALTER TABLE dbo.OrderItems ADD CONSTRAINT [FK_OrderItems_Products] FOREIGN KEY ([ProductId]) REFERENCES dbo.Products ([ProductId]);
GO

IF OBJECT_ID(N'dbo.FK_Orders_Users', N'F') IS NULL
    ALTER TABLE dbo.Orders ADD CONSTRAINT [FK_Orders_Users] FOREIGN KEY ([UserId]) REFERENCES dbo.Users ([UserId]);
GO

IF OBJECT_ID(N'dbo.FK_ProductImages_Products', N'F') IS NULL
    ALTER TABLE dbo.ProductImages ADD CONSTRAINT [FK_ProductImages_Products] FOREIGN KEY ([ProductId]) REFERENCES dbo.Products ([ProductId]) ON DELETE CASCADE;
GO

IF OBJECT_ID(N'dbo.FK__ProductRe__Produ__6FE99F9F', N'F') IS NULL
    ALTER TABLE dbo.ProductReviews ADD CONSTRAINT [FK__ProductRe__Produ__6FE99F9F] FOREIGN KEY ([ProductId]) REFERENCES dbo.Products ([ProductId]);
GO

IF OBJECT_ID(N'dbo.FK__ProductRe__UserI__70DDC3D8', N'F') IS NULL
    ALTER TABLE dbo.ProductReviews ADD CONSTRAINT [FK__ProductRe__UserI__70DDC3D8] FOREIGN KEY ([UserId]) REFERENCES dbo.Users ([UserId]);
GO

IF OBJECT_ID(N'dbo.FK_Products_Categories', N'F') IS NULL
    ALTER TABLE dbo.Products ADD CONSTRAINT [FK_Products_Categories] FOREIGN KEY ([CategoryId]) REFERENCES dbo.Categories ([CategoryId]);
GO

IF OBJECT_ID(N'dbo.FK_ProductZodiacs_Products', N'F') IS NULL
    ALTER TABLE dbo.ProductZodiacs ADD CONSTRAINT [FK_ProductZodiacs_Products] FOREIGN KEY ([ProductId]) REFERENCES dbo.Products ([ProductId]) ON DELETE CASCADE;
GO

IF OBJECT_ID(N'dbo.FK_ProductZodiacs_Zodiac', N'F') IS NULL
    ALTER TABLE dbo.ProductZodiacs ADD CONSTRAINT [FK_ProductZodiacs_Zodiac] FOREIGN KEY ([ZodiacId]) REFERENCES dbo.ZodiacSigns ([ZodiacId]) ON DELETE CASCADE;
GO

IF OBJECT_ID(N'dbo.FK_RecentlyViewed_Products', N'F') IS NULL
    ALTER TABLE dbo.RecentlyViewed ADD CONSTRAINT [FK_RecentlyViewed_Products] FOREIGN KEY ([ProductId]) REFERENCES dbo.Products ([ProductId]) ON DELETE CASCADE;
GO

IF OBJECT_ID(N'dbo.FK_RecentlyViewed_Users', N'F') IS NULL
    ALTER TABLE dbo.RecentlyViewed ADD CONSTRAINT [FK_RecentlyViewed_Users] FOREIGN KEY ([UserId]) REFERENCES dbo.Users ([UserId]) ON DELETE CASCADE;
GO

IF OBJECT_ID(N'dbo.FK_ReturnRequests_Orders', N'F') IS NULL
    ALTER TABLE dbo.ReturnRequests ADD CONSTRAINT [FK_ReturnRequests_Orders] FOREIGN KEY ([OrderId]) REFERENCES dbo.Orders ([OrderId]);
GO

IF OBJECT_ID(N'dbo.FK_ReturnRequests_Users', N'F') IS NULL
    ALTER TABLE dbo.ReturnRequests ADD CONSTRAINT [FK_ReturnRequests_Users] FOREIGN KEY ([UserId]) REFERENCES dbo.Users ([UserId]);
GO

IF OBJECT_ID(N'dbo.FK_SavedCarts_Users', N'F') IS NULL
    ALTER TABLE dbo.SavedCarts ADD CONSTRAINT [FK_SavedCarts_Users] FOREIGN KEY ([UserId]) REFERENCES dbo.Users ([UserId]) ON DELETE CASCADE;
GO

IF OBJECT_ID(N'dbo.FK__Wishlists__Produ__76969D2E', N'F') IS NULL
    ALTER TABLE dbo.Wishlists ADD CONSTRAINT [FK__Wishlists__Produ__76969D2E] FOREIGN KEY ([ProductId]) REFERENCES dbo.Products ([ProductId]);
GO

IF OBJECT_ID(N'dbo.FK__Wishlists__UserI__75A278F5', N'F') IS NULL
    ALTER TABLE dbo.Wishlists ADD CONSTRAINT [FK__Wishlists__UserI__75A278F5] FOREIGN KEY ([UserId]) REFERENCES dbo.Users ([UserId]);
GO

