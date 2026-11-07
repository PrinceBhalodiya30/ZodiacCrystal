using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.Hubs;
using Zodiac_Crystal.Services;
using Zodiac_Crystal.Middleware;

QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        // Validation failures return { message, errors } so the frontend's
        // error.error.message shows the real reason instead of a generic toast.
        options.InvalidModelStateResponseFactory = CreateInvalidModelStateResponse;
    });

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// HTTP request logging - method, path, status code, duration, and basic
// request/response properties & headers only. Bodies are deliberately excluded
// so we never risk logging sensitive data (e.g. passwords in login/register requests).
builder.Services.AddHttpLogging(options =>
{
    options.LoggingFields = HttpLoggingFields.RequestPropertiesAndHeaders
        | HttpLoggingFields.ResponsePropertiesAndHeaders
        | HttpLoggingFields.Duration;
});

builder.Services.AddDbContext<CrystalsDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("CrystalsDb"),
        sqlServerOptions => sqlServerOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
    ));

builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<Zodiac_Crystal.Services.CouponValidationService>();
builder.Services.AddScoped<Zodiac_Crystal.Services.ReportOperationsService>();
builder.Services.AddScoped<Zodiac_Crystal.Services.AuditLogService>();
builder.Services.AddScoped<Zodiac_Crystal.Services.NotificationService>();
builder.Services.AddScoped<Zodiac_Crystal.Services.StoreSettingsService>();

// Brevo SMTP email. Host/Port/From come from appsettings.json; the SMTP
// Username/Password (key) are supplied via User Secrets, never committed.
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));
builder.Services.AddScoped<OrderAccessService>();
builder.Services.AddScoped<IEmailService, EmailService>();

// Pending (unverified) registrations + their one-time codes live in memory.
builder.Services.AddMemoryCache();
builder.Services.AddScoped<RegistrationOtpService>();
builder.Services.AddScoped<GuestCheckoutOtpService>();
builder.Services.AddScoped<EmailChangeOtpService>();
builder.Services.AddScoped<PasswordResetService>();
builder.Services.AddScoped<LoginAttemptService>();
builder.Services.AddScoped<LowStockAlertService>();

// PIN/state check on every shipping address (India Post lookup).
builder.Services.AddHttpClient<AddressCheckService>(client =>
{
    var baseUrl = builder.Configuration["IndiaPost:BaseUrl"];
    if (!string.IsNullOrEmpty(baseUrl))
    {
        client.BaseAddress = new Uri(baseUrl);
    }
    client.Timeout = TimeSpan.FromSeconds(5);
});

// Hourly job that emails customers about carts left idle for a day.
builder.Services.AddHostedService<CartReminderService>();
builder.Services.AddSingleton<ProductAlertTrigger>();
builder.Services.AddHostedService<ProductAlertService>();
builder.Services.AddHostedService<TicketAutoCloseService>();

// Braintree card payments. Environment comes from appsettings.json; the
// MerchantId / PublicKey / PrivateKey are supplied via User Secrets.
builder.Services.Configure<BraintreeSettings>(builder.Configuration.GetSection("Braintree"));
builder.Services.AddScoped<BraintreePaymentService>();

builder.Services.AddSignalR();
builder.Services.AddSingleton<HubConnectionRegistry>();

// JWT Authentication
builder.Services.AddJwtAuthentication(builder.Configuration);

builder.Services.AddAuthorization();

// Global per-user/IP API limit plus stricter per-endpoint policies (login,
// email, checkout, coupons, search, PDFs) - see RateLimitingSetup.
builder.Services.AddApiRateLimiting();

// Real client IP from X-Forwarded-For, but only from the proxies listed in
// the ForwardedHeaders config section; ignored entirely when none are listed.
builder.Services.AddTrustedForwardedHeaders(builder.Configuration);

// CORS - allow the Angular dev server to call this API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularDev", policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()); // SignalR's WebSocket/negotiate requests need credentials allowed
});

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.ParameterLocation.Header,
        Description = "Enter your JWT token (without the \"Bearer \" prefix)"
    });

    options.AddSecurityRequirement(document => new Microsoft.OpenApi.OpenApiSecurityRequirement
    {
        [new Microsoft.OpenApi.OpenApiSecuritySchemeReference("Bearer", document)] = new List<string>()
    });
});

var app = builder.Build();

// First, so logging, HTTPS redirection and rate limiting all see the real client.
app.UseTrustedForwardedHeaders();

app.UseExceptionHandler();

app.UseHttpLogging();

// Swagger UI
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAngularDev");

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Serves uploaded product images from wwwroot/uploads (e.g. /uploads/products/xyz.jpg).
// nosniff stops a browser from treating an uploaded file as anything other
// than the image type it's served as.
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx => ctx.Context.Response.Headers["X-Content-Type-Options"] = "nosniff"
});

// After authentication so signed-in users are limited by user id; before
// authorization so requests that end up refused still count. After CORS so a
// 429 still carries CORS headers and the frontend can read it.
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
// Guest-checkout sessions may only reach endpoints marked [AllowGuest].
app.UseMiddleware<GuestAccessMiddleware>();

app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");

await app.RunAsync();

static Microsoft.AspNetCore.Mvc.IActionResult CreateInvalidModelStateResponse(Microsoft.AspNetCore.Mvc.ActionContext context)
{
    var errors = context.ModelState
        .Where(e => e.Value?.Errors.Count > 0)
        .ToDictionary(
            e => e.Key,
            e => e.Value!.Errors
                .Select(x => string.IsNullOrEmpty(x.ErrorMessage) ? $"The value for {e.Key} is invalid." : x.ErrorMessage)
                .ToArray());

    var message = errors.Values.SelectMany(v => v).FirstOrDefault() ?? "The request is invalid.";

    return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(new { message, errors });
}