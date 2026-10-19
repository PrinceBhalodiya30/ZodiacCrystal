using System.Net;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Zodiac_Crystal.Services
{
    // Rate limiting and trusted-proxy setup, kept out of Program.cs so the tests
    // exercise exactly the configuration the app runs with.
    //
    // Every request first passes the global limit, then any stricter endpoint
    // policy; both must allow it. Signed-in users are counted by user id, so
    // customers sharing an office or mobile-carrier IP don't use up each
    // other's allowance. Anonymous requests are counted by client IP.
    public static class RateLimitingSetup
    {
        public const string ForwardedHeadersSection = "ForwardedHeaders";

        public static IServiceCollection AddApiRateLimiting(this IServiceCollection services)
        {
            return services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.OnRejected = async (context, token) =>
                {
                    if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    {
                        context.HttpContext.Response.Headers.RetryAfter =
                            ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
                    }

                    await context.HttpContext.Response.WriteAsJsonAsync(
                        new { message = "Too many attempts. Please wait a few minutes and try again." }, token);
                };

                // Whole API: 300 requests per minute per user (or IP when anonymous).
                // A page load in the shop is ~10-20 calls, so real customers never
                // get near it; scrapers and runaway scripts do.
                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http =>
                    RateLimitPartition.GetSlidingWindowLimiter(UserOrIp(http), _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 300,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueLimit = 0
                    }));

                // Login, code verification, password reset: 10 tries per minute per IP.
                options.AddPolicy(RateLimitPolicies.AuthAttempts, http =>
                    RateLimitPartition.GetFixedWindowLimiter(ClientIp(http), _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 10,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    }));

                // Anything that sends an email: 5 per 15 minutes per IP.
                options.AddPolicy(RateLimitPolicies.EmailSend, http =>
                    RateLimitPartition.GetFixedWindowLimiter(ClientIp(http), _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 5,
                        Window = TimeSpan.FromMinutes(15),
                        QueueLimit = 0
                    }));

                // Placing an order (card charge, stock lock, emails): 10 per 10 minutes
                // per user. Room for a few declined cards, but stops card testing.
                options.AddPolicy(RateLimitPolicies.Checkout, http =>
                    RateLimitPartition.GetFixedWindowLimiter(UserOrIp(http), _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 10,
                        Window = TimeSpan.FromMinutes(10),
                        QueueLimit = 0
                    }));

                // Coupon checks: 20 per 15 minutes per user, so codes can't be guessed.
                options.AddPolicy(RateLimitPolicies.CouponValidate, http =>
                    RateLimitPartition.GetFixedWindowLimiter(UserOrIp(http), _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 20,
                        Window = TimeSpan.FromMinutes(15),
                        QueueLimit = 0
                    }));

                // Product search/listing (filtered, sorted, counted queries): 60 per
                // minute - one a second, well above typing-and-paging speed.
                options.AddPolicy(RateLimitPolicies.Search, http =>
                    RateLimitPartition.GetSlidingWindowLimiter(UserOrIp(http), _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 60,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueLimit = 0
                    }));

                // CPU or third-party heavy calls (invoice PDF, Braintree client
                // token): 20 per minute per user.
                options.AddPolicy(RateLimitPolicies.Expensive, http =>
                    RateLimitPartition.GetFixedWindowLimiter(UserOrIp(http), _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 20,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    }));
            });
        }

        // Proxies whose X-Forwarded-For / X-Forwarded-Proto we believe, from the
        // ForwardedHeaders section (KnownProxies: IPs, KnownNetworks: CIDRs).
        // Nothing configured = the headers are ignored and the socket address is
        // used, which is right when nothing sits in front of the app.
        public static IServiceCollection AddTrustedForwardedHeaders(this IServiceCollection services, IConfiguration configuration)
        {
            var section = configuration.GetSection(ForwardedHeadersSection);
            var proxies = section.GetSection("KnownProxies").Get<string[]>() ?? [];
            var networks = section.GetSection("KnownNetworks").Get<string[]>() ?? [];

            return services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

                // Drop the loopback defaults: only what's configured is trusted.
                options.KnownProxies.Clear();
                options.KnownIPNetworks.Clear();

                foreach (var proxy in proxies)
                {
                    options.KnownProxies.Add(IPAddress.TryParse(proxy, out var ip)
                        ? ip
                        : throw new InvalidOperationException($"{ForwardedHeadersSection}:KnownProxies has an invalid IP address: '{proxy}'."));
                }

                foreach (var network in networks)
                {
                    options.KnownIPNetworks.Add(System.Net.IPNetwork.TryParse(network, out var net)
                        ? net
                        : throw new InvalidOperationException($"{ForwardedHeadersSection}:KnownNetworks has an invalid CIDR range: '{network}'."));
                }

                // Unwind every hop that comes from a trusted proxy and stop at the
                // first one that doesn't, so a client-supplied X-Forwarded-For
                // entry is never taken as the client IP.
                options.ForwardLimit = null;
            });
        }

        // Must run first in the pipeline. Skipped entirely when no proxies are
        // configured: with empty trust lists the middleware would accept forwarded
        // headers from anyone.
        public static IApplicationBuilder UseTrustedForwardedHeaders(this IApplicationBuilder app)
        {
            var options = app.ApplicationServices.GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;

            return options.KnownProxies.Count == 0 && options.KnownIPNetworks.Count == 0
                ? app
                : app.UseForwardedHeaders();
        }

        private static string ClientIp(HttpContext http) =>
            http.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        private static string UserOrIp(HttpContext http)
        {
            var userId = http.User.Identity?.IsAuthenticated == true
                ? http.User.FindFirstValue(ClaimTypes.NameIdentifier)
                : null;

            return userId != null ? $"user:{userId}" : $"ip:{ClientIp(http)}";
        }
    }
}
