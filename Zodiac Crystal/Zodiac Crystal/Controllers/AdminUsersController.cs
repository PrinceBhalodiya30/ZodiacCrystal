using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Hubs;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/Admin/Users")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminUsersController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly AuditLogService _auditLogService;
        private readonly HubConnectionRegistry _hubConnections;
        private readonly ILogger<AdminUsersController> _logger;

        public AdminUsersController(
            CrystalsDbContext context,
            AuditLogService auditLogService,
            HubConnectionRegistry hubConnections,
            ILogger<AdminUsersController> logger)
        {
            _context = context;
            _auditLogService = auditLogService;
            _hubConnections = hubConnections;
            _logger = logger;
        }

        // GET: api/admin/users
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AdminUserDto>>> GetAllUsers()
        {
            // Note: PasswordHash is intentionally never selected into the DTO.
            var users = await _context.Users
                .Where(u => !u.IsDeleted)
                .OrderByDescending(u => u.CreatedAt)
                .Select(u => new AdminUserDto 
                {
                    UserId = u.UserId,
                    Name = u.Name,
                    Email = u.Email,
                    Role = u.Role,
                    CreatedAt = u.CreatedAt,
                    IsActive = u.IsActive
                })
                .ToListAsync();

            return Ok(users);
        }

        // GET: api/admin/users/paged?pageNumber=1&pageSize=20&search=
        [HttpGet("paged")]
        public async Task<ActionResult<PagedResult<AdminUserDto>>> GetUsersPaged(
            int pageNumber = 1,
            int pageSize = 20,
            string? search = null,
            string? role = null,
            string? status = null)
        {
            if (pageNumber < 1)
            {
                pageNumber = 1;
            }

            if (pageSize < 1)
            {
                pageSize = 20;
            }
            else if (pageSize > 100)
            {
                pageSize = 100;
            }

            var query = ApplyFilters(_context.Users.Where(u => !u.IsDeleted), search, role, status);

            var totalCount = await query.CountAsync();

            var users = await query
                .OrderByDescending(u => u.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new AdminUserDto
                {
                    UserId = u.UserId,
                    Name = u.Name,
                    Email = u.Email,
                    Role = u.Role,
                    CreatedAt = u.CreatedAt,
                    IsActive = u.IsActive
                })
                .ToListAsync();

            return Ok(new PagedResult<AdminUserDto>
            {
                Items = users,
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            });
        }

        // PUT: api/admin/users/1/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, UpdateUserStatusDto dto)
        {
            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            if (id == currentUserId && !dto.IsActive) 
            {
                return BadRequest(new { message = "You cannot deactivate your own account" });  
            }

            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            user.IsActive = dto.IsActive;

            // Deactivating ends every session now rather than when the token expires.
            if (!dto.IsActive)
            {
                user.SessionVersion++;
            }

            _auditLogService.Log(
                currentUserId,
                dto.IsActive ? "UserActivated" : "UserDeactivated",
                "User",
                user.UserId,
                $"{user.Name} ({user.Email})");

            await _context.SaveChangesAsync();

            if (!dto.IsActive)
            {
                _hubConnections.DisconnectUser(user.UserId);
            }

            return NoContent();
        }

        // DELETE: api/admin/users/1
        // Soft-delete only. Sets IsDeleted=true, DeletedAt=now, IsActive=false.
        // Never removes the row or touches related orders/reviews/wishlist/addresses.
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            if (id == currentUserId)
            {
                return BadRequest(new { message = "You cannot delete your own account" });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == id && !u.IsDeleted);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            try
            {
                await using var transaction = await _context.Database.BeginTransactionAsync();

                if (string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    var activeAdminCount = await _context.Users
                        .CountAsync(u => u.Role == "Admin" && u.IsActive && !u.IsDeleted);

                    if (activeAdminCount <= 1)
                    {
                        return BadRequest(new { message = "Cannot delete the last active admin account" });
                    }
                }

                user.IsDeleted = true;
                user.DeletedAt = DateTime.UtcNow;
                user.IsActive = false;
                user.SessionVersion++;

                _auditLogService.Log(
                    currentUserId,
                    "UserDeleted",
                    "User",
                    user.UserId,
                    $"{user.Name} ({user.Email})");

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _hubConnections.DisconnectUser(user.UserId);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete user {UserId}", id);
                return StatusCode(500, new { message = "Unable to delete user. Please try again." });
            }
        }

        // GET: api/admin/users/export?search=
        // Same search as the Users page; deleted accounts are left out there too.
        [HttpGet("export")]
        public async Task<IActionResult> ExportUsers([FromServices] CsvExportService csv, string? search = null, string? role = null, string? status = null)
        {
            var query = ApplyFilters(_context.Users.AsNoTracking().Where(u => !u.IsDeleted), search, role, status);

            var users = await query
                .OrderByDescending(u => u.CreatedAt)
                .Select(u => new { u.UserId, u.Name, u.Email, u.Role, u.IsActive, u.CreatedAt })
                .ToListAsync();

            var file = csv.BuildCsv(
                new[] { "UserId", "Name", "Email", "Role", "Active", "JoinedAt" },
                users.Select(u => new object?[] { u.UserId, u.Name, u.Email, u.Role, u.IsActive, u.CreatedAt }));

            return File(file, "text/csv", "users-export.csv");
        }

        // Shared by the Users list and its export, so both always match.
        // role: "Admin" | "User"; status: "active" | "inactive".
        private static IQueryable<Models.User> ApplyFilters(IQueryable<Models.User> query, string? search, string? role, string? status)
        {
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(u => u.Name.Contains(search) || u.Email.Contains(search));
            }

            if (!string.IsNullOrWhiteSpace(role))
            {
                query = query.Where(u => u.Role == role);
            }

            return status?.ToLowerInvariant() switch
            {
                "active" => query.Where(u => u.IsActive),
                "inactive" => query.Where(u => !u.IsActive),
                _ => query
            };
        }
    }
}
