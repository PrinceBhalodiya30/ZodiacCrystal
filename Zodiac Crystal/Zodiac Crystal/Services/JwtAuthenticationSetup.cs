using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Zodiac_Crystal.Data;

namespace Zodiac_Crystal.Services
{
    public static class JwtAuthenticationSetup
    {
        public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
        {
            var jwtSettings = configuration.GetSection("Jwt");
            var jwtKey = GetValidatedJwtKey(jwtSettings);

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = jwtSettings["Issuer"],
                    ValidAudience = jwtSettings["Audience"],
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
                };

                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = HandleMessageReceived,
                    OnTokenValidated = ValidateTokenSessionAsync
                };
            });

            return services;
        }

        private static string GetValidatedJwtKey(IConfigurationSection jwtSettings)
        {
            var jwtKey = jwtSettings["Key"];
            if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
            {
                throw new InvalidOperationException(
                    "Jwt:Key is missing or too short (min 32 chars). Set it via User Secrets or the Jwt__Key environment variable.");
            }

            return jwtKey;
        }

        // Browsers can't set an Authorization header on the WebSocket handshake
        // SignalR uses, so the token is passed as ?access_token=... instead - but
        // only for requests actually hitting the notification hub, so this never
        // weakens normal header-based auth on the REST API.
        private static Task HandleMessageReceived(MessageReceivedContext context)
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/notifications"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        }

        // A token is only good while its session version matches the user's:
        // changing the email (or undoing a change) bumps it, which signs out
        // every other device. Tokens from before this check carry no claim and
        // count as version 0, so nobody is logged out by the deploy itself.
        private static async Task ValidateTokenSessionAsync(TokenValidatedContext context)
        {
            var principal = context.Principal!;
            if (!int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            {
                context.Fail("Invalid token.");
                return;
            }

            var tokenVersion = int.TryParse(principal.FindFirstValue(TokenService.SessionVersionClaim), out var v) ? v : 0;

            var db = context.HttpContext.RequestServices.GetRequiredService<CrystalsDbContext>();
            // A deactivated or deleted account is treated as having no session
            // at all, so its tokens stop working immediately.
            var currentVersion = await db.Users
                .Where(u => u.UserId == userId && u.IsActive && !u.IsDeleted)
                .Select(u => (int?)u.SessionVersion)
                .FirstOrDefaultAsync(context.HttpContext.RequestAborted);

            if (currentVersion != tokenVersion)
            {
                context.Fail("Session has been signed out.");
            }
        }
    }
}

