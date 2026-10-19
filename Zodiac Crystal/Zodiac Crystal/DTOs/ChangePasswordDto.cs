using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class ChangePasswordDto
    {
        [Required]
        [StringLength(100)]
        public string CurrentPassword { get; set; } = null!;

        [Required]
        [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be between 8 and 100 characters long.")]
        public string NewPassword { get; set; } = null!;
    }
}
