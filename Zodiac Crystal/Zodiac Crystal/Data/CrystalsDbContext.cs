using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Data;

public partial class CrystalsDbContext : DbContext
{
    public CrystalsDbContext()
    {
    }

    public CrystalsDbContext(DbContextOptions<CrystalsDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Category> Categories { get; set; }

    public virtual DbSet<Product> Products { get; set; }

    public virtual DbSet<ProductImage> ProductImages { get; set; }

    public virtual DbSet<ZodiacSign> ZodiacSigns { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<Order> Orders { get; set; }

    public virtual DbSet<OrderItem> OrderItems { get; set; }

    public virtual DbSet<ProductReview> ProductReviews { get; set; }

    public virtual DbSet<Wishlist> Wishlists { get; set; }

    public virtual DbSet<SavedCart> SavedCarts { get; set; }

    public virtual DbSet<EmailChangeRequest> EmailChangeRequests { get; set; }

    public virtual DbSet<EmailChangeRevert> EmailChangeReverts { get; set; }

    public virtual DbSet<NewsletterSubscriber> NewsletterSubscribers { get; set; }

    public virtual DbSet<Coupon> Coupons { get; set; }

    public virtual DbSet<Address> Addresses { get; set; }

    public virtual DbSet<AuditLog> AuditLogs { get; set; }

    public virtual DbSet<Notification> Notifications { get; set; }

    public virtual DbSet<StockAlert> StockAlerts { get; set; }

    public virtual DbSet<ReviewImage> ReviewImages { get; set; }

    public virtual DbSet<ReturnRequest> ReturnRequests { get; set; }

    public virtual DbSet<SupportTicket> SupportTickets { get; set; }

    public virtual DbSet<TicketMessage> TicketMessages { get; set; }

    public virtual DbSet<OrderAccessToken> OrderAccessTokens { get; set; }

    public virtual DbSet<RecentlyViewed> RecentlyViewed { get; set; }

    public virtual DbSet<PaymentFailure> PaymentFailures { get; set; }

    public virtual DbSet<StoreSetting> StoreSettings { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.CategoryId).HasName("PK__Categori__19093A0B87A72248");

            entity.Property(e => e.IsActive).HasDefaultValue(true);

            entity.HasOne(d => d.ParentCategory).WithMany(p => p.InverseParentCategory).HasConstraintName("FK_Categories_Parent");
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.ProductId).HasName("PK__Products__B40CC6CDF3F78709");

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.IsActive).HasDefaultValue(true);

            entity.HasOne(d => d.Category).WithMany(p => p.Products)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Products_Categories");

            entity.HasIndex(e => e.CategoryId).HasDatabaseName("IX_Products_CategoryId");

            entity.HasMany(d => d.Zodiacs).WithMany(p => p.Products)
                .UsingEntity<Dictionary<string, object>>(
                    "ProductZodiac",
                    r => r.HasOne<ZodiacSign>().WithMany()
                        .HasForeignKey("ZodiacId")
                        .HasConstraintName("FK_ProductZodiacs_Zodiac"),
                    l => l.HasOne<Product>().WithMany()
                        .HasForeignKey("ProductId")
                        .HasConstraintName("FK_ProductZodiacs_Products"),
                    j =>
                    {
                        j.HasKey("ProductId", "ZodiacId").HasName("PK__ProductZ__4E722514214B6AA6");
                        j.ToTable("ProductZodiacs");
                        j.HasIndex("ZodiacId").HasDatabaseName("IX_ProductZodiacs_ZodiacId");
                    });
        });

        modelBuilder.Entity<ProductImage>(entity =>
        {
            entity.HasKey(e => e.ProductImageId).HasName("PK__ProductI__07B2B1B8F1C83069");

            entity.HasOne(d => d.Product).WithMany(p => p.ProductImages).HasConstraintName("FK_ProductImages_Products");

            entity.HasIndex(e => e.ProductId).HasDatabaseName("IX_ProductImages_ProductId");
        });

        modelBuilder.Entity<ZodiacSign>(entity =>
        {
            entity.HasKey(e => e.ZodiacId).HasName("PK__ZodiacSi__A7EE3D9EC16415CB");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("PK_Users");

            entity.Property(e => e.Role).HasDefaultValue("User");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.IsDeleted).HasDefaultValue(false);
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.OrderId).HasName("PK_Orders");

            entity.HasIndex(e => new { e.UserId, e.OrderDate })
                .IsDescending(false, true)
                .HasDatabaseName("IX_Orders_UserId_OrderDate");

            entity.Property(e => e.OrderDate).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Status).HasDefaultValue("Pending");
            entity.Property(e => e.ShippingFee).HasDefaultValue(0m);
            entity.Property(e => e.PaymentMethod).HasDefaultValue("COD");
            entity.Property(e => e.PaymentStatus).HasDefaultValue("Pending");

            entity.HasIndex(e => new { e.UserId, e.IdempotencyKey })
                .IsUnique()
                .HasFilter("[IdempotencyKey] IS NOT NULL")
                .HasDatabaseName("UX_Orders_UserId_IdempotencyKey");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_Orders_Users");
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.HasKey(e => e.OrderItemId).HasName("PK_OrderItems");

            entity.HasOne(d => d.Order).WithMany(p => p.OrderItems)
                .HasForeignKey(d => d.OrderId)
                .HasConstraintName("FK_OrderItems_Orders");

            entity.HasOne(d => d.Product).WithMany()
                .HasForeignKey(d => d.ProductId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OrderItems_Products");
        });

        modelBuilder.Entity<ProductReview>(entity =>
        {
            entity.HasKey(e => e.ReviewId).HasName("PK__ProductR__74BC79AE");

            entity.HasIndex(e => new { e.ProductId, e.UserId }).IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.Property(e => e.Status).HasDefaultValue("Approved");

            entity.Property(e => e.IsDeleted).HasDefaultValue(false);

            entity.HasOne(d => d.Product).WithMany()
                .HasForeignKey(d => d.ProductId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ProductReviews_Products");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ProductReviews_Users");
        });

        modelBuilder.Entity<ReviewImage>(entity =>
        {
            entity.HasKey(e => e.ReviewImageId).HasName("PK_ReviewImages");

            entity.HasIndex(e => e.ReviewId).HasDatabaseName("IX_ReviewImages_ReviewId");

            entity.Property(e => e.Status).HasDefaultValue("Pending");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Review).WithMany(r => r.Images)
                .HasForeignKey(d => d.ReviewId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_ReviewImages_ProductReviews");
        });

        modelBuilder.Entity<RecentlyViewed>(entity =>
        {
            entity.ToTable("RecentlyViewed");

            entity.HasIndex(e => new { e.UserId, e.ProductId }).IsUnique();

            entity.Property(e => e.ViewedAt).HasDefaultValueSql("(sysutcdatetime())");

            // Cascade in the database too (see add_recently_viewed.sql): deleting a
            // product or user just drops their history rows.
            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_RecentlyViewed_Users");

            entity.HasOne(d => d.Product).WithMany()
                .HasForeignKey(d => d.ProductId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_RecentlyViewed_Products");
        });

        modelBuilder.Entity<SavedCart>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("PK_SavedCarts");

            entity.Property(e => e.UserId).ValueGeneratedNever();

            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_SavedCarts_Users");
        });

        modelBuilder.Entity<EmailChangeRequest>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("PK_EmailChangeRequests");

            entity.Property(e => e.UserId).ValueGeneratedNever();

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_EmailChangeRequests_Users");
        });

        modelBuilder.Entity<EmailChangeRevert>(entity =>
        {
            entity.HasKey(e => e.RevertId).HasName("PK_EmailChangeReverts");

            entity.HasIndex(e => e.TokenHash, "UQ_EmailChangeReverts_TokenHash").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_EmailChangeReverts_Users");
        });

        modelBuilder.Entity<Wishlist>(entity =>
        {
            entity.HasKey(e => e.WishlistId).HasName("PK_Wishlists");

            entity.HasIndex(e => new { e.UserId, e.ProductId }).IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Wishlists_Users");

            entity.HasOne(d => d.Product).WithMany()
                .HasForeignKey(d => d.ProductId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Wishlists_Products");
        });

        modelBuilder.Entity<NewsletterSubscriber>(entity =>
        {
            entity.HasKey(e => e.NewsletterSubscriberId).HasName("PK_NewsletterSubscribers");

            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.UnsubscribeToken).IsUnique();

            entity.Property(e => e.SubscribedAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
        });

        modelBuilder.Entity<Coupon>(entity =>
        {
            entity.HasKey(e => e.CouponId);

            entity.HasIndex(e => e.Code).IsUnique();

            entity.Property(e => e.MinimumOrderAmount).HasDefaultValue(0m);
            entity.Property(e => e.UsedCount).HasDefaultValue(0);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");
        });

        modelBuilder.Entity<Address>(entity =>
        {
            entity.HasKey(e => e.AddressId);

            entity.Property(e => e.AddressType).HasDefaultValue("Home");
            entity.Property(e => e.IsDefault).HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Addresses_Users");
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.AuditLogId);

            entity.HasIndex(e => e.CreatedAt);

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.AdminUser).WithMany()
                .HasForeignKey(d => d.AdminUserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_AuditLogs_Users");
        });

        modelBuilder.Entity<ReturnRequest>(entity =>
        {
            entity.HasIndex(e => e.OrderId, "UQ_ReturnRequests_OrderId").IsUnique();
            entity.HasIndex(e => e.UserId, "IX_ReturnRequests_UserId");
            entity.HasIndex(e => e.Status, "IX_ReturnRequests_Status");

            entity.Property(e => e.Status).HasDefaultValue("Requested");
            entity.Property(e => e.Restocked).HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Order).WithMany()
                .HasForeignKey(d => d.OrderId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ReturnRequests_Orders");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ReturnRequests_Users");
        });

        modelBuilder.Entity<SupportTicket>(entity =>
        {
            entity.HasIndex(e => e.UserId, "IX_SupportTickets_UserId");
            entity.HasIndex(e => new { e.Status, e.LastMessageAt }, "IX_SupportTickets_Status");
            entity.HasIndex(e => e.OrderId, "IX_SupportTickets_OrderId").HasFilter("([OrderId] IS NOT NULL)");

            entity.Property(e => e.Status).HasDefaultValue("Open");
            entity.Property(e => e.AdminUnread).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.LastMessageAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SupportTickets_Users");

            entity.HasOne(d => d.Order).WithMany()
                .HasForeignKey(d => d.OrderId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SupportTickets_Orders");
        });

        modelBuilder.Entity<OrderAccessToken>(entity =>
        {
            entity.HasIndex(e => e.TokenHash, "UX_OrderAccessTokens_TokenHash").IsUnique();
            entity.HasIndex(e => e.OrderId, "IX_OrderAccessTokens_OrderId");

            entity.Property(e => e.TokenHash).IsFixedLength();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Order).WithMany()
                .HasForeignKey(d => d.OrderId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_OrderAccessTokens_Orders");
        });

        modelBuilder.Entity<TicketMessage>(entity =>
        {
            entity.HasIndex(e => new { e.SupportTicketId, e.CreatedAt }, "IX_TicketMessages_SupportTicketId");

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.SupportTicket).WithMany(p => p.Messages)
                .HasForeignKey(d => d.SupportTicketId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_TicketMessages_SupportTickets");

            entity.HasOne(d => d.Sender).WithMany()
                .HasForeignKey(d => d.SenderUserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TicketMessages_Users");
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.NotificationId);

            entity.HasIndex(e => new { e.UserId, e.IsRead });

            entity.Property(e => e.IsRead).HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Notifications_Users");

            entity.HasOne(d => d.Order).WithMany()
                .HasForeignKey(d => d.OrderId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_Notifications_Orders");

            entity.HasOne(d => d.Coupon).WithMany()
                .HasForeignKey(d => d.CouponId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_Notifications_Coupons");

            entity.HasOne(d => d.Product).WithMany()
                .HasForeignKey(d => d.ProductId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_Notifications_Products");
        });

        modelBuilder.Entity<StockAlert>(entity =>
        {
            entity.HasKey(e => e.StockAlertId).HasName("PK_StockAlerts");

            entity.HasIndex(e => new { e.UserId, e.ProductId }).IsUnique().HasDatabaseName("UX_StockAlerts_UserId_ProductId");
            entity.HasIndex(e => e.ProductId).HasDatabaseName("IX_StockAlerts_ProductId");

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_StockAlerts_Users");

            entity.HasOne(d => d.Product).WithMany()
                .HasForeignKey(d => d.ProductId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_StockAlerts_Products");
        });

        modelBuilder.Entity<PaymentFailure>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_PaymentFailures");

            entity.HasIndex(e => new { e.Resolved, e.CreatedAt }).HasDatabaseName("IX_PaymentFailures_Resolved");

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Resolved).HasDefaultValue(false);
        });

        modelBuilder.Entity<StoreSetting>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_StoreSettings");
            entity.ToTable("StoreSettings");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(sysutcdatetime())");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
