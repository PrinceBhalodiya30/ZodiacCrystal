using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class SubscribeNewsletterDto
    {
        [Required]
        [EmailAddress]
        [StringLength(256)]
        public string Email { get; set; } = null!;

        // Optional honeypot field (hidden in UI) to reject automated spam bots
        [StringLength(100)]
        public string? Website { get; set; }
    }
}
