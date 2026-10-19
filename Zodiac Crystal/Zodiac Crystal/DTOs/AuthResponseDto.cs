namespace Zodiac_Crystal.DTOs
{
    public class AuthResponseDto
    {
        public string Token { get; set; } = null!;

        public int UserId { get; set; }

        public string Name { get; set; } = null!;

        public string Email { get; set; } = null!;

        public string Role { get; set; } = null!;

        public DateTime CreatedAt { get; set; }
    }
}
