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
    // Customer side of the Help Center: open a support ticket (optionally about
    // one of their orders), read and reply to the conversation, mark it resolved
    // and rate it. Replies from the store happen in AdminSupportTicketsController.
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "User")]
    public class SupportTicketsController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly IEmailService _emailService;
        private readonly NotificationService _notificationService;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<SupportTicketsController> _logger;

        public SupportTicketsController(
            CrystalsDbContext context,
            IEmailService emailService,
            NotificationService notificationService,
            IWebHostEnvironment environment,
            ILogger<SupportTicketsController> logger)
        {
            _context = context;
            _emailService = emailService;
            _notificationService = notificationService;
            _environment = environment;
            _logger = logger;
        }

        // GET: api/supporttickets
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupportTicketDto>>> GetMyTickets()
        {
            var userId = GetCurrentUserId();

            var tickets = await _context.SupportTickets
                .AsNoTracking()
                .Include(t => t.User)
                .Include(t => t.Messages.Where(m => !m.IsInternal))
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.LastMessageAt)
                .ToListAsync();

            return Ok(tickets.Select(t => TicketMapper.ToDto(t, forAdmin: false)));
        }

        // GET: api/supporttickets/5   (also marks the store's latest reply as read)
        [HttpGet("{id}")]
        public async Task<ActionResult<SupportTicketDto>> GetTicket(int id)
        {
            var userId = GetCurrentUserId();
            var ticket = await TicketMapper.LoadAsync(_context, id, includeInternal: false);

            if (ticket == null || ticket.UserId != userId)
            {
                return NotFound(new { message = "Support request not found" });
            }

            if (ticket.CustomerUnread)
            {
                ticket.CustomerUnread = false;
                await _context.SaveChangesAsync();
            }

            return Ok(await TicketMapper.ToDetailDtoAsync(_context, ticket, forAdmin: false));
        }

        // POST: api/supporttickets   (multipart: orderId?, category, subject, message, files[])
        [HttpPost]
        [RequestSizeLimit(ReviewPhotoService.MaxFileSizeBytes * SupportPolicy.MaxPhotosPerMessage + 1024 * 1024)]
        public async Task<ActionResult<SupportTicketDto>> CreateTicket([FromForm] CreateTicketDto dto)
        {
            var userId = GetCurrentUserId();

            if (dto.OrderId != null)
            {
                var ownsOrder = await _context.Orders.AnyAsync(o => o.OrderId == dto.OrderId && o.UserId == userId);
                if (!ownsOrder)
                {
                    return NotFound(new { message = "Order not found" });
                }
            }

            var activeCount = await _context.SupportTickets
                .CountAsync(t => t.UserId == userId && TicketStatuses.Active.Contains(t.Status));
            if (activeCount >= SupportPolicy.MaxActiveTicketsPerUser)
            {
                return BadRequest(new { message = "You already have several open requests. Please reply to one of those and we'll help you there." });
            }

            var (urls, error) = await TicketMapper.SaveAttachmentsAsync(dto.Files, _environment, Request);
            if (error != null)
            {
                return BadRequest(new { message = error });
            }

            var user = await _context.Users.FirstAsync(u => u.UserId == userId);
            var now = DateTime.UtcNow;

            var ticket = new SupportTicket
            {
                UserId = userId,
                OrderId = dto.OrderId,
                Category = dto.Category,
                Subject = dto.Subject.Trim(),
                Status = TicketStatuses.Open,
                AdminUnread = true,
                CreatedAt = now,
                LastMessageAt = now,
                User = user
            };
            ticket.Messages.Add(new TicketMessage
            {
                SenderUserId = userId,
                Body = dto.Message.Trim(),
                AttachmentUrls = TicketMapper.JoinUrls(urls),
                CreatedAt = now
            });

            _context.SupportTickets.Add(ticket);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Support ticket {TicketId} opened by user {UserId}", ticket.SupportTicketId, userId);

            await TicketMapper.NotifyCustomerAsync(ticket, user, null, null, _emailService, _notificationService, _logger);
            await TicketMapper.NotifyAdminsAsync(_context, ticket, user, dto.Message.Trim(), isNewTicket: true, _emailService, _notificationService, _logger);
            await _notificationService.BroadcastAdminChangeAsync("ticket", ticket.SupportTicketId, "opened");

            return Ok(await TicketMapper.ToDetailDtoAsync(_context, ticket, forAdmin: false));
        }

        // POST: api/supporttickets/5/messages   (multipart: message, files[])
        // Replying to a resolved ticket reopens it.
        [HttpPost("{id}/messages")]
        [RequestSizeLimit(ReviewPhotoService.MaxFileSizeBytes * SupportPolicy.MaxPhotosPerMessage + 1024 * 1024)]
        public async Task<ActionResult<SupportTicketDto>> Reply(int id, [FromForm] TicketReplyDto dto)
        {
            var userId = GetCurrentUserId();
            var ticket = await TicketMapper.LoadAsync(_context, id, includeInternal: false, track: true);

            if (ticket == null || ticket.UserId != userId)
            {
                return NotFound(new { message = "Support request not found" });
            }

            if (ticket.Status == TicketStatuses.Closed)
            {
                return BadRequest(new { message = "This request is closed. Please open a new one from the Help Center." });
            }

            var (urls, error) = await TicketMapper.SaveAttachmentsAsync(dto.Files, _environment, Request);
            if (error != null)
            {
                return BadRequest(new { message = error });
            }

            var now = DateTime.UtcNow;
            var reopened = ticket.Status == TicketStatuses.Resolved;

            ticket.Messages.Add(new TicketMessage
            {
                SenderUserId = userId,
                Body = dto.Message.Trim(),
                AttachmentUrls = TicketMapper.JoinUrls(urls),
                CreatedAt = now
            });
            ticket.Status = TicketStatuses.Open;
            ticket.ResolvedAt = null;
            ticket.AdminUnread = true;
            ticket.CustomerUnread = false;
            ticket.LastMessageAt = now;

            await _context.SaveChangesAsync();

            await TicketMapper.NotifyAdminsAsync(_context, ticket, ticket.User, dto.Message.Trim(), isNewTicket: false, _emailService, _notificationService, _logger);
            await _notificationService.BroadcastAdminChangeAsync("ticket", ticket.SupportTicketId, reopened ? "reopened" : "replied");

            return Ok(await TicketMapper.ToDetailDtoAsync(_context, ticket, forAdmin: false));
        }

        // PUT: api/supporttickets/5/resolve   - "My problem is solved"
        [HttpPut("{id}/resolve")]
        public async Task<ActionResult<SupportTicketDto>> Resolve(int id)
        {
            var userId = GetCurrentUserId();
            var ticket = await TicketMapper.LoadAsync(_context, id, includeInternal: false, track: true);

            if (ticket == null || ticket.UserId != userId)
            {
                return NotFound(new { message = "Support request not found" });
            }

            if (!TicketStatuses.Active.Contains(ticket.Status))
            {
                return BadRequest(new { message = $"This request is already {ticket.Status.ToLowerInvariant()}." });
            }

            ticket.Status = TicketStatuses.Resolved;
            ticket.ResolvedAt = DateTime.UtcNow;
            ticket.AdminUnread = false;
            await _context.SaveChangesAsync();

            await _notificationService.BroadcastAdminChangeAsync("ticket", ticket.SupportTicketId, "resolved");

            return Ok(await TicketMapper.ToDetailDtoAsync(_context, ticket, forAdmin: false));
        }

        // PUT: api/supporttickets/5/rate   (body: { rating: 1-5, comment? })
        [HttpPut("{id}/rate")]
        public async Task<ActionResult<SupportTicketDto>> Rate(int id, TicketRatingDto dto)
        {
            var userId = GetCurrentUserId();
            var ticket = await TicketMapper.LoadAsync(_context, id, includeInternal: false, track: true);

            if (ticket == null || ticket.UserId != userId)
            {
                return NotFound(new { message = "Support request not found" });
            }

            if (TicketStatuses.Active.Contains(ticket.Status))
            {
                return BadRequest(new { message = "You can rate our help once your request is resolved." });
            }

            ticket.Rating = dto.Rating;
            ticket.RatingComment = string.IsNullOrWhiteSpace(dto.Comment) ? null : dto.Comment.Trim();
            await _context.SaveChangesAsync();

            await _notificationService.BroadcastAdminChangeAsync("ticket", ticket.SupportTicketId, "rated");

            return Ok(await TicketMapper.ToDetailDtoAsync(_context, ticket, forAdmin: false));
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }
    }

    // Shared by the customer and admin support controllers.
    internal static class TicketMapper
    {
        public static Task<SupportTicket?> LoadAsync(CrystalsDbContext context, int id, bool includeInternal, bool track = false)
        {
            var query = context.SupportTickets
                .Include(t => t.User)
                .Include(t => t.Messages.Where(m => includeInternal || !m.IsInternal))
                    .ThenInclude(m => m.Sender)
                .AsQueryable();

            if (!track)
            {
                query = query.AsNoTracking();
            }

            return query.AsSplitQuery().FirstOrDefaultAsync(t => t.SupportTicketId == id);
        }

        public static SupportTicketDto ToDto(SupportTicket t, bool forAdmin)
        {
            var lastMessage = t.Messages
                .Where(m => forAdmin || !m.IsInternal)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefault();

            return new SupportTicketDto
            {
                SupportTicketId = t.SupportTicketId,
                Reference = $"ZC-{t.SupportTicketId}",
                OrderId = t.OrderId,
                Category = t.Category,
                CategoryLabel = TicketCategories.Label(t.Category),
                Subject = t.Subject,
                Status = t.Status,
                StatusLabel = forAdmin && t.Status == TicketStatuses.AwaitingCustomer ? "Awaiting customer" : TicketStatuses.Label(t.Status),
                Unread = forAdmin ? t.AdminUnread : t.CustomerUnread,
                IsOverdue = forAdmin && t.Status == TicketStatuses.Open
                    && t.LastMessageAt < DateTime.UtcNow.AddHours(-SupportPolicy.ReplyWithinHours),
                Rating = t.Rating,
                RatingComment = t.RatingComment,
                CreatedAt = Utc(t.CreatedAt),
                LastMessageAt = Utc(t.LastMessageAt),
                ResolvedAt = t.ResolvedAt == null ? null : Utc(t.ResolvedAt.Value),
                LastMessagePreview = lastMessage == null
                    ? null
                    : lastMessage.DeletedAt != null ? "Message removed"
                    : lastMessage.Body.Length > 120 ? lastMessage.Body[..120] + "..." : lastMessage.Body,
                CustomerName = t.User.Name,
                CustomerEmail = t.User.Email
            };
        }

        // Ticket + messages + linked order (status, tracking, return state).
        // viewerAdminId: the admin looking at it (admin view), for edit/delete permissions.
        public static async Task<SupportTicketDto> ToDetailDtoAsync(CrystalsDbContext context, SupportTicket t, bool forAdmin, int? viewerAdminId = null)
        {
            var dto = ToDto(t, forAdmin);
            var now = DateTime.UtcNow;

            dto.Messages = t.Messages
                .Where(m => forAdmin || !m.IsInternal)
                .OrderBy(m => m.CreatedAt)
                .Select(m =>
                {
                    // Customers never see the text or photos of a removed message.
                    var hidden = m.DeletedAt != null && !forAdmin;
                    var canModify = forAdmin && viewerAdminId != null && SupportPolicy.CanModify(m, viewerAdminId.Value, now);
                    return new TicketMessageDto
                    {
                        TicketMessageId = m.TicketMessageId,
                        IsFromAdmin = m.IsFromAdmin,
                        IsInternal = m.IsInternal,
                        // Customers see "Crystal Studio Support", not the admin's own name.
                        SenderName = m.IsFromAdmin && !forAdmin ? "Crystal Studio Support" : m.Sender?.Name ?? (m.IsFromAdmin ? "Support" : t.User.Name),
                        Body = hidden ? "This message was removed." : m.Body,
                        Attachments = hidden ? new List<string>() : SplitUrls(m.AttachmentUrls),
                        CreatedAt = Utc(m.CreatedAt),
                        IsEdited = m.EditedAt != null,
                        IsDeleted = m.DeletedAt != null,
                        CanModify = canModify,
                        EditableUntil = canModify && !m.IsInternal ? Utc(m.CreatedAt.AddMinutes(SupportPolicy.EditWindowMinutes)) : null
                    };
                })
                .ToList();

            if (t.OrderId != null)
            {
                var order = await context.Orders
                    .AsNoTracking()
                    .Include(o => o.OrderItems).ThenInclude(oi => oi.Product)
                    .FirstOrDefaultAsync(o => o.OrderId == t.OrderId);

                if (order != null)
                {
                    var returnRequest = await context.ReturnRequests
                        .AsNoTracking()
                        .FirstOrDefaultAsync(r => r.OrderId == order.OrderId);
                    var windowEndsAt = ReturnPolicy.WindowEndsAt(order);

                    dto.Order = new TicketOrderContextDto
                    {
                        OrderId = order.OrderId,
                        OrderDate = order.OrderDate,
                        Status = order.Status,
                        TotalAmount = order.TotalAmount,
                        PaymentMethod = order.PaymentMethod,
                        PaymentStatus = order.PaymentStatus,
                        TrackingNumber = order.TrackingNumber,
                        CourierName = order.CourierName,
                        DeliveredAt = order.DeliveredAt,
                        ReturnStatus = returnRequest?.Status,
                        // Same rule as OrdersController.MapToOrderDto.
                        CanRequestReturn = returnRequest == null && windowEndsAt != null && DateTime.Now <= windowEndsAt.Value,
                        ProductNames = order.OrderItems.Select(i => i.Product?.Name ?? $"Product #{i.ProductId}").ToList()
                    };
                }
            }

            return dto;
        }

        // Validates every photo before saving any (same rules as review photos),
        // then stores re-encoded JPEGs under wwwroot/uploads/support.
        public static async Task<(List<string> Urls, string? Error)> SaveAttachmentsAsync(
            List<IFormFile>? files, IWebHostEnvironment environment, HttpRequest request)
        {
            var urls = new List<string>();
            if (files == null || files.Count == 0)
            {
                return (urls, null);
            }

            if (files.Count > SupportPolicy.MaxPhotosPerMessage)
            {
                return (urls, $"You can attach up to {SupportPolicy.MaxPhotosPerMessage} photos.");
            }

            var contents = new List<MemoryStream>();
            try
            {
                foreach (var file in files)
                {
                    if (file.Length == 0 || file.Length > ReviewPhotoService.MaxFileSizeBytes)
                    {
                        return (urls, "Each photo must be 5 MB or smaller.");
                    }

                    var content = new MemoryStream();
                    contents.Add(content);
                    await file.CopyToAsync(content);
                    content.Position = 0;

                    var invalid = ImageUploadValidator.Validate(content, Path.GetExtension(file.FileName).ToLowerInvariant());
                    if (invalid != null)
                    {
                        return (urls, invalid);
                    }
                    content.Position = 0;
                }

                var folder = SupportPolicy.Folder(environment.ContentRootPath);
                var savedFiles = new List<string>();

                foreach (var content in contents)
                {
                    var fileName = ReviewPhotoService.Save(content, folder);
                    if (fileName == null)
                    {
                        foreach (var saved in savedFiles)
                        {
                            File.Delete(Path.Combine(folder, saved));
                        }
                        return (new List<string>(), "One of the photos could not be read. Please try another.");
                    }

                    savedFiles.Add(fileName);
                    urls.Add($"{request.Scheme}://{request.Host}{SupportPolicy.UrlFolder}{fileName}");
                }

                return (urls, null);
            }
            finally
            {
                foreach (var content in contents)
                {
                    content.Dispose();
                }
            }
        }

        public static string? JoinUrls(List<string> urls) => urls.Count == 0 ? null : string.Join('|', urls);

        public static List<string> SplitUrls(string? urls) =>
            string.IsNullOrEmpty(urls) ? new List<string>() : urls.Split('|', StringSplitOptions.RemoveEmptyEntries).ToList();

        // Bell + (unless sendEmail is false) email to the customer. Best effort:
        // never throws, because the ticket change it describes is already
        // committed. Returns whether the email was sent.
        public static async Task<bool> NotifyCustomerAsync(
            SupportTicket ticket, User customer, string? message, (string Title, string Text)? bell,
            IEmailService emailService, NotificationService notificationService, ILogger logger,
            bool sendEmail = true)
        {
            if (bell != null)
            {
                try
                {
                    await notificationService.NotifyTicketUpdatedAsync(ticket, bell.Value.Title, bell.Value.Text);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Ticket {TicketId} notification failed", ticket.SupportTicketId);
                }
            }

            if (!sendEmail)
            {
                return false;
            }

            try
            {
                await emailService.SendTicketUpdateAsync(ticket, customer, message);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Ticket {TicketId} email failed", ticket.SupportTicketId);
                return false;
            }
        }

        // Bell + email to every active admin. Best effort, like NotifyCustomerAsync.
        public static async Task NotifyAdminsAsync(
            CrystalsDbContext context, SupportTicket ticket, User customer, string message, bool isNewTicket,
            IEmailService emailService, NotificationService notificationService, ILogger logger)
        {
            try
            {
                var admins = await context.Users
                    .AsNoTracking()
                    .Where(u => u.Role == "Admin" && u.IsActive && !u.IsDeleted)
                    .Select(u => new { u.UserId, u.Name, u.Email })
                    .ToListAsync();

                foreach (var admin in admins)
                {
                    try
                    {
                        await notificationService.NotifyAdminTicketAsync(
                            admin.UserId, ticket,
                            isNewTicket ? "New Support Request" : "Customer Replied",
                            $"{customer.Name}: {ticket.Subject}");
                        await emailService.SendTicketAdminAlertAsync(admin.Email, admin.Name, ticket, customer, message, isNewTicket);
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "Ticket {TicketId} alert failed for admin {AdminUserId}", ticket.SupportTicketId, admin.UserId);
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Ticket {TicketId} admin alerts failed", ticket.SupportTicketId);
            }
        }

        private static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }
}
