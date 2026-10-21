using System.Globalization;
using System.Net;
using System.Text;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    // Sends transactional emails through Brevo's SMTP relay using MailKit with
    // STARTTLS. Credentials come from configuration (User Secrets in development)
    // and are never logged.
    public class EmailService : IEmailService
    {
        private static readonly CultureInfo IndianCulture = new("en-IN");

        private readonly EmailSettings _settings;
        private readonly ILogger<EmailService> _logger;
        private readonly OrderAccessService _orderAccess;

        public EmailService(IOptions<EmailSettings> settings, ILogger<EmailService> logger, OrderAccessService orderAccess)
        {
            _settings = settings.Value;
            _logger = logger;
            _orderAccess = orderAccess;
        }

        // Guests have no My Orders page, so their order emails carry a secure
        // link to the order instead. Empty for registered customers.
        private async Task<string> GuestOrderLinkHtmlAsync(Order order)
        {
            if (order.User.Role != UserRoles.Guest)
            {
                return "";
            }

            var url = await _orderAccess.CreateLinkAsync(order.OrderId);
            return $@"
              <p style=""text-align:center;margin:24px 0;"">
                <a href=""{Encode(url)}"" style=""display:inline-block;padding:12px 24px;background:#2f4a3a;color:#ffffff;border-radius:4px;text-decoration:none;font-weight:bold;"">View Your Order</a>
              </p>
              <p style=""font-size:12px;color:#6f695f;"">This private link lets you track, cancel or get help with this order for {(int)OrderAccessService.LinkLifetime.TotalDays} days. Please don't share it.</p>";
        }

        public async Task SendEmailAsync(string toEmail, string toName, string subject, string htmlBody)
        {
            if (string.IsNullOrWhiteSpace(_settings.Username) || string.IsNullOrWhiteSpace(_settings.Password))
            {
                _logger.LogWarning("==========================================================================");
                _logger.LogWarning("[DEV MODE - EMAIL NOT SENT: Brevo SMTP credentials not configured]");
                _logger.LogWarning("To: {ToEmail} ({ToName}) | Subject: {Subject}", toEmail, toName, subject);
                _logger.LogWarning("Email Body:\n{HtmlBody}", htmlBody);
                _logger.LogWarning("==========================================================================");
                return;
            }

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = subject;
            message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

            try
            {
                using var client = new SmtpClient { Timeout = 15000 };

                await client.ConnectAsync(_settings.Host, _settings.Port, SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(_settings.Username, _settings.Password);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                _logger.LogInformation("Email \"{Subject}\" sent successfully via Brevo SMTP", subject);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email via Brevo SMTP to {ToEmail}", toEmail);
                _logger.LogWarning("==========================================================================");
                _logger.LogWarning("[DEV MODE - EMAIL FALLBACK]");
                _logger.LogWarning("To: {ToEmail} ({ToName}) | Subject: {Subject}", toEmail, toName, subject);
                _logger.LogWarning("Email Body:\n{HtmlBody}", htmlBody);
                _logger.LogWarning("==========================================================================");
            }
        }

        public async Task SendOrderConfirmationAsync(Order order)
        {
            var customerName = order.User.Name;

            var rows = new StringBuilder();
            foreach (var item in order.OrderItems)
            {
                rows.Append($@"
                <tr>
                  <td style=""padding:8px;border-bottom:1px solid #eee;"">{Encode(item.Product?.Name ?? $"Product #{item.ProductId}")}</td>
                  <td style=""padding:8px;border-bottom:1px solid #eee;text-align:center;"">{item.Quantity}</td>
                  <td style=""padding:8px;border-bottom:1px solid #eee;text-align:right;"">{Money(item.Subtotal)}</td>
                </tr>");
            }

            var content = $@"
              <p>Hi {Encode(customerName)},</p>
              <p>Thank you for your order! We've received it and will let you know when its status changes.</p>
              {SummaryTable(order)}
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;margin-top:16px;font-size:14px;"">
                <tr style=""background:#f3efe7;"">
                  <th style=""padding:8px;text-align:left;"">Item</th>
                  <th style=""padding:8px;text-align:center;"">Qty</th>
                  <th style=""padding:8px;text-align:right;"">Subtotal</th>
                </tr>
                {rows}
              </table>
              {PriceBreakdown(order)}
              {await GuestOrderLinkHtmlAsync(order)}";

            await SendEmailAsync(
                order.User.Email,
                customerName,
                OrderItemsLabel.Describe(order) is { } label
                    ? $"Order Confirmed: {label} (Order #{order.OrderId})"
                    : $"Order Confirmation - Order #{order.OrderId}",
                Layout("Order Confirmed", content));
        }

        public async Task SendOrderStatusUpdateAsync(Order order, string previousStatus)
        {
            var customerName = order.User.Name;
            var label = OrderItemsLabel.Describe(order);
            var orderText = label != null
                ? $"<strong>{Encode(label)}</strong> (order #{order.OrderId})"
                : $"<strong>#{order.OrderId}</strong>";

            var content = $@"
              <p>Hi {Encode(customerName)},</p>
              <p>The status of your order {orderText} has changed from
                 <strong>{Encode(previousStatus)}</strong> to <strong>{Encode(order.Status)}</strong>.</p>
              {(order.Status == "Shipped" && order.TrackingNumber != null
                  ? $@"<p>Courier: <strong>{Encode(order.CourierName ?? "")}</strong><br>
                 Tracking number: <strong>{Encode(order.TrackingNumber)}</strong><br>
                 {(DeliveryEstimate.Window(order) is var (from, to) ? $"Estimated delivery: <strong>{from:ddd, dd MMM} – {to:ddd, dd MMM yyyy}</strong><br>" : "")}
                 You can follow your package from {(order.User.Role == UserRoles.Guest ? "the link below" : "<em>My Orders</em> on our website")}.</p>"
                  : "")}
              {SummaryTable(order)}
              {await GuestOrderLinkHtmlAsync(order)}";

            await SendEmailAsync(
                order.User.Email,
                customerName,
                label != null
                    ? $"{label} {OrderItemsLabel.Verb(label)} now {order.Status} (Order #{order.OrderId})"
                    : $"Order #{order.OrderId} is now {order.Status}",
                Layout("Order Status Update", content));
        }

        public async Task SendRegistrationOtpAsync(string toEmail, string toName, string otp, TimeSpan validFor)
        {
            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>Use the code below to verify your email and finish creating your Crystal Studio account.</p>
              <p style=""margin:24px 0;text-align:center;"">
                <span style=""display:inline-block;padding:12px 24px;background:#f3efe7;border-radius:4px;font-size:28px;font-weight:bold;letter-spacing:8px;color:#2f4a3a;"">{Encode(otp)}</span>
              </p>
              <p>This code expires in {(int)validFor.TotalMinutes} minutes. If you didn't try to register, you can ignore this email.</p>";

            await SendEmailAsync(
                toEmail,
                toName,
                "Your Crystal Studio verification code",
                Layout("Verify Your Email", content));
        }

        public async Task SendOrderLookupAsync(string toEmail, string toName, int orderId, string? viewUrl)
        {
            var siteUrl = _settings.SiteUrl.TrimEnd('/');
            var (href, button, note) = viewUrl != null
                ? (viewUrl, "View Your Order",
                    $"This private link works for {(int)OrderAccessService.LinkLifetime.TotalDays} days. Please don't share it.")
                : ($"{siteUrl}/login?returnUrl=/orders/{orderId}", "Log In to View",
                    "This order belongs to your Crystal Studio account, so log in to see it.");

            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>Here's the link you asked for to view order <strong>#{orderId}</strong>.</p>
              <p style=""text-align:center;margin:24px 0;"">
                <a href=""{Encode(href)}"" style=""display:inline-block;padding:12px 24px;background:#2f4a3a;color:#ffffff;border-radius:4px;text-decoration:none;font-weight:bold;"">{button}</a>
              </p>
              <p style=""font-size:12px;color:#6f695f;"">{Encode(note)} If you didn't ask for this, you can ignore this email.</p>";

            await SendEmailAsync(toEmail, toName, $"View your order #{orderId}", Layout("Your Order", content));
        }

        public async Task SendGuestCheckoutCodeAsync(string toEmail, string otp, TimeSpan validFor)
        {
            var content = $@"
              <p>Hi,</p>
              <p>Use the code below to verify your email and continue checking out as a guest.</p>
              <p style=""margin:24px 0;text-align:center;"">
                <span style=""display:inline-block;padding:12px 24px;background:#f3efe7;border-radius:4px;font-size:28px;font-weight:bold;letter-spacing:8px;color:#2f4a3a;"">{Encode(otp)}</span>
              </p>
              <p>This code expires in {(int)validFor.TotalMinutes} minutes. If you didn't start a checkout, you can ignore this email.</p>";

            await SendEmailAsync(toEmail, toEmail, "Your Crystal Studio checkout code", Layout("Verify Your Email", content));
        }

        public async Task SendRegistrationAttemptOnExistingAccountAsync(string toEmail, string toName)
        {
            var siteUrl = _settings.SiteUrl.TrimEnd('/');
            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>Someone just tried to create a new Crystal Studio account with this email address, but you already have one.</p>
              <p>If that was you, simply <a href=""{Encode(siteUrl)}/login"">log in</a>. Forgotten your password? Use ""Forgot password?"" on the login page.</p>
              <p>If it wasn't you, no action is needed - your account hasn't changed.</p>";

            await SendEmailAsync(toEmail, toName, "You already have a Crystal Studio account", Layout("Account Already Exists", content));
        }

        public async Task SendPasswordResetCodeAsync(string toEmail, string toName, string code, TimeSpan validFor)
        {
            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>We received a request to reset the password for your Crystal Studio account. Enter this code to choose a new password:</p>
              <p style=""margin:24px 0;text-align:center;"">
                <span style=""display:inline-block;padding:12px 24px;background:#f3efe7;border-radius:4px;font-size:28px;font-weight:bold;letter-spacing:8px;color:#2f4a3a;"">{Encode(code)}</span>
              </p>
              <p>This code expires in {(int)validFor.TotalMinutes} minutes. If you didn't ask to reset your password, you can ignore this email - your password stays the same.</p>";

            await SendEmailAsync(toEmail, toName, "Reset your Crystal Studio password", Layout("Password Reset", content));
        }

        public async Task SendPasswordChangedAsync(string toEmail, string toName, bool viaReset)
        {
            var how = viaReset ? "reset using a code sent to this email" : "changed from your profile";
            var when = DateTime.UtcNow.AddHours(5.5).ToString("dd MMM yyyy, hh:mm tt", IndianCulture);

            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>The password for your Crystal Studio account was <strong>{how}</strong> on {when} (IST).</p>
              <p>If this was you, no action is needed.</p>
              <p style=""padding:12px;background:#fdecec;border-radius:4px;color:#8a1c1c;"">
                <strong>Wasn't you?</strong> Reset your password right away using ""Forgot password?"" on the login page, and contact us at support@crystalstudio.com.
              </p>";

            await SendEmailAsync(toEmail, toName, "Your Crystal Studio password was changed", Layout("Password Changed", content));
        }

        public async Task SendEmailChangeCodeAsync(string toEmail, string toName, string code, TimeSpan validFor)
        {
            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>Use the code below to confirm this as the new email address for your Crystal Studio account.</p>
              <p style=""margin:24px 0;text-align:center;"">
                <span style=""display:inline-block;padding:12px 24px;background:#f3efe7;border-radius:4px;font-size:28px;font-weight:bold;letter-spacing:8px;color:#2f4a3a;"">{Encode(code)}</span>
              </p>
              <p>This code expires in {(int)validFor.TotalMinutes} minutes. If you didn't ask to change your email, you can ignore this message - nothing will change.</p>";

            await SendEmailAsync(toEmail, toName, "Confirm your new Crystal Studio email", Layout("Confirm Your New Email", content));
        }

        public async Task SendEmailChangedAsync(string oldEmail, string toName, string newEmail, string revertToken)
        {
            var when = DateTime.UtcNow.AddHours(5.5).ToString("dd MMM yyyy, hh:mm tt", IndianCulture);
            var revertUrl = $"{_settings.SiteUrl.TrimEnd('/')}/account/revert-email?token={Uri.EscapeDataString(revertToken)}";
            var revertDays = (int)EmailChangeOtpService.RevertLifetime.TotalDays;

            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>The email address for your Crystal Studio account was changed from this address to <strong>{Encode(newEmail)}</strong> on {when} (IST).</p>
              <p>From now on, sign in and receive order updates using the new address.</p>
              <p style=""padding:12px;background:#fdecec;border-radius:4px;color:#8a1c1c;"">
                <strong>Wasn't you?</strong> Use the button below within {revertDays} days to put this address back on your account.
                This signs everyone out, and you'll then set a new password.
              </p>
              <p style=""margin:24px 0;text-align:center;"">
                <a href=""{revertUrl}"" style=""display:inline-block;padding:12px 24px;background:#8a1c1c;color:#ffffff;border-radius:4px;text-decoration:none;font-weight:bold;"">This wasn't me - undo the change</a>
              </p>
              <p>Need help? Contact us at support@crystalstudio.com.</p>";

            await SendEmailAsync(oldEmail, toName, "Your Crystal Studio email was changed", Layout("Email Changed", content));
        }

        public async Task SendAccountDeletedAsync(string toEmail, string toName)
        {
            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>Your Crystal Studio account has been deleted as you requested. Your saved addresses, wishlist and notifications have been removed, and you can no longer log in.</p>
              <p>Records of past orders are kept for accounting purposes only.</p>
              <p>If you didn't request this, please contact us at support@crystalstudio.com.</p>
              <p>Thank you for shopping with us.</p>";

            await SendEmailAsync(toEmail, toName, "Your Crystal Studio account has been deleted", Layout("Account Deleted", content));
        }

        public async Task SendWelcomeAsync(string toEmail, string toName)
        {
            var siteUrl = _settings.SiteUrl.TrimEnd('/');

            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>Welcome to Crystal Studio! Your account is ready, and we're so glad you're here.</p>
              <p>We hand-pick crystals for every star sign, so you can find stones that match your energy, or a thoughtful gift for someone else's.</p>
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;font-size:14px;margin:8px 0 16px;"">
                <tr><td style=""padding:6px 0;""><strong>Find your crystal</strong> - browse by your zodiac sign</td></tr>
                <tr><td style=""padding:6px 0;""><strong>Save favourites</strong> - add crystals to your wishlist</td></tr>
                <tr><td style=""padding:6px 0;""><strong>Track orders</strong> - get live updates from checkout to delivery</td></tr>
              </table>
              <p style=""margin:24px 0;text-align:center;"">
                <a href=""{siteUrl}/zodiac"" style=""display:inline-block;padding:12px 24px;background:#2f4a3a;color:#ffffff;border-radius:4px;text-decoration:none;font-weight:bold;"">Find My Zodiac Crystal</a>
                &nbsp;
                <a href=""{siteUrl}/products"" style=""display:inline-block;padding:12px 24px;background:#f3efe7;color:#2f4a3a;border-radius:4px;text-decoration:none;font-weight:bold;"">Shop All Crystals</a>
              </p>
              <p>Questions? Reach us any time at support@crystalstudio.com.</p>
              <p>With love,<br/>The Crystal Studio team</p>";

            await SendEmailAsync(toEmail, toName, "Welcome to Crystal Studio", Layout($"Welcome, {Encode(toName)}!", content));
        }

        public async Task SendCartReminderAsync(string toEmail, string toName, IReadOnlyList<(string Name, decimal Price, int Quantity)> items)
        {
            var siteUrl = _settings.SiteUrl.TrimEnd('/');
            var india = System.Globalization.CultureInfo.GetCultureInfo("en-IN");

            var rows = new StringBuilder();
            foreach (var (name, price, quantity) in items)
            {
                rows.Append($@"
                <tr>
                  <td style=""padding:8px;border-bottom:1px solid #eee;"">{Encode(name)}</td>
                  <td style=""padding:8px;border-bottom:1px solid #eee;text-align:center;"">{quantity}</td>
                  <td style=""padding:8px;border-bottom:1px solid #eee;text-align:right;"">₹{(price * quantity).ToString("N0", india)}</td>
                </tr>");
            }

            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>You left some crystals in your cart. They're still waiting for you:</p>
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;font-size:14px;"">
                <tr style=""background:#f3efe7;"">
                  <th style=""padding:8px;text-align:left;"">Product</th>
                  <th style=""padding:8px;text-align:center;"">Qty</th>
                  <th style=""padding:8px;text-align:right;"">Price</th>
                </tr>
                {rows}
              </table>
              <p style=""margin:24px 0;text-align:center;"">
                <a href=""{siteUrl}/cart"" style=""display:inline-block;padding:12px 24px;background:#2f4a3a;color:#ffffff;border-radius:4px;text-decoration:none;font-weight:bold;"">Complete My Order</a>
              </p>
              <p style=""color:#6f695f;font-size:13px;"">Stock is limited, so items aren't held for you. Prices are confirmed at checkout.</p>
              <p>With love,<br/>The Crystal Studio team</p>";

            await SendEmailAsync(toEmail, toName, "You left something in your cart", Layout("Still thinking it over?", content));
        }

        public async Task SendBackInStockAsync(string toEmail, string toName, IReadOnlyList<(int ProductId, string Name, decimal Price)> products)
        {
            var siteUrl = _settings.SiteUrl.TrimEnd('/');

            var rows = new StringBuilder();
            foreach (var (productId, name, price) in products)
            {
                rows.Append($@"
                <tr>
                  <td style=""padding:8px;border-bottom:1px solid #eee;""><a href=""{siteUrl}/products/{productId}"" style=""color:#2f4a3a;font-weight:bold;"">{Encode(name)}</a></td>
                  <td style=""padding:8px;border-bottom:1px solid #eee;text-align:right;"">{Money(price)}</td>
                </tr>");
            }

            var first = products[0];
            var subject = products.Count == 1 ? $"{first.Name} is back in stock" : "Crystals you wanted are back in stock";
            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>Good news: {(products.Count == 1 ? "a crystal you asked about is" : "crystals you asked about are")} back in stock.</p>
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;font-size:14px;"">
                {rows}
              </table>
              <p style=""margin:24px 0;text-align:center;"">
                <a href=""{siteUrl}/products/{first.ProductId}"" style=""display:inline-block;padding:12px 24px;background:#2f4a3a;color:#ffffff;border-radius:4px;text-decoration:none;font-weight:bold;"">Shop Now</a>
              </p>
              <p style=""color:#6f695f;font-size:13px;"">Stock is limited and items aren't held, so they may sell out again. This was a one-time alert you asked for.</p>
              <p>With love,<br/>The Crystal Studio team</p>";

            await SendEmailAsync(toEmail, toName, subject, Layout("Back in stock", content));
        }

        public async Task SendPriceDropAsync(string toEmail, string toName, IReadOnlyList<(int ProductId, string Name, decimal OldPrice, decimal NewPrice)> products)
        {
            var siteUrl = _settings.SiteUrl.TrimEnd('/');

            var rows = new StringBuilder();
            foreach (var (productId, name, oldPrice, newPrice) in products)
            {
                rows.Append($@"
                <tr>
                  <td style=""padding:8px;border-bottom:1px solid #eee;""><a href=""{siteUrl}/products/{productId}"" style=""color:#2f4a3a;font-weight:bold;"">{Encode(name)}</a></td>
                  <td style=""padding:8px;border-bottom:1px solid #eee;text-align:right;color:#6f695f;text-decoration:line-through;"">{Money(oldPrice)}</td>
                  <td style=""padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#2f4a3a;"">{Money(newPrice)}</td>
                </tr>");
            }

            var subject = products.Count == 1 ? $"Price drop: {products[0].Name}" : "Prices dropped on your wishlist";
            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>{(products.Count == 1 ? "A crystal" : "Some crystals")} on your wishlist just got cheaper:</p>
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;font-size:14px;"">
                <tr style=""background:#f3efe7;"">
                  <th style=""padding:8px;text-align:left;"">Product</th>
                  <th style=""padding:8px;text-align:right;"">Was</th>
                  <th style=""padding:8px;text-align:right;"">Now</th>
                </tr>
                {rows}
              </table>
              <p style=""margin:24px 0;text-align:center;"">
                <a href=""{siteUrl}/wishlist"" style=""display:inline-block;padding:12px 24px;background:#2f4a3a;color:#ffffff;border-radius:4px;text-decoration:none;font-weight:bold;"">View My Wishlist</a>
              </p>
              <p style=""color:#6f695f;font-size:13px;"">Prices can change and are confirmed at checkout. To stop these emails for an item, remove it from your wishlist.</p>
              <p>With love,<br/>The Crystal Studio team</p>";

            await SendEmailAsync(toEmail, toName, subject, Layout("Price drop on your wishlist", content));
        }

        public async Task SendLowStockAlertAsync(string toEmail, string toName, IReadOnlyList<(string Name, string Sku, int Stock)> products)
        {
            var rows = new StringBuilder();
            foreach (var (name, sku, stock) in products)
            {
                var stockText = stock <= 0
                    ? @"<strong style=""color:#c62828;"">Out of stock</strong>"
                    : $@"<strong style=""color:#b25e00;"">{stock} left</strong>";

                rows.Append($@"
                <tr>
                  <td style=""padding:8px;border-bottom:1px solid #eee;"">{Encode(name)}</td>
                  <td style=""padding:8px;border-bottom:1px solid #eee;color:#6f695f;"">{Encode(sku)}</td>
                  <td style=""padding:8px;border-bottom:1px solid #eee;text-align:right;"">{stockText}</td>
                </tr>");
            }

            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p>These products just dropped to {StockRules.LowStockThreshold} or fewer units after a recent order:</p>
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;font-size:14px;"">
                <tr style=""background:#f3efe7;"">
                  <th style=""padding:8px;text-align:left;"">Product</th>
                  <th style=""padding:8px;text-align:left;"">SKU</th>
                  <th style=""padding:8px;text-align:right;"">Stock</th>
                </tr>
                {rows}
              </table>
              <p style=""margin-top:16px;"">Restock them from the admin panel under <strong>Stock</strong>.</p>";

            var subject = products.Count == 1
                ? $"Low stock: {products[0].Name}"
                : $"Low stock: {products.Count} products need restocking";

            await SendEmailAsync(toEmail, toName, subject, Layout("Low Stock Alert", content));
        }

        public async Task SendReturnUpdateAsync(ReturnRequest returnRequest, Order order)
        {
            var (headline, body) = returnRequest.Status switch
            {
                ReturnStatuses.Requested => ("Return Request Received",
                    "We've received your return request and will review it shortly. You'll get an email when it's approved or if we need anything else."),
                ReturnStatuses.Approved => ("Return Approved",
                    "Your return has been approved. Please send the items back to us with your order number included. Your refund will be issued once we receive them."),
                ReturnStatuses.Rejected => ("Return Not Approved",
                    "Unfortunately we couldn't approve your return request."),
                ReturnStatuses.Refunded => ("Refund Issued",
                    order.PaymentMethod == PaymentMethods.Card
                        ? $"We've refunded {Money(order.TotalAmount)} to your card. Depending on your bank it can take 5-7 business days to appear."
                        : $"Your refund of {Money(order.TotalAmount)} has been processed. Our team will contact you to arrange the payout."),
                _ => ("Return Update", $"Your return request is now {returnRequest.Status}.")
            };

            var noteHtml = string.IsNullOrWhiteSpace(returnRequest.AdminNote)
                ? ""
                : $@"<p style=""padding:12px;background:#f3efe7;border-radius:4px;""><strong>Note from our team:</strong> {Encode(returnRequest.AdminNote)}</p>";

            var content = $@"
              <p>Hi {Encode(order.User.Name)},</p>
              <p>{Encode(body)}</p>
              {noteHtml}
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;font-size:14px;"">
                <tr><td style=""padding:6px 0;color:#6f695f;"">Order Number</td><td style=""padding:6px 0;text-align:right;""><strong>#{order.OrderId}</strong></td></tr>
                <tr><td style=""padding:6px 0;color:#6f695f;"">Return Reason</td><td style=""padding:6px 0;text-align:right;"">{Encode(ReturnReasons.Label(returnRequest.Reason))}</td></tr>
                <tr><td style=""padding:6px 0;color:#6f695f;"">Return Status</td><td style=""padding:6px 0;text-align:right;"">{Encode(returnRequest.Status)}</td></tr>
                <tr><td style=""padding:6px 0;color:#6f695f;"">Order Total</td><td style=""padding:6px 0;text-align:right;"">{Money(order.TotalAmount)}</td></tr>
              </table>";

            await SendEmailAsync(
                order.User.Email,
                order.User.Name,
                OrderItemsLabel.Describe(order) is { } label
                    ? $"{headline}: {label} (Order #{order.OrderId})"
                    : $"Order #{order.OrderId}: {headline}",
                Layout(headline, content));
        }

        public async Task SendTicketUpdateAsync(SupportTicket ticket, User customer, string? message)
        {
            var siteUrl = _settings.SiteUrl.TrimEnd('/');
            var reference = $"ZC-{ticket.SupportTicketId}";

            var (headline, body) = message == null && ticket.Status == TicketStatuses.Open
                ? ("We've Got Your Request",
                    $"Thanks for contacting us. Our team usually replies within {SupportPolicy.ReplyWithinHours} hours, and we'll email you as soon as we do.")
                : ticket.Status == TicketStatuses.Resolved
                    ? ("Your Request Is Resolved",
                        $"We've marked your request as resolved. If anything still isn't right, just reply on the website within {SupportPolicy.AutoCloseAfterDays} days and we'll pick it up again.")
                    : ticket.Status == TicketStatuses.Closed
                        ? ("Your Request Is Closed", "This request is now closed. If you need anything else, you can open a new request from our Help Center.")
                        : ("We've Replied to Your Request", "Our support team has replied to your request.");

            var messageHtml = string.IsNullOrWhiteSpace(message)
                ? ""
                : $@"<p style=""padding:12px;background:#f3efe7;border-radius:4px;white-space:pre-line;"">{Encode(message)}</p>";

            var content = $@"
              <p>Hi {Encode(customer.Name)},</p>
              <p>{Encode(body)}</p>
              {messageHtml}
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;font-size:14px;"">
                <tr><td style=""padding:6px 0;color:#6f695f;"">Reference</td><td style=""padding:6px 0;text-align:right;""><strong>{reference}</strong></td></tr>
                <tr><td style=""padding:6px 0;color:#6f695f;"">Subject</td><td style=""padding:6px 0;text-align:right;"">{Encode(ticket.Subject)}</td></tr>
                {(ticket.OrderId != null ? $@"<tr><td style=""padding:6px 0;color:#6f695f;"">Order Number</td><td style=""padding:6px 0;text-align:right;"">#{ticket.OrderId}</td></tr>" : "")}
              </table>
              <p style=""text-align:center;margin-top:24px;"">
                <a href=""{siteUrl}/support/{ticket.SupportTicketId}"" style=""display:inline-block;padding:12px 24px;background:#2f4a3a;color:#ffffff;border-radius:4px;text-decoration:none;font-weight:bold;"">View Conversation</a>
              </p>";

            await SendEmailAsync(customer.Email, customer.Name, $"[{reference}] {headline}", Layout(headline, content));
        }

        public async Task SendTicketAdminAlertAsync(string toEmail, string toName, SupportTicket ticket, User customer, string message, bool isNewTicket)
        {
            var siteUrl = _settings.SiteUrl.TrimEnd('/');
            var reference = $"ZC-{ticket.SupportTicketId}";
            var headline = isNewTicket ? "New Support Request" : "Customer Replied";

            var content = $@"
              <p>Hi {Encode(toName)},</p>
              <p><strong>{Encode(customer.Name)}</strong> ({Encode(customer.Email)}) {(isNewTicket ? "opened a new support request" : "replied to their support request")}.</p>
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;font-size:14px;"">
                <tr><td style=""padding:6px 0;color:#6f695f;"">Reference</td><td style=""padding:6px 0;text-align:right;""><strong>{reference}</strong></td></tr>
                <tr><td style=""padding:6px 0;color:#6f695f;"">Topic</td><td style=""padding:6px 0;text-align:right;"">{Encode(TicketCategories.Label(ticket.Category))}</td></tr>
                <tr><td style=""padding:6px 0;color:#6f695f;"">Subject</td><td style=""padding:6px 0;text-align:right;"">{Encode(ticket.Subject)}</td></tr>
                {(ticket.OrderId != null ? $@"<tr><td style=""padding:6px 0;color:#6f695f;"">Order Number</td><td style=""padding:6px 0;text-align:right;"">#{ticket.OrderId}</td></tr>" : "")}
              </table>
              <p style=""padding:12px;background:#f3efe7;border-radius:4px;white-space:pre-line;"">{Encode(message)}</p>
              <p style=""text-align:center;margin-top:24px;"">
                <a href=""{siteUrl}/admin/support?ticket={ticket.SupportTicketId}"" style=""display:inline-block;padding:12px 24px;background:#2f4a3a;color:#ffffff;border-radius:4px;text-decoration:none;font-weight:bold;"">Open in Admin</a>
              </p>";

            await SendEmailAsync(toEmail, toName, $"[{reference}] {headline}: {ticket.Subject}", Layout(headline, content));
        }

        // Same lines the checkout page shows, so the email's total adds up:
        // Subtotal - Discount + Shipping = Total.
        private static string PriceBreakdown(Order order)
        {
            var itemsSubtotal = order.OrderItems.Sum(i => i.Subtotal);
            const string label = "padding:6px 8px;color:#6f695f;";
            const string value = "padding:6px 8px;text-align:right;";

            var discountRow = order.DiscountAmount > 0
                ? $@"<tr><td style=""{label}"">Discount{(string.IsNullOrEmpty(order.CouponCode) ? "" : $" ({Encode(order.CouponCode)})")}</td><td style=""{value}color:#2f6b3a;"">-{Money(order.DiscountAmount)}</td></tr>"
                : "";

            return $@"
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;margin-top:8px;font-size:14px;"">
                <tr><td style=""{label}"">Subtotal</td><td style=""{value}"">{Money(itemsSubtotal)}</td></tr>
                {discountRow}
                <tr><td style=""{label}"">Shipping</td><td style=""{value}"">{(order.ShippingFee > 0 ? Money(order.ShippingFee) : "Free")}</td></tr>
                <tr><td style=""padding:8px;border-top:1px solid #e3dccd;""><strong>Total</strong></td><td style=""padding:8px;border-top:1px solid #e3dccd;text-align:right;""><strong>{Money(order.TotalAmount)}</strong></td></tr>
              </table>";
        }

        private static string SummaryTable(Order order) => $@"
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;font-size:14px;"">
                <tr><td style=""padding:6px 0;color:#6f695f;"">Order Number</td><td style=""padding:6px 0;text-align:right;""><strong>#{order.OrderId}</strong></td></tr>
                <tr><td style=""padding:6px 0;color:#6f695f;"">Customer</td><td style=""padding:6px 0;text-align:right;"">{Encode(order.User.Name)}</td></tr>
                <tr><td style=""padding:6px 0;color:#6f695f;"">Status</td><td style=""padding:6px 0;text-align:right;"">{Encode(order.Status)}</td></tr>
                <tr><td style=""padding:6px 0;color:#6f695f;"">Payment</td><td style=""padding:6px 0;text-align:right;"">{Encode(PaymentLabels.Describe(order))}</td></tr>
                <tr><td style=""padding:6px 0;color:#6f695f;"">Total</td><td style=""padding:6px 0;text-align:right;""><strong>{Money(order.TotalAmount)}</strong></td></tr>
              </table>";
        private static string Layout(string heading, string content) => $@"<!DOCTYPE html>
<html>
  <body style=""margin:0;padding:0;background:#f7f4ee;font-family:Arial,Helvetica,sans-serif;color:#1d1b18;"">
    <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#f7f4ee;padding:24px 0;"">
      <tr>
        <td align=""center"">
          <table width=""600"" cellpadding=""0"" cellspacing=""0"" style=""max-width:600px;width:100%;background:#ffffff;border:1px solid #e3dccd;border-radius:4px;overflow:hidden;"">
            <tr>
              <td style=""background:#2f4a3a;color:#ffffff;padding:20px 24px;font-size:22px;font-weight:bold;font-family:Georgia,'Times New Roman',serif;"">Crystal Studio</td>
            </tr>
            <tr>
              <td style=""padding:24px;"">
                <h2 style=""margin:0 0 16px;font-size:20px;color:#1d1b18;font-family:Georgia,'Times New Roman',serif;font-weight:bold;"">{heading}</h2>
                {content}
              </td>
            </tr>
            <tr>
              <td style=""padding:16px 24px;background:#f3efe7;color:#6f695f;font-size:12px;border-top:1px solid #e3dccd;text-align:center;"">
                This is an automated message from Crystal Studio. Please do not reply to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>";

        private static string Encode(string value) => WebUtility.HtmlEncode(value);

        private static string Money(decimal amount) => amount.ToString("C", IndianCulture);
    }
}
