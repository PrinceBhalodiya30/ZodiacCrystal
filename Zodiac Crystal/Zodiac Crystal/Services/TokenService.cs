using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    public class TokenService
    {
        // Checked against Users.SessionVersion on every request (see Program.cs).
        public const string SessionVersionClaim = "sv";

        private readonly IConfiguration _configuration;

        public TokenService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        // lifetime: overrides Jwt:ExpiryMinutes (short guest-checkout sessions).
        public string GenerateToken(User user, TimeSpan? lifetime = null)
        {
            var jwtSettings = _configuration.GetSection("Jwt");
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Key"]!));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim(SessionVersionClaim, user.SessionVersion.ToString())
            };

            var expiryMinutes = int.Parse(jwtSettings["ExpiryMinutes"]!);

            var token = new JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                claims: claims,
                expires: DateTime.UtcNow.Add(lifetime ?? TimeSpan.FromMinutes(expiryMinutes)),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
