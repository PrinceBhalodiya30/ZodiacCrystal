using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Zodiac_Crystal.Middleware
{
    public class GlobalExceptionHandler : IExceptionHandler
    {
        private readonly ILogger<GlobalExceptionHandler> _logger;
        private readonly IHostEnvironment _environment;

        public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IHostEnvironment environment)
        {
            _logger = logger;
            _environment = environment;
        }

        public async ValueTask<bool> TryHandleAsync(
            HttpContext httpContext,
            Exception exception,
            CancellationToken cancellationToken)
        {
            // Only deliberate business errors keep their status and message. Anything
            // else (EF/LINQ InvalidOperationException, SQL errors, ArgumentException
            // from a bug) is a server fault: a generic 500 whose message reveals nothing.
            int statusCode;
            string message;

            if (exception is BusinessException business)
            {
                statusCode = business.StatusCode;
                message = business.Message;

                _logger.LogWarning("Request rejected for {Method} {Path}: {StatusCode} {ExceptionType}",
                    httpContext.Request.Method, httpContext.Request.Path, statusCode, exception.GetType().Name);
            }
            else
            {
                statusCode = StatusCodes.Status500InternalServerError;
                message = "An unexpected error occurred.";

                // The exception object carries the details for the log; nothing
                // from the request body (passwords, codes, tokens) is logged.
                _logger.LogError(exception, "Unhandled exception for {Method} {Path}",
                    httpContext.Request.Method, httpContext.Request.Path);
            }

            // Flat { message: "..." } shape, matching the convention every controller
            // in this API already uses for its own handled error responses (BadRequest,
            // NotFound, Conflict, etc.), so the frontend can read error.error?.message
            // consistently regardless of whether the error was explicitly handled or
            // caught here by the global handler.
            var response = new Dictionary<string, object?>
            {
                ["message"] = message,
                ["status"] = statusCode,
                ["title"] = message,
                ["type"] = $"https://httpstatuses.com/{statusCode}",
                ["instance"] = httpContext.Request.Path.ToString()
            };

            // Only expose exception details in Development to avoid leaking internals in Production
            if (_environment.IsDevelopment())
            {
                response["exception"] = exception.Message;
                response["stackTrace"] = exception.StackTrace;
            }

            httpContext.Response.StatusCode = statusCode;
            httpContext.Response.ContentType = "application/json";

            await httpContext.Response.WriteAsJsonAsync(response, cancellationToken);

            return true;
        }
    }
}
