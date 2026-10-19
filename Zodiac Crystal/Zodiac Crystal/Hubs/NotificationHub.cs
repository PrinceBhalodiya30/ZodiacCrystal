using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Zodiac_Crystal.Hubs
{
    // Every authenticated user is added to a group named after their own
    // UserId, so the server can push a notification to "user 42" without
    // tracking connection ids itself - a user can have multiple open tabs/
    // devices, and this reaches all of them.
    [Authorize]
    public class NotificationHub : Hub
    {
        public static string UserGroup(int userId) => $"user-{userId}";

        // Admins also join a shared group so live store events (e.g. a new
        // order) reach every open admin dashboard/orders page at once.
        public const string AdminsGroup = "admins";

        // Everyone else - customer-wide announcements such as a new coupon.
        public const string CustomersGroup = "customers";

        private readonly HubConnectionRegistry _registry;

        public NotificationHub(HubConnectionRegistry registry)
        {
            _registry = registry;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = Context.UserIdentifier;

            if (!string.IsNullOrEmpty(userId))
            {
                _registry.Add(int.Parse(userId), Context);
                await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(int.Parse(userId)));
            }

            if (Context.User?.IsInRole("Admin") == true)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, AdminsGroup);
            }
            else if (!string.IsNullOrEmpty(userId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, CustomersGroup);
            }

            await base.OnConnectedAsync();
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            _registry.Remove(Context.ConnectionId);
            return base.OnDisconnectedAsync(exception);
        }
    }
}
