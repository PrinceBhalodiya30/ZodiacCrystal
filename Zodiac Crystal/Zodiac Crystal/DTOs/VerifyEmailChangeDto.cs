using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class VerifyEmailChangeDto
    {
        [Required]
        [RegularExpression("^[0-9]{6}$", ErrorMessage = "Enter the 6-digit code sent to your new email.")]
        public string Otp { get; set; } = null!;
    }
}
