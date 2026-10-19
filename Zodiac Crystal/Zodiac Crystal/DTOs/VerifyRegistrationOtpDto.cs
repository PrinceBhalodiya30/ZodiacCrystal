using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class VerifyRegistrationOtpDto
    {
        [Required]
        [EmailAddress]
        [StringLength(256)]
        public string Email { get; set; } = null!;

        [Required]
        [RegularExpression("^[0-9]{6}$", ErrorMessage = "Enter the 6-digit code sent to your email.")]
        public string Otp { get; set; } = null!;
    }
}
