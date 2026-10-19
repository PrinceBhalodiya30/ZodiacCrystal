namespace Zodiac_Crystal.Services
{
    // Bound from the "Braintree" configuration section. Environment lives in
    // appsettings.json; MerchantId, PublicKey and PrivateKey must come from
    // User Secrets / environment variables only - never commit them.
    public class BraintreeSettings
    {
        // "sandbox" or "production".
        public string Environment { get; set; } = "sandbox";

        public string? MerchantId { get; set; }

        public string? PublicKey { get; set; }

        public string? PrivateKey { get; set; }

        // Optional. The Braintree merchant account to charge (it decides the
        // currency). Leave empty to use the account's default merchant account.
        public string? MerchantAccountId { get; set; }
    }
}
