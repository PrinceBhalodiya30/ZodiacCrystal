using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.DTOs
{
    // Multipart form: the first message can carry photos.
    public class CreateTicketDto
    {
        public int? OrderId { get; set; }

        [Required]
        [RegularExpression(TicketCategories.Pattern, ErrorMessage = "Please choose what you need help with.")]
        public string Category { get; set; } = null!;

        [Required]
        [StringLength(150, MinimumLength = 3)]
        public string Subject { get; set; } = null!;

        [Required]
        [StringLength(2000, MinimumLength = 5)]
        public string Message { get; set; } = null!;

        public List<IFormFile>? Files { get; set; }
    }

    // Multipart form: a reply in the thread.
    public class TicketReplyDto
    {
        [Required]
        [StringLength(2000, MinimumLength = 1)]
        public string Message { get; set; } = null!;

        // Admin only: a note the customer never sees.
        public bool IsInternal { get; set; }

        // Admin only: status to move to with this reply (default AwaitingCustomer).
        public string? Status { get; set; }

        public List<IFormFile>? Files { get; set; }
    }

    public class TicketStatusDto
    {
        [Required]
        [RegularExpression("^(Open|AwaitingCustomer|Resolved|Closed)$")]
        public string Status { get; set; } = null!;
    }

    public class TicketRatingDto
    {
        [Range(1, 5)]
        public byte Rating { get; set; }

        [StringLength(500)]
        public string? Comment { get; set; }
    }

    public class TicketMessageDto
    {
        public int TicketMessageId { get; set; }
        public bool IsFromAdmin { get; set; }
        public bool IsInternal { get; set; }
        public string SenderName { get; set; } = null!;
        public string Body { get; set; } = null!;
        public List<string> Attachments { get; set; } = new();
        public DateTime CreatedAt { get; set; }
        public bool IsEdited { get; set; }
        public bool IsDeleted { get; set; }
        // Admin view: the viewing admin may edit / delete it now.
        public bool CanModify { get; set; }
        // Admin view: when the edit window for a customer reply ends (null = no limit / not editable).
        public DateTime? EditableUntil { get; set; }
    }

    public class EditTicketMessageDto
    {
        [Required]
        [StringLength(2000, MinimumLength = 1)]
        public string Message { get; set; } = null!;
    }

    public class SupportTicketDto
    {
        public int SupportTicketId { get; set; }
        // "ZC-1042" - what the customer quotes on the phone or by email.
        public string Reference { get; set; } = null!;
        public int? OrderId { get; set; }
        public string Category { get; set; } = null!;
        public string CategoryLabel { get; set; } = null!;
        public string Subject { get; set; } = null!;
        public string Status { get; set; } = null!;
        public string StatusLabel { get; set; } = null!;
        public bool Unread { get; set; }
        // Admin list: waiting on the store for longer than SupportPolicy.ReplyWithinHours.
        public bool IsOverdue { get; set; }
        public byte? Rating { get; set; }
        public string? RatingComment { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastMessageAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public string? LastMessagePreview { get; set; }
        public string CustomerName { get; set; } = null!;
        public string CustomerEmail { get; set; } = null!;

        // Detail view only.
        public List<TicketMessageDto>? Messages { get; set; }
        public TicketOrderContextDto? Order { get; set; }
    }

    // What the support agent (and customer) needs to see about the linked order.
    public class TicketOrderContextDto
    {
        public int OrderId { get; set; }
        public DateTime OrderDate { get; set; }
        public string Status { get; set; } = null!;
        public decimal TotalAmount { get; set; }
        public string PaymentMethod { get; set; } = null!;
        public string PaymentStatus { get; set; } = null!;
        public string? TrackingNumber { get; set; }
        public string? CourierName { get; set; }
        public DateTime? DeliveredAt { get; set; }
        public string? ReturnStatus { get; set; }
        public bool CanRequestReturn { get; set; }
        public List<string> ProductNames { get; set; } = new();
    }
}
