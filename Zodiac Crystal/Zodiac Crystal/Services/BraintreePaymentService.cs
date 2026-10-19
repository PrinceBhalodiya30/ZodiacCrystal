using Braintree;
using Microsoft.Extensions.Options;

namespace Zodiac_Crystal.Services
{
    public record PaymentResult(bool Success, string? TransactionId, string? ErrorMessage)
    {
        public static PaymentResult Ok(string transactionId) => new(true, transactionId, null);
        public static PaymentResult Fail(string message) => new(false, null, message);
    }

    // Thin wrapper around the Braintree gateway: client tokens for the Drop-in
    // UI, server-side charges, and void/refund when a paid order is cancelled.
    // The amount charged is always the server-calculated order total - the
    // browser only ever supplies a one-time payment method nonce.
    public class BraintreePaymentService
    {
        private readonly BraintreeSettings _settings;
        private readonly ILogger<BraintreePaymentService> _logger;
        private readonly Lazy<IBraintreeGateway> _gateway;

        public BraintreePaymentService(IOptions<BraintreeSettings> settings, ILogger<BraintreePaymentService> logger)
        {
            _settings = settings.Value;
            _logger = logger;
            _gateway = new Lazy<IBraintreeGateway>(CreateGateway);
        }

        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(_settings.MerchantId) &&
            !string.IsNullOrWhiteSpace(_settings.PublicKey) &&
            !string.IsNullOrWhiteSpace(_settings.PrivateKey);

        public bool IsSandbox => !_settings.Environment.Equals("production", StringComparison.OrdinalIgnoreCase);

        public async Task<string> GenerateClientTokenAsync()
        {
            var request = string.IsNullOrWhiteSpace(_settings.MerchantAccountId)
                ? null
                : new ClientTokenRequest { MerchantAccountId = _settings.MerchantAccountId };

            return await _gateway.Value.ClientToken.GenerateAsync(request);
        }

        public async Task<PaymentResult> ChargeAsync(decimal amount, string paymentMethodNonce, string? deviceData, int orderId)
        {
            var request = new TransactionRequest
            {
                Amount = amount,
                PaymentMethodNonce = paymentMethodNonce,
                DeviceData = string.IsNullOrWhiteSpace(deviceData) ? null : deviceData,
                OrderId = orderId.ToString(),
                MerchantAccountId = string.IsNullOrWhiteSpace(_settings.MerchantAccountId) ? null : _settings.MerchantAccountId,
                Options = new TransactionOptionsRequest { SubmitForSettlement = true }
            };

            var result = await _gateway.Value.Transaction.SaleAsync(request);

            if (result.IsSuccess())
            {
                _logger.LogInformation("Braintree charge succeeded for order {OrderId}, transaction {TransactionId}",
                    orderId, result.Target.Id);
                return PaymentResult.Ok(result.Target.Id);
            }

            // A processor/gateway decline comes back with a Transaction; a
            // validation problem (bad/used nonce etc.) comes back without one.
            var declined = result.Transaction;
            if (declined != null)
            {
                _logger.LogWarning("Braintree charge declined for order {OrderId}: {Status} {Code} {Text}",
                    orderId, declined.Status, declined.ProcessorResponseCode, declined.ProcessorResponseText);

                if (declined.Status == TransactionStatus.GATEWAY_REJECTED)
                {
                    return PaymentResult.Fail("Your payment was blocked by our payment provider's security checks. Please try another card.");
                }

                var bankReason = string.IsNullOrWhiteSpace(declined.ProcessorResponseText)
                    ? ""
                    : $" ({declined.ProcessorResponseText})";

                return PaymentResult.Fail($"Your card was declined{bankReason}. No money was taken - please try another card.");
            }

            _logger.LogWarning("Braintree charge failed validation for order {OrderId}: {Message}", orderId, result.Message);
            return PaymentResult.Fail("Your payment details could not be verified. Please re-enter your card and try again.");
        }

        // Voids a transaction that hasn't settled yet (no money moved), or
        // refunds it in full once it has settled.
        public async Task<PaymentResult> RefundAsync(string transactionId)
        {
            Transaction transaction;
            try
            {
                transaction = await _gateway.Value.Transaction.FindAsync(transactionId);
            }
            catch (Braintree.Exceptions.NotFoundException)
            {
                _logger.LogWarning("Transaction {TransactionId} was not found in Braintree", transactionId);
                return PaymentResult.Fail("This payment could not be found at the payment provider. Please check it in the Braintree dashboard.");
            }

            // Already refunded (e.g. a retry after the refund went through but our
            // database save failed) - treat as success so the order can be updated.
            // Only full refunds are ever issued, so any refund means fully refunded.
            if (transaction.RefundIds != null && transaction.RefundIds.Count > 0)
            {
                _logger.LogInformation("Transaction {TransactionId} was already refunded", transactionId);
                return PaymentResult.Ok(transaction.Id);
            }

            var canVoid = transaction.Status == TransactionStatus.AUTHORIZED ||
                          transaction.Status == TransactionStatus.SUBMITTED_FOR_SETTLEMENT ||
                          transaction.Status == TransactionStatus.SETTLEMENT_PENDING;

            var canRefund = transaction.Status == TransactionStatus.SETTLED ||
                            transaction.Status == TransactionStatus.SETTLING;

            if (transaction.Status == TransactionStatus.VOIDED)
            {
                return PaymentResult.Ok(transaction.Id);
            }

            if (!canVoid && !canRefund)
            {
                _logger.LogWarning("Transaction {TransactionId} in status {Status} cannot be voided or refunded",
                    transactionId, transaction.Status);
                return PaymentResult.Fail("This payment can't be refunded automatically. Please refund it from the Braintree dashboard.");
            }

            var result = canVoid
                ? await _gateway.Value.Transaction.VoidAsync(transactionId)
                : await _gateway.Value.Transaction.RefundAsync(transactionId);

            if (result.IsSuccess())
            {
                _logger.LogInformation("Braintree transaction {TransactionId} {Action}",
                    transactionId, canVoid ? "voided" : "refunded");
                return PaymentResult.Ok(result.Target.Id);
            }

            _logger.LogWarning("Braintree {Action} failed for {TransactionId}: {Message}",
                canVoid ? "void" : "refund", transactionId, result.Message);
            return PaymentResult.Fail("The refund could not be processed. Please try again.");
        }

        private IBraintreeGateway CreateGateway()
        {
            if (!IsConfigured)
            {
                throw new InvalidOperationException(
                    "Braintree is not configured. Set Braintree:MerchantId, Braintree:PublicKey and Braintree:PrivateKey via User Secrets.");
            }

            var environment = _settings.Environment.Equals("production", StringComparison.OrdinalIgnoreCase)
                ? Braintree.Environment.PRODUCTION
                : Braintree.Environment.SANDBOX;

            return new BraintreeGateway(environment, _settings.MerchantId, _settings.PublicKey, _settings.PrivateKey);
        }
    }
}
