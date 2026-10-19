using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class SubscribeNewsletterDto
    {
        [Required]
        [EmailAddress]
        [StringLength(256)]
        public string Email { get; set; } = null!;
    }
}
