namespace Zodiac_Crystal.Services
{
    // Bound from the "EmailSettings" configuration section. Host/Port/FromEmail/
    // FromName live in appsettings.json; Username and Password (the Brevo SMTP
    // login and SMTP key) must come from User Secrets / environment variables
    // only - never commit them to appsettings.json.
    public class EmailSettings
    {
        public string Host { get; set; } = null!;

        public int Port { get; set; }

        public string FromEmail { get; set; } = null!;

        public string FromName { get; set; } = null!;

        public string? Username { get; set; }

        public string? Password { get; set; }

        // Storefront address used for links in emails (e.g. the welcome email's buttons).
        public string SiteUrl { get; set; } = "http://localhost:4200";
    }
}
