using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class CreateAddressDto
    {
        [Required]
        [StringLength(100)]
        public string FullName { get; set; } = null!;

        [Required]
        [StringLength(20)]
        [RegularExpression(@"^(\+91[\s-]?|0)?[6-9][0-9]{9}$", ErrorMessage = "Enter a valid 10-digit Indian mobile number.")]
        public string Phone { get; set; } = null!;

        [Required]
        [StringLength(200)]
        public string AddressLine1 { get; set; } = null!;

        [StringLength(200)]
        public string? AddressLine2 { get; set; }

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
        [StringLength(100)]
        public string Country { get; set; } = null!;

        // Optional pin from the address map.
        [Range(-90, 90)]
        public decimal? Latitude { get; set; }

        [Range(-180, 180)]
        public decimal? Longitude { get; set; }

        [StringLength(20)]
        public string AddressType { get; set; } = "Home";

        public bool IsDefault { get; set; }
    }
}
