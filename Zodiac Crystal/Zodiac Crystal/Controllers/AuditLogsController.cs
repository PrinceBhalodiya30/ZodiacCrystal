using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/Admin/AuditLogs")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AuditLogsController : ControllerBase
    {
        private readonly AuditLogService _auditLogService;

        public AuditLogsController(AuditLogService auditLogService)
        {
            _auditLogService = auditLogService;
        }

        // GET: api/admin/auditlogs/paged?pageNumber=1&pageSize=20&search=&action=&from=&to=
        [HttpGet("paged")]
        public async Task<ActionResult<PagedResult<AuditLogDto>>> GetPaged(
            int pageNumber = 1,
            int pageSize = 20,
            string? search = null,
            string? action = null,
            DateTime? from = null,
            DateTime? to = null)
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

            var (items, totalCount) = await _auditLogService.GetPagedAsync(pageNumber, pageSize, search, action, from, to);

            return Ok(new PagedResult<AuditLogDto> 
            {
                Items = items.Select(a => new AuditLogDto
                { 
                    AuditLogId = a.AuditLogId,
                    AdminName = a.AdminUser.Name, 
                    Action = a.Action,
                    EntityType = a.EntityType,
                    EntityId = a.EntityId,
                    Details = a.Details,
                    CreatedAt = DateTime.SpecifyKind(a.CreatedAt, DateTimeKind.Utc) 
                }).ToList(),
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            });
        }

        // GET: api/admin/auditlogs/actions
        [HttpGet("actions")]
        public async Task<ActionResult<List<string>>> GetActions()
        {
            return Ok(await _auditLogService.GetActionsAsync());
        }

        // GET: api/admin/auditlogs/export?search=&action=&from=&to=
        // Times are UTC, as stored.
        [HttpGet("export")]
        public async Task<IActionResult> Export([FromServices] CsvExportService csv, string? search = null, string? action = null, DateTime? from = null, DateTime? to = null)
        {
            var logs = await _auditLogService.GetAllAsync(search, action, from, to);

            var file = csv.BuildCsv(
                new[] { "Time (UTC)", "Admin", "Action", "EntityType", "EntityId", "Details" },
                logs.Select(a => new object?[] { a.CreatedAt, a.AdminUser.Name, a.Action, a.EntityType, a.EntityId, a.Details ?? "" }));

            return File(file, "text/csv", "audit-logs-export.csv");
        }
    }
}
