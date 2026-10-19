namespace Zodiac_Crystal.DTOs
{
    public class AddressDto
    {
        public int AddressId { get; set; }
        public string FullName { get; set; } = null!;
        public string Phone { get; set; } = null!;
        public string AddressLine1 { get; set; } = null!;
        public string? AddressLine2 { get; set; }
        public string City { get; set; } = null!;
        public string State { get; set; } = null!;
        public string PostalCode { get; set; } = null!;
        public string Country { get; set; } = null!;

        public decimal? Latitude { get; set; }

        public decimal? Longitude { get; set; }
        public string AddressType { get; set; } = null!;
        public bool IsDefault { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
