using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace Zodiac_Crystal.Services
{
    public static class UserRoles
    {
        public const string Admin = "Admin";
        public const string User = "User";
        // Hidden account for a verified guest-checkout email. Has an unusable
        // password, can't log in, and is upgraded to User if the owner registers.
        public const string Guest = "Guest";

        // [Authorize(Roles = ...)] for endpoints a guest session may also call.
        public const string CustomerOrGuest = User + "," + Guest;
    }

    // Marks an endpoint (or controller) a guest session may call. Everything
    // else refuses guests - see GuestAccessMiddleware - so a guest token can
    // never reach profile, wishlist, admin or any endpoint added later by default.
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public sealed class AllowGuestAttribute : Attribute
    {
    }

    // Runs after authentication: a request signed in with a Guest token gets a
    // 403 unless the matched endpoint carries [AllowGuest]. This is on top of
    // the endpoint's own [Authorize], never instead of it.
    public class GuestAccessMiddleware
    {
        private readonly RequestDelegate _next;

        public GuestAccessMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var endpoint = context.GetEndpoint();

            // Public endpoints (no [Authorize], or [AllowAnonymous]) work for
            // everyone, guests included; only sign-in-only endpoints are gated.
            var requiresSignIn = endpoint != null
                && endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Count > 0
                && endpoint.Metadata.GetMetadata<IAllowAnonymous>() == null;

            if (requiresSignIn
                && context.User.Identity?.IsAuthenticated == true
                && context.User.IsInRole(UserRoles.Guest)
                && endpoint!.Metadata.GetMetadata<AllowGuestAttribute>() == null)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "Please log in or create an account to use this feature." });
                return;
            }

            await _next(context);
        }
    }

    public static class GuestAccessExtensions
    {
        public static bool IsGuest(this ClaimsPrincipal user) => user.IsInRole(UserRoles.Guest);
    }
}
