using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    // Name only. Changing the email goes through api/users/me/email, which
    // needs the current password and a code sent to the new address.
    public class UpdateProfileDto
    {
        [Required]
        [StringLength(100)]
        public string Name { get; set; } = null!;
    }
}
