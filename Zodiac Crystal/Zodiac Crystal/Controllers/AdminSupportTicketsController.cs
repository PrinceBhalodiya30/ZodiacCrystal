using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Models;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    // Admin support inbox: list tickets, read the conversation next to the
    // order and return details, reply (or leave an internal note) and move
    // tickets through Open -> AwaitingCustomer -> Resolved -> Closed.
    [Route("api/Admin/SupportTickets")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminSupportTicketsController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly AuditLogService _auditLogService;
        private readonly IEmailService _emailService;
        private readonly NotificationService _notificationService;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<AdminSupportTicketsController> _logger;

        public AdminSupportTicketsController(
            CrystalsDbContext context,
            AuditLogService auditLogService,
            IEmailService emailService,
            NotificationService notificationService,
            IWebHostEnvironment environment,
            ILogger<AdminSupportTicketsController> logger)
        {
            _context = context;
            _auditLogService = auditLogService;
            _emailService = emailService;
            _notificationService = notificationService;
            _environment = environment;
            _logger = logger;
        }

        // GET: api/admin/supporttickets/paged?pageNumber=1&pageSize=20&status=Open&category=&search=
        // status "Active" = Open + AwaitingCustomer. Unread tickets come first.
        [HttpGet("paged")]
        public async Task<ActionResult<PagedResult<SupportTicketDto>>> GetTicketsPaged(
            int pageNumber = 1,
            int pageSize = 20,
            string? status = null,
            string? category = null,
            string? search = null)
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

            var query = _context.SupportTickets.AsNoTracking().Include(t => t.User).AsQueryable();

            if (status == "Active")
            {
                query = query.Where(t => TicketStatuses.Active.Contains(t.Status));
            }
            else if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(t => t.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(t => t.Category == category);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                // "ZC-42", "#42" or "42" match the ticket reference or the order number.
                var digits = term.TrimStart('#').Replace("ZC-", "", StringComparison.OrdinalIgnoreCase);
                if (int.TryParse(digits, out var number))
                {
                    query = query.Where(t => t.SupportTicketId == number || t.OrderId == number);
                }
                else
                {
                    query = query.Where(t =>
                        t.Subject.Contains(term) || t.User.Name.Contains(term) || t.User.Email.Contains(term));
                }
            }

            var totalCount = await query.CountAsync();

            var tickets = await query
                .OrderByDescending(t => t.AdminUnread)
                .ThenByDescending(t => t.LastMessageAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Include(t => t.Messages.OrderByDescending(m => m.CreatedAt).Take(1))
                .ToListAsync();

            return Ok(new PagedResult<SupportTicketDto>
            {
                Items = tickets.Select(t => TicketMapper.ToDto(t, forAdmin: true)).ToList(),
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            });
        }

        // GET: api/admin/supporttickets/counts   - nav badge and dashboard
        [HttpGet("counts")]
        public async Task<IActionResult> GetCounts()
        {
            var overdueBefore = DateTime.UtcNow.AddHours(-SupportPolicy.ReplyWithinHours);

            var open = await _context.SupportTickets.CountAsync(t => t.Status == TicketStatuses.Open);
            var unread = await _context.SupportTickets.CountAsync(t => t.AdminUnread && TicketStatuses.Active.Contains(t.Status));
            var overdue = await _context.SupportTickets.CountAsync(t => t.Status == TicketStatuses.Open && t.LastMessageAt < overdueBefore);

            return Ok(new { open, unread, overdue });
        }

        // GET: api/admin/supporttickets/5   (also marks it read for admins)
        [HttpGet("{id}")]
        public async Task<ActionResult<SupportTicketDto>> GetTicket(int id)
        {
            var ticket = await TicketMapper.LoadAsync(_context, id, includeInternal: true, track: true);

            if (ticket == null)
            {
                return NotFound(new { message = "Support request not found" });
            }

            if (ticket.AdminUnread)
            {
                ticket.AdminUnread = false;
                await _context.SaveChangesAsync();
                await _notificationService.BroadcastAdminChangeAsync("ticket", ticket.SupportTicketId, "read");
            }

            return Ok(await TicketMapper.ToDetailDtoAsync(_context, ticket, forAdmin: true, GetCurrentAdminId()));
        }

        // POST: api/admin/supporttickets/5/messages   (multipart: message, isInternal, status?, files[])
        // A reply moves the ticket to AwaitingCustomer unless another status is given
        // (e.g. "Resolved" for "reply and resolve"). Internal notes change nothing else.
        [HttpPost("{id}/messages")]
        [RequestSizeLimit(ReviewPhotoService.MaxFileSizeBytes * SupportPolicy.MaxPhotosPerMessage + 1024 * 1024)]
        public async Task<ActionResult<SupportTicketDto>> Reply(int id, [FromForm] TicketReplyDto dto)
        {
            var ticket = await TicketMapper.LoadAsync(_context, id, includeInternal: true, track: true);

            if (ticket == null)
            {
                return NotFound(new { message = "Support request not found" });
            }

            if (ticket.Status == TicketStatuses.Closed && !dto.IsInternal)
            {
                return BadRequest(new { message = "This ticket is closed. Reopen it before replying." });
            }

            var newStatus = dto.Status ?? TicketStatuses.AwaitingCustomer;
            if (!dto.IsInternal && newStatus != TicketStatuses.AwaitingCustomer && newStatus != TicketStatuses.Resolved)
            {
                return BadRequest(new { message = "A reply can leave the ticket awaiting the customer or resolve it." });
            }

            var (urls, error) = await TicketMapper.SaveAttachmentsAsync(dto.Files, _environment, Request);
            if (error != null)
            {
                return BadRequest(new { message = error });
            }

            var adminId = GetCurrentAdminId();
            var now = DateTime.UtcNow;
            var body = dto.Message.Trim();

            ticket.Messages.Add(new TicketMessage
            {
                SenderUserId = adminId,
                IsFromAdmin = true,
                IsInternal = dto.IsInternal,
                Body = body,
                AttachmentUrls = TicketMapper.JoinUrls(urls),
                CreatedAt = now
            });
            ticket.AdminUnread = false;

            if (!dto.IsInternal)
            {
                ticket.Status = newStatus;
                ticket.CustomerUnread = true;
                ticket.LastMessageAt = now;
                ticket.ResolvedAt = newStatus == TicketStatuses.Resolved ? now : null;
            }

            _auditLogService.Log(adminId, dto.IsInternal ? "TicketNoteAdded" : "TicketReplied", "SupportTicket",
                ticket.SupportTicketId, $"ZC-{ticket.SupportTicketId}");

            await _context.SaveChangesAsync();

            // Internal notes never reach the customer. Replies always ring the bell;
            // the email is throttled (SupportPolicy.ShouldEmailCustomer).
            if (!dto.IsInternal)
            {
                var emailed = await TicketMapper.NotifyCustomerAsync(ticket, ticket.User, body,
                    newStatus == TicketStatuses.Resolved
                        ? ("Request Resolved", $"We've replied and resolved \"{ticket.Subject}\".")
                        : ("New Reply from Support", $"We've replied to \"{ticket.Subject}\"."),
                    _emailService, _notificationService, _logger,
                    sendEmail: SupportPolicy.ShouldEmailCustomer(ticket, now));

                if (emailed)
                {
                    ticket.CustomerEmailedAt = now;
                    await _context.SaveChangesAsync();
                }
            }

            await _notificationService.BroadcastAdminChangeAsync("ticket", ticket.SupportTicketId, dto.IsInternal ? "noted" : "replied");

            // Reload so the new message has its sender name.
            var reloaded = await TicketMapper.LoadAsync(_context, id, includeInternal: true);
            return Ok(await TicketMapper.ToDetailDtoAsync(_context, reloaded!, forAdmin: true, GetCurrentAdminId()));
        }

        // PUT: api/admin/supporttickets/5/messages/12   (body: { message })
        // Edit your own internal note (any time) or reply (within SupportPolicy.EditWindowMinutes).
        // The customer is not re-emailed; the message shows as "edited".
        [HttpPut("{id}/messages/{messageId}")]
        public async Task<ActionResult<SupportTicketDto>> EditMessage(int id, int messageId, EditTicketMessageDto dto)
        {
            var (ticket, message, error) = await LoadOwnMessageAsync(id, messageId);
            if (error != null)
            {
                return error;
            }

            message!.Body = dto.Message.Trim();
            message.EditedAt = DateTime.UtcNow;

            _auditLogService.Log(GetCurrentAdminId(), message.IsInternal ? "TicketNoteEdited" : "TicketReplyEdited", "SupportTicket",
                ticket!.SupportTicketId, $"ZC-{ticket.SupportTicketId} message {message.TicketMessageId}");

            await _context.SaveChangesAsync();
            await _notificationService.BroadcastAdminChangeAsync("ticket", ticket.SupportTicketId, "edited");

            return Ok(await TicketMapper.ToDetailDtoAsync(_context, ticket, forAdmin: true, GetCurrentAdminId()));
        }

        // DELETE: api/admin/supporttickets/5/messages/12
        // Soft delete with the same rules as editing: admins still see it struck
        // through, the customer sees "This message was removed".
        [HttpDelete("{id}/messages/{messageId}")]
        public async Task<ActionResult<SupportTicketDto>> DeleteMessage(int id, int messageId)
        {
            var (ticket, message, error) = await LoadOwnMessageAsync(id, messageId);
            if (error != null)
            {
                return error;
            }

            message!.DeletedAt = DateTime.UtcNow;

            _auditLogService.Log(GetCurrentAdminId(), message.IsInternal ? "TicketNoteDeleted" : "TicketReplyDeleted", "SupportTicket",
                ticket!.SupportTicketId, $"ZC-{ticket.SupportTicketId} message {message.TicketMessageId}");

            await _context.SaveChangesAsync();
            await _notificationService.BroadcastAdminChangeAsync("ticket", ticket.SupportTicketId, "deleted");

            return Ok(await TicketMapper.ToDetailDtoAsync(_context, ticket, forAdmin: true, GetCurrentAdminId()));
        }

        private async Task<(SupportTicket? Ticket, TicketMessage? Message, ActionResult? Error)> LoadOwnMessageAsync(int id, int messageId)
        {
            var ticket = await TicketMapper.LoadAsync(_context, id, includeInternal: true, track: true);
            var message = ticket?.Messages.FirstOrDefault(m => m.TicketMessageId == messageId);

            if (ticket == null || message == null)
            {
                return (null, null, NotFound(new { message = "Message not found" }));
            }

            if (!SupportPolicy.CanModify(message, GetCurrentAdminId(), DateTime.UtcNow))
            {
                return (null, null, BadRequest(new
                {
                    message = !message.IsFromAdmin || message.SenderUserId != GetCurrentAdminId()
                        ? "You can only change your own messages."
                        : message.DeletedAt != null
                            ? "This message was already deleted."
                            : $"Replies can only be changed within {SupportPolicy.EditWindowMinutes} minutes of sending."
                }));
            }

            return (ticket, message, null);
        }

        // PUT: api/admin/supporttickets/5/status   (body: { status })
        [HttpPut("{id}/status")]
        public async Task<ActionResult<SupportTicketDto>> UpdateStatus(int id, TicketStatusDto dto)
        {
            var ticket = await TicketMapper.LoadAsync(_context, id, includeInternal: true, track: true);

            if (ticket == null)
            {
                return NotFound(new { message = "Support request not found" });
            }

            if (ticket.Status == dto.Status)
            {
                return BadRequest(new { message = $"This ticket is already {dto.Status}." });
            }

            var now = DateTime.UtcNow;
            ticket.Status = dto.Status;
            ticket.AdminUnread = false;
            ticket.ResolvedAt = dto.Status == TicketStatuses.Resolved ? now : dto.Status == TicketStatuses.Closed ? ticket.ResolvedAt ?? now : null;
            ticket.ClosedAt = dto.Status == TicketStatuses.Closed ? now : null;

            _auditLogService.Log(GetCurrentAdminId(), "TicketStatusChanged", "SupportTicket", ticket.SupportTicketId,
                $"ZC-{ticket.SupportTicketId} -> {dto.Status}");

            if (dto.Status == TicketStatuses.Resolved || dto.Status == TicketStatuses.Closed)
            {
                ticket.CustomerUnread = true;
            }

            await _context.SaveChangesAsync();

            // Resolved: bell + email, unless a reply email went out moments ago
            // (reply, then "Mark resolved" = one email). Closed: bell only.
            if (dto.Status == TicketStatuses.Resolved || dto.Status == TicketStatuses.Closed)
            {
                var emailed = await TicketMapper.NotifyCustomerAsync(ticket, ticket.User, null,
                    ($"Request {dto.Status}", $"Your request \"{ticket.Subject}\" is now {dto.Status.ToLowerInvariant()}."),
                    _emailService, _notificationService, _logger,
                    sendEmail: dto.Status == TicketStatuses.Resolved && SupportPolicy.ShouldEmailCustomer(ticket, now));

                if (emailed)
                {
                    ticket.CustomerEmailedAt = now;
                    await _context.SaveChangesAsync();
                }
            }

            await _notificationService.BroadcastAdminChangeAsync("ticket", ticket.SupportTicketId, dto.Status.ToLowerInvariant());

            return Ok(await TicketMapper.ToDetailDtoAsync(_context, ticket, forAdmin: true, GetCurrentAdminId()));
        }

        private int GetCurrentAdminId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }
    }
}
