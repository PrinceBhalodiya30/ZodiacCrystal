using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class ResetPasswordDto
    {
        [Required]
        [EmailAddress]
        [StringLength(256)]
        public string Email { get; set; } = null!;

        [Required]
        [RegularExpression("^[0-9]{6}$", ErrorMessage = "Enter the 6-digit code sent to your email.")]
        public string Code { get; set; } = null!;

        [Required]
        [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be between 8 and 100 characters long.")]
        public string NewPassword { get; set; } = null!;
    }
}
