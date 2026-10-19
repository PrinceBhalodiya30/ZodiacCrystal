-- ARCHIVED - do not run. Superseded by Schema/CrystalsDB.sql (schema) and
-- Seed/sample_data.sql (sample data); see DB/README.md. Kept for history only.
-- Plain-text admin credentials and a duplicate ProductZodiacs insert were
-- removed from this copy on 2026-10-14.

CREATE DATABASE CrystalsDB;

USE CrystalsDB;

CREATE TABLE Categories
(
    CategoryId INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    ParentCategoryId INT NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

ALTER TABLE Categories
ADD CONSTRAINT FK_Categories_Parent
FOREIGN KEY (ParentCategoryId)
REFERENCES Categories(CategoryId);

INSERT INTO Categories
(Name, Description)
VALUES
('Crystals', 'All types of crystal products');
INSERT INTO Categories
(Name, Description, ParentCategoryId)
VALUES
('Raw Crystals', 'Natural raw crystals', 1),
('Tumbled Crystals', 'Polished tumbled crystals', 1),
('Crystal Towers', 'Crystal tower products', 1),
('Crystal Spheres', 'Crystal sphere products', 1);


CREATE TABLE ZodiacSigns
(
    ZodiacId INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL UNIQUE,
    Symbol NVARCHAR(10) NULL,
    Description NVARCHAR(500) NULL,
    ImageUrl NVARCHAR(500) NULL
);

INSERT INTO ZodiacSigns
(Name, Symbol, Description)
VALUES
('Aries', '♈', 'Energetic, confident and passionate'),
('Taurus', '♉', 'Reliable, patient and practical'),
('Gemini', '♊', 'Curious, adaptable and social'),
('Cancer', '♋', 'Caring, emotional and intuitive'),
('Leo', '♌', 'Confident, passionate and generous'),
('Virgo', '♍', 'Practical, analytical and thoughtful'),
('Libra', '♎', 'Balanced, peaceful and diplomatic'),
('Scorpio', '♏', 'Passionate, determined and powerful'),
('Sagittarius', '♐', 'Adventurous, optimistic and independent'),
('Capricorn', '♑', 'Disciplined, responsible and ambitious'),
('Aquarius', '♒', 'Independent, creative and innovative'),
('Pisces', '♓', 'Compassionate, intuitive and imaginative');

CREATE TABLE Products
(
    ProductId INT IDENTITY(1,1) PRIMARY KEY,

    SKU NVARCHAR(50) NOT NULL UNIQUE,

    Name NVARCHAR(150) NOT NULL,

    Description NVARCHAR(MAX) NULL,

    Price DECIMAL(10,2) NOT NULL,

    CompareAtPrice DECIMAL(10,2) NULL,

    StockQuantity INT NOT NULL DEFAULT 0,

    CategoryId INT NOT NULL,

    IsActive BIT NOT NULL DEFAULT 1,

    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
);

ALTER TABLE Products
ADD CONSTRAINT FK_Products_Categories
FOREIGN KEY (CategoryId)
REFERENCES Categories(CategoryId);

INSERT INTO Products
(
    SKU,
    Name,
    Description,
    Price,
    StockQuantity,
    CategoryId
)
VALUES
(
    'AME-001',
    'Amethyst Tumbled Stone',
    'Beautiful polished Amethyst crystal.',
    499.00,
    25,
    3
),
(
    'ROS-001',
    'Rose Quartz Tumbled Stone',
    'Soft pink Rose Quartz crystal.',
    399.00,
    30,
    3
),
(
    'CIT-001',
    'Citrine Crystal Tower',
    'Natural Citrine crystal tower.',
    899.00,
    15,
    4
),
(
    'HEM-001',
    'Hematite Raw Crystal',
    'Natural Hematite raw crystal.',
    299.00,
    20,
    2
);

CREATE TABLE ProductImages
(
    ProductImageId INT IDENTITY(1,1) PRIMARY KEY,

    ProductId INT NOT NULL,

    ImageUrl NVARCHAR(500) NOT NULL,

    IsPrimary BIT NOT NULL DEFAULT 0
);

ALTER TABLE ProductImages
ADD CONSTRAINT FK_ProductImages_Products
FOREIGN KEY (ProductId)
REFERENCES Products(ProductId)
ON DELETE CASCADE;

INSERT INTO ProductImages
(ProductId, ImageUrl, IsPrimary)
VALUES
(1, 'https://example.com/amethyst.jpg', 1),
(2, 'https://example.com/rose-quartz.jpg', 1),
(3, 'https://example.com/citrine.jpg', 1),
(4, 'https://example.com/hematite.jpg', 1);

CREATE TABLE ProductZodiacs
(
    ProductId INT NOT NULL,

    ZodiacId INT NOT NULL,

    PRIMARY KEY (ProductId, ZodiacId)
);

ALTER TABLE ProductZodiacs
ADD CONSTRAINT FK_ProductZodiacs_Products
FOREIGN KEY (ProductId)
REFERENCES Products(ProductId)
ON DELETE CASCADE;

ALTER TABLE ProductZodiacs
ADD CONSTRAINT FK_ProductZodiacs_Zodiac
FOREIGN KEY (ZodiacId)
REFERENCES ZodiacSigns(ZodiacId)
ON DELETE CASCADE;

INSERT INTO ProductZodiacs
(ProductId, ZodiacId)
VALUES
(1, 12),
(1, 11),
(1, 9);

INSERT INTO ProductZodiacs
(ProductId, ZodiacId)
VALUES
(3, 1),
(3, 5),
(3, 9);

INSERT INTO ProductZodiacs
(ProductId, ZodiacId)
VALUES
(2, 2),
(2, 4),
(2, 7);


INSERT INTO ProductZodiacs
(ProductId, ZodiacId)
VALUES
(4, 1),
(4, 8);

SELECT
    p.ProductId,
    p.Name AS Product,
    p.Price,
    c.Name AS Category,
    z.Name AS Zodiac
FROM Products p
INNER JOIN Categories c
    ON p.CategoryId = c.CategoryId
INNER JOIN ProductZodiacs pz
    ON p.ProductId = pz.ProductId
INNER JOIN ZodiacSigns z
    ON pz.ZodiacId = z.ZodiacId
ORDER BY p.ProductId;

select * from ZodiacSigns

UPDATE ZodiacSigns SET Symbol = N'♈' WHERE ZodiacId = 1;
UPDATE ZodiacSigns SET Symbol = N'♉' WHERE ZodiacId = 2;
UPDATE ZodiacSigns SET Symbol = N'♊' WHERE ZodiacId = 3;
UPDATE ZodiacSigns SET Symbol = N'♋' WHERE ZodiacId = 4;
UPDATE ZodiacSigns SET Symbol = N'♌' WHERE ZodiacId = 5;
UPDATE ZodiacSigns SET Symbol = N'♍' WHERE ZodiacId = 6;
UPDATE ZodiacSigns SET Symbol = N'♎' WHERE ZodiacId = 7;
UPDATE ZodiacSigns SET Symbol = N'♏' WHERE ZodiacId = 8;
UPDATE ZodiacSigns SET Symbol = N'♐' WHERE ZodiacId = 9;
UPDATE ZodiacSigns SET Symbol = N'♑' WHERE ZodiacId = 10;
UPDATE ZodiacSigns SET Symbol = N'♒' WHERE ZodiacId = 11;
UPDATE ZodiacSigns SET Symbol = N'♓' WHERE ZodiacId = 12;






-- Admin Audit Log feature (added later - records who performed a sensitive
-- admin action, on what, and when). Idempotent, safe to run again.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AuditLogs')
BEGIN
    CREATE TABLE dbo.AuditLogs
    (
        AuditLogId INT IDENTITY(1,1) PRIMARY KEY,
        AdminUserId INT NOT NULL,
        Action NVARCHAR(50) NOT NULL,
        EntityType NVARCHAR(50) NOT NULL,
        EntityId INT NULL,
        Details NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (AdminUserId) REFERENCES dbo.Users(UserId)
    );

    CREATE INDEX IX_AuditLogs_CreatedAt ON dbo.AuditLogs(CreatedAt);
END


-- Real-time in-app notifications (order placed / order status changed) - see
-- DB/Migrations/add_notifications.sql. Idempotent, safe to run again.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Notifications')
BEGIN
    CREATE TABLE dbo.Notifications
    (
        NotificationId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        OrderId INT NULL,
        Title NVARCHAR(150) NOT NULL,
        Message NVARCHAR(500) NOT NULL,
        Type NVARCHAR(30) NOT NULL,
        IsRead BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_Notifications_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId) ON DELETE SET NULL
    );

    CREATE INDEX IX_Notifications_UserId_IsRead ON dbo.Notifications(UserId, IsRead);
END

-- Per-user Recently Viewed history - see DB/Migrations/add_recently_viewed.sql.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RecentlyViewed')
BEGIN
    CREATE TABLE dbo.RecentlyViewed
    (
        RecentlyViewedId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        ProductId INT NOT NULL,
        ViewedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_RecentlyViewed_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
        CONSTRAINT FK_RecentlyViewed_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId) ON DELETE CASCADE,
        CONSTRAINT UQ_RecentlyViewed_User_Product UNIQUE (UserId, ProductId)
    );

    CREATE INDEX IX_RecentlyViewed_UserId_ViewedAt ON dbo.RecentlyViewed(UserId, ViewedAt DESC);
END
