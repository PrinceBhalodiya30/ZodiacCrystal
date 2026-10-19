using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class CreateReturnRequestDto
    {
        [Required]
        public int OrderId { get; set; }

        [Required]
        [RegularExpression("^(Damaged|WrongItem|NotAsDescribed|ChangedMind|Other)$", ErrorMessage = "Please choose a return reason.")]
        public string Reason { get; set; } = null!;

        [StringLength(1000)]
        public string? Details { get; set; }
    }

    // Admin approve / reject / refund.
    public class ReturnActionDto
    {
        [StringLength(500)]
        public string? AdminNote { get; set; }

        // Refund only: put the returned items back into stock.
        public bool Restock { get; set; }
    }

    public class ReturnRequestDto
    {
        public int ReturnRequestId { get; set; }
        public int OrderId { get; set; }
        public string Reason { get; set; } = null!;
        public string ReasonLabel { get; set; } = null!;
        public string? Details { get; set; }
        public string Status { get; set; } = null!;
        public string? AdminNote { get; set; }
        public bool Restocked { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }

        // Order context (handy for the admin list).
        public decimal OrderTotal { get; set; }
        public string PaymentMethod { get; set; } = null!;
        public string PaymentStatus { get; set; } = null!;
        public string CustomerName { get; set; } = null!;
        public string CustomerEmail { get; set; } = null!;
    }
}
