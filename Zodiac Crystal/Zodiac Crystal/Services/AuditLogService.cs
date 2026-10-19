using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    // Records who did a sensitive admin action, on what, and when. Deliberately
    // scoped to admin-privileged mutations only (order status, coupons, user
    // activation, admin-initiated review deletion) - not general traffic or
    // customer-side actions, which are already implicitly auditable via their
    // own tables (an order's own history, a review's CreatedAt, etc).
    public class AuditLogService
    {
        private readonly CrystalsDbContext _context;

        public AuditLogService(CrystalsDbContext context)
        {
            _context = context;
        }

        // Does not call SaveChangesAsync - the caller's own SaveChangesAsync
        // (already part of the surrounding operation) persists this too.
        public void Log(int adminUserId, string action, string entityType, int? entityId, string? details = null)
        {
            _context.AuditLogs.Add(new AuditLog
            {
                AdminUserId = adminUserId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                Details = details
            });
        }

        public async Task<(List<AuditLog> Items, int TotalCount)> GetPagedAsync(
            int pageNumber, int pageSize, string? search = null, string? action = null, DateTime? from = null, DateTime? to = null)
        {
            var query = Search(search, action, from, to);

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(a => a.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, totalCount);
        }

        // Newest first, every match - for the CSV export.
        public Task<List<AuditLog>> GetAllAsync(string? search = null, string? action = null, DateTime? from = null, DateTime? to = null) =>
            Search(search, action, from, to).OrderByDescending(a => a.CreatedAt).ToListAsync();

        // Every action name that has been logged, for the page's filter dropdown.
        public Task<List<string>> GetActionsAsync() =>
            _context.AuditLogs.AsNoTracking().Select(a => a.Action).Distinct().OrderBy(a => a).ToListAsync();

        // from/to are UTC instants (to is exclusive): the browser turns the admin's
        // local days into exact instants, since CreatedAt is stored in UTC.
        private IQueryable<AuditLog> Search(string? search, string? action = null, DateTime? from = null, DateTime? to = null)
        {
            var query = _context.AuditLogs
                .AsNoTracking()
                .Include(a => a.AdminUser)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(a =>
                    a.AdminUser.Name.Contains(search) ||
                    a.Action.Contains(search) ||
                    a.EntityType.Contains(search) ||
                    (a.Details != null && a.Details.Contains(search)));
            }

            if (!string.IsNullOrWhiteSpace(action))
            {
                query = query.Where(a => a.Action == action);
            }

            if (from.HasValue)
            {
                var start = from.Value.ToUniversalTime();
                query = query.Where(a => a.CreatedAt >= start);
            }

            if (to.HasValue)
            {
                var end = to.Value.ToUniversalTime();
                query = query.Where(a => a.CreatedAt < end);
            }

            return query;
        }
    }
}
