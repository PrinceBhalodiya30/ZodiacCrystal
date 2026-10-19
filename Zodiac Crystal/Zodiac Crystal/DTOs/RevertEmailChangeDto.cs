using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class RevertEmailChangeDto
    {
        // The one-time token from the "this wasn't me" link in the email-changed notice.
        [Required]
        [StringLength(100)]
        public string Token { get; set; } = null!;
    }
}
