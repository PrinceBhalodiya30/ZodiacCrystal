namespace Zodiac_Crystal.Services
{
    // Rate limiter policy names, registered in RateLimitingSetup.
    public static class RateLimitPolicies
    {
        public const string AuthAttempts = "auth-attempts";
        public const string EmailSend = "email-send";
        public const string Checkout = "checkout";
        public const string CouponValidate = "coupon-validate";
        public const string Search = "search";
        public const string Expensive = "expensive";
    }
}
