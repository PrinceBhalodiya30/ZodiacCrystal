namespace Zodiac_Crystal.DTOs
{
    public class AdminUserDto
    {
        public int UserId { get; set; }

        public string Name { get; set; } = null!;

        public string Email { get; set; } = null!;

        public string Role { get; set; } = null!;

        public DateTime CreatedAt { get; set; }

        public bool IsActive { get; set; }
    }
}
