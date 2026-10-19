using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class RequestEmailChangeDto
    {
        [Required]
        [EmailAddress]
        [StringLength(256)]
        public string NewEmail { get; set; } = null!;

        // Re-entered so a session left open (or a stolen token) can't be used to
        // move the account to someone else's email.
        [Required]
        [StringLength(100)]
        public string CurrentPassword { get; set; } = null!;
    }
}
