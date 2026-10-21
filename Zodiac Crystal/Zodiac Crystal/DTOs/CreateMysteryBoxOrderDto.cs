using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class CreateMysteryBoxOrderDto
    {
        [Required]
        [StringLength(100)]
        public string ShippingName { get; set; } = null!;

        [Required]
        [EmailAddress]
        [StringLength(256)]
        public string ShippingEmail { get; set; } = null!;

        [Required]
        [StringLength(410)]
        public string ShippingAddress { get; set; } = null!;

        [Required]
        [StringLength(100)]
        public string City { get; set; } = null!;

        [Required]
        [StringLength(100)]
        public string State { get; set; } = null!;

        [Required]
        [StringLength(20)]
        [RegularExpression(@"^[1-9][0-9]{5}$", ErrorMessage = "Enter a valid 6-digit PIN code.")]
        public string PostalCode { get; set; } = null!;

        [Required]
        [StringLength(20)]
        [RegularExpression(@"^(\+91[\s-]?|0)?[6-9][0-9]{9}$", ErrorMessage = "Enter a valid 10-digit Indian mobile number.")]
        public string Phone { get; set; } = null!;

        // Optional pin from the checkout map.
        [Range(-90, 90)]
        public decimal? Latitude { get; set; }

        [Range(-180, 180)]
        public decimal? Longitude { get; set; }

        // "Card" (Braintree) or "COD". Defaults to COD so older clients keep working.
        [RegularExpression("^(Card|COD)$", ErrorMessage = "Payment method must be Card or COD.")]
        public string PaymentMethod { get; set; } = "COD";

        // One-time Braintree payment method nonce from the Drop-in UI (Card only).
        [StringLength(4096)]
        public string? PaymentNonce { get; set; }

        // Braintree device data for fraud checks (Card only, optional).
        [StringLength(8192)]
        public string? DeviceData { get; set; }

        // One per checkout attempt (the page sends a UUID). A repeat request with
        // the same key returns the order already placed instead of a second one.
        [StringLength(64)]
        [RegularExpression("^[A-Za-z0-9-]{8,64}$", ErrorMessage = "Invalid idempotency key.")]
        public string? IdempotencyKey { get; set; }

        // Optional zodiac sign to personalize the mystery box with matching crystals.
        [Range(1, int.MaxValue, ErrorMessage = "Please select a valid zodiac sign.")]
        public int? ZodiacId { get; set; }
    }
}
