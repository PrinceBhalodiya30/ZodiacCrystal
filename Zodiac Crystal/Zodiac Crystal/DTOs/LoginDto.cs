using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class LoginDto
    {
        [Required]
        [EmailAddress]
        [StringLength(256)]
        public string Email { get; set; } = null!;

        [Required]
        [StringLength(100)]
        public string Password { get; set; } = null!;
    }
}
