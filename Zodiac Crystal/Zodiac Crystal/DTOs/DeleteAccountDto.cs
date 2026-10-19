using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class DeleteAccountDto
    {
        // Re-entered to confirm it's really the account owner deleting the account.
        [Required]
        [StringLength(100)]
        public string Password { get; set; } = null!;
    }
}
