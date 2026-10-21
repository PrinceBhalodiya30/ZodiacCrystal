using System.Linq.Expressions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Hubs;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    // Persists a notification to SQL Server (so it's still there next time the
    // user logs in, even if they were offline) and, if the user currently has a
    // live SignalR connection, pushes it to them immediately too.
    public class NotificationService
    {
        private readonly CrystalsDbContext _context;
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly ILogger<NotificationService> _logger;
        private readonly ProductAlertTrigger _productAlertTrigger;

        public NotificationService(CrystalsDbContext context, IHubContext<NotificationHub> hubContext, ILogger<NotificationService> logger, ProductAlertTrigger productAlertTrigger)
        {
            _context = context;
            _hubContext = hubContext;
            _logger = logger;
            _productAlertTrigger = productAlertTrigger;
        }

        // Live-only (not stored): tells every open admin screen that an order or
        // return changed, so lists, counts and badges refresh themselves.
        // kind = "order" | "return" | "review" | "user" | "subscriber". Never throws - the change is already saved.
        public async Task BroadcastAdminChangeAsync(string kind, int id, string action)
        {
            try
            {
                await _hubContext.Clients
                    .Group(NotificationHub.AdminsGroup)
                    .SendAsync("AdminDataChanged", new { kind, id, action });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Live admin update failed for {Kind} {Id}", kind, id);
            }
        }

        // Live-only: new stock levels for open product pages and carts.
        // Never throws - the stock change is already saved.
        public Task BroadcastStockAsync(IEnumerable<Product> products) =>
            BroadcastStockAsync(products
                .GroupBy(p => p.ProductId)
                .Select(g => (g.Key, g.First().StockQuantity)));

        public async Task BroadcastStockAsync(IEnumerable<(int ProductId, int StockQuantity)> levels)
        {
            var payload = levels.Select(l => new { productId = l.ProductId, stockQuantity = l.StockQuantity }).ToList();
            if (payload.Count == 0)
            {
                return;
            }

            // Something is buyable: check back-in-stock and price-drop alerts now.
            if (payload.Any(l => l.stockQuantity > 0))
            {
                _productAlertTrigger.Request();
            }

            try
            {
                await _hubContext.Clients.All.SendAsync("StockChanged", payload);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Live stock update failed");
            }
        }

        // Loads the product names straight from the database so it works no
        // matter which navigation properties the caller included.
        private async Task<string?> ItemsLabelAsync(int orderId)
        {
            var names = await _context.OrderItems
                .AsNoTracking()
                .Where(i => i.OrderId == orderId)
                .OrderBy(i => i.OrderItemId)
                .Select(i => i.Product.Name)
                .ToListAsync();

            return OrderItemsLabel.Describe(names);
        }

        public async Task NotifyOrderPlacedAsync(Order order)
        {
            var label = await ItemsLabelAsync(order.OrderId);

            await CreateAndPushAsync(
                order.UserId,
                order.OrderId,
                "Order Placed",
                label != null
                    ? $"Your order for {label} has been placed successfully. (Order #{order.OrderId})"
                    : $"Your order #{order.OrderId} has been placed successfully.",
                "OrderPlaced");

            // Live-only signal for admin screens (not persisted as a
            // notification) so the dashboard and orders list refresh themselves.
            await _hubContext.Clients
                .Group(NotificationHub.AdminsGroup)
                .SendAsync("AdminOrderPlaced", new
                {
                    order.OrderId,
                    order.TotalAmount,
                    CustomerName = order.User?.Name,
                    OrderDate = DateTime.SpecifyKind(order.OrderDate, DateTimeKind.Utc)
                });
        }

        public async Task NotifyOrderStatusChangedAsync(Order order, string previousStatus)
        {
            var label = await ItemsLabelAsync(order.OrderId);

            await CreateAndPushAsync(
                order.UserId,
                order.OrderId,
                "Order Status Updated",
                label != null
                    ? $"{label} {OrderItemsLabel.Verb(label)} now {order.Status}. (Order #{order.OrderId})"
                    : $"Order #{order.OrderId} is now {order.Status}.",
                "OrderStatusChanged");
        }

        public async Task NotifyLowStockAsync(int adminUserId, string productName, int stock)
        {
            await CreateAndPushAsync(
                adminUserId,
                null,
                stock <= 0 ? "Out of Stock" : "Low Stock",
                stock <= 0 ? $"{productName} is now out of stock." : $"{productName} has only {stock} left.",
                "LowStock");
        }

        public Task NotifyBackInStockAsync(int userId, int productId, string productName) =>
            CreateAndPushAsync(
                userId,
                null,
                "Back in Stock",
                $"{productName} is back in stock. Grab it before it sells out again.",
                "BackInStock",
                productId);

        public Task NotifyPriceDropAsync(int userId, int productId, string productName, decimal oldPrice, decimal newPrice) =>
            CreateAndPushAsync(
                userId,
                null,
                "Price Drop",
                $"{productName} on your wishlist dropped from ₹{oldPrice:0.##} to ₹{newPrice:0.##}.",
                "PriceDrop",
                productId);

        public async Task NotifyWelcomeAsync(User user)
        {
            await CreateAndPushAsync(
                user.UserId,
                null,
                $"Welcome, {user.Name}!",
                "Your Crystal Studio account is ready. Tap here to find the crystal for your sign.",
                "Welcome");
        }

        public async Task NotifyReturnUpdatedAsync(ReturnRequest returnRequest)
        {
            var label = await ItemsLabelAsync(returnRequest.OrderId);

            await CreateAndPushAsync(
                returnRequest.UserId,
                returnRequest.OrderId,
                "Return " + returnRequest.Status,
                label != null
                    ? $"Your return for {label} is now {returnRequest.Status}. (Order #{returnRequest.OrderId})"
                    : $"Your return for order #{returnRequest.OrderId} is now {returnRequest.Status}.",
                "ReturnUpdated");
        }

        // To the customer: the store replied to / resolved their ticket.
        public Task NotifyTicketUpdatedAsync(SupportTicket ticket, string title, string message) =>
            CreateAndPushAsync(ticket.UserId, ticket.OrderId, title, $"{message} (Ref ZC-{ticket.SupportTicketId})", "TicketUpdated");

        // To one admin: a customer opened or replied to a ticket.
        public Task NotifyAdminTicketAsync(int adminUserId, SupportTicket ticket, string title, string message) =>
            CreateAndPushAsync(adminUserId, null, title, $"{message} (Ref ZC-{ticket.SupportTicketId})", "SupportTicket");

        // One row per active customer, written in a single INSERT ... SELECT so a
        // large customer list doesn't round-trip through EF. Live customers get a
        // nudge to reload their bell. Returns how many customers were notified.
        public async Task<int> NotifyCouponAsync(Coupon coupon)
        {
            var (title, message) = CouponText(coupon);

            var recipients = await _context.Database.ExecuteSqlInterpolatedAsync($@"
                INSERT INTO dbo.Notifications (UserId, CouponId, Title, Message, Type)
                SELECT UserId, {coupon.CouponId}, {title}, {message}, 'Coupon'
                FROM dbo.Users
                WHERE Role = 'User' AND IsActive = 1 AND IsDeleted = 0");

            try
            {
                await _hubContext.Clients
                    .Group(NotificationHub.CustomersGroup)
                    .SendAsync("CouponAnnounced", new { title });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Live coupon announcement failed for coupon {CouponId}", coupon.CouponId);
            }

            return recipients;
        }

        // Built from the coupon's current details, both when sending and every
        // time the bell loads, so an admin edit (e.g. a corrected discount)
        // shows up in notifications already delivered.
        private static (string Title, string Message) CouponText(Coupon coupon)
        {
            var discount = string.Equals(coupon.DiscountType, "Percentage", StringComparison.OrdinalIgnoreCase)
                ? $"{coupon.DiscountValue:0.##}% off"
                : $"₹{coupon.DiscountValue:0.##} off";
            var minimum = coupon.MinimumOrderAmount > 0 ? $" on orders above ₹{coupon.MinimumOrderAmount:0.##}" : "";

            return ($"New offer: {coupon.Code}",
                $"Get {discount}{minimum} with code {coupon.Code}. Valid till {coupon.EndDate:d MMM yyyy}.");
        }

        // Coupon notifications disappear once the coupon stops working (expired,
        // deactivated, used up), so customers never chase a dead code. Same
        // checks as CouponsController.GetActiveCoupons.
        private static Expression<Func<Notification, bool>> IsVisible(DateTime now) =>
            n => n.CouponId == null
                || (n.Coupon!.IsActive
                    && n.Coupon.StartDate <= now
                    && n.Coupon.EndDate >= now
                    && n.Coupon.UsedCount < n.Coupon.UsageLimit);

        private async Task CreateAndPushAsync(int userId, int? orderId, string title, string message, string type, int? productId = null)
        {
            var notification = new Notification
            {
                UserId = userId,
                OrderId = orderId,
                ProductId = productId,
                Title = title,
                Message = message,
                Type = type
            };

            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();

            var dto = new NotificationDto
            {
                NotificationId = notification.NotificationId,
                OrderId = notification.OrderId,
                ProductId = notification.ProductId,
                Title = notification.Title,
                Message = notification.Message,
                Type = notification.Type,
                IsRead = notification.IsRead,
                CreatedAt = DateTime.SpecifyKind(notification.CreatedAt, DateTimeKind.Utc)
            };

            await _hubContext.Clients
                .Group(NotificationHub.UserGroup(userId))
                .SendAsync("ReceiveNotification", dto);
        }

        public async Task<(List<NotificationDto> Items, int UnreadCount)> GetForUserAsync(int userId, int take = 30)
        {
            var now = DateTime.UtcNow;

            var notifications = await _context.Notifications
                .AsNoTracking()
                .Include(n => n.Coupon)
                .Where(n => n.UserId == userId)
                .Where(IsVisible(now))
                .OrderByDescending(n => n.CreatedAt)
                .Take(take)
                .ToListAsync();

            var items = notifications.Select(n =>
            {
                var (title, message) = n.Coupon != null ? CouponText(n.Coupon) : (n.Title, n.Message);
                return new NotificationDto
                {
                    NotificationId = n.NotificationId,
                    OrderId = n.OrderId,
                    CouponCode = n.Coupon?.Code,
                    ProductId = n.ProductId,
                    Title = title,
                    Message = message,
                    Type = n.Type,
                    IsRead = n.IsRead,
                    CreatedAt = DateTime.SpecifyKind(n.CreatedAt, DateTimeKind.Utc)
                };
            }).ToList();

            var unreadCount = await GetUnreadCountAsync(userId);

            return (items, unreadCount);
        }

        public async Task<int> GetUnreadCountAsync(int userId)
        {
            return await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .Where(IsVisible(DateTime.UtcNow))
                .CountAsync();
        }

        // Returns false if the notification doesn't exist or doesn't belong to
        // this user, so the controller can return NotFound without ever
        // confirming to a caller whether some other user's notification exists.
        public async Task<bool> MarkAsReadAsync(int userId, int notificationId)
        {
            var rowsAffected = await _context.Notifications
                .Where(n => n.NotificationId == notificationId && n.UserId == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

            return rowsAffected > 0;
        }

        public async Task MarkAllAsReadAsync(int userId)
        {
            await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
        }
    }
}
