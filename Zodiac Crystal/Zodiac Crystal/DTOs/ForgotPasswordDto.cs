using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class ForgotPasswordDto
    {
        [Required]
        [EmailAddress]
        [StringLength(256)]
        public string Email { get; set; } = null!;
    }
}
