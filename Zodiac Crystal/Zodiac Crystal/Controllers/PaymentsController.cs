using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = UserRoles.CustomerOrGuest)]
    public class PaymentsController : ControllerBase
    {
        private readonly BraintreePaymentService _paymentService;
        private readonly ILogger<PaymentsController> _logger;

        public PaymentsController(BraintreePaymentService paymentService, ILogger<PaymentsController> logger)
        {
            _paymentService = paymentService;
            _logger = logger;
        }

        // GET: api/payments/client-token
        // Short-lived token the Braintree Drop-in UI needs to collect card
        // details. It grants no ability to charge - only the server can do that.
        [EnableRateLimiting(RateLimitPolicies.Expensive)]
        [HttpGet("client-token")]
        [AllowGuest]
        public async Task<IActionResult> GetClientToken()
        {
            if (!_paymentService.IsConfigured)
            {
                return StatusCode(503, new { message = "Card payments are not available right now. Please choose Cash on Delivery." });
            }

            try
            {
                var clientToken = await _paymentService.GenerateClientTokenAsync();
                return Ok(new { clientToken, sandbox = _paymentService.IsSandbox });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate Braintree client token");
                return StatusCode(503, new { message = "Card payments are not available right now. Please choose Cash on Delivery." });
            }
        }
    }
}
