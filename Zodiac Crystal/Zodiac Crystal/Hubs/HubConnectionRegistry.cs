using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace Zodiac_Crystal.Hubs
{
    // Open notification-hub connections per user. A WebSocket is only
    // authenticated when it connects, so revoking a session (password change,
    // deactivation, deletion) has to close the user's live connections too -
    // otherwise they keep receiving pushes on a token that no longer works.
    // In-memory, so it only sees connections to this server instance.
    public class HubConnectionRegistry
    {
        private readonly ConcurrentDictionary<string, (int UserId, HubCallerContext Context)> _connections = new();

        public void Add(int userId, HubCallerContext context) =>
            _connections[context.ConnectionId] = (userId, context);

        public void Remove(string connectionId) =>
            _connections.TryRemove(connectionId, out _);

        // Closes every open connection for the user; the client's reconnect then
        // fails authentication because the old token's session is revoked.
        public int DisconnectUser(int userId)
        {
            var closed = 0;
            foreach (var (connectionId, entry) in _connections)
            {
                if (entry.UserId == userId && _connections.TryRemove(connectionId, out _))
                {
                    entry.Context.Abort();
                    closed++;
                }
            }
            return closed;
        }
    }
}
