using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

public partial class Address
{
    [Key]
    public int AddressId { get; set; }

    public int UserId { get; set; }

    [StringLength(100)]
    public string FullName { get; set; } = null!;

    [StringLength(20)]
    public string Phone { get; set; } = null!;

    [StringLength(200)]
    public string AddressLine1 { get; set; } = null!;

    [StringLength(200)]
    public string? AddressLine2 { get; set; }

    [StringLength(100)]
    public string City { get; set; } = null!;

    [StringLength(100)]
    public string State { get; set; } = null!;

    [StringLength(20)]
    public string PostalCode { get; set; } = null!;

    [StringLength(100)]
    public string Country { get; set; } = null!;

    [Column(TypeName = "decimal(9, 6)")]
    public decimal? Latitude { get; set; }

    [Column(TypeName = "decimal(9, 6)")]
    public decimal? Longitude { get; set; }

    [StringLength(20)]
    public string AddressType { get; set; } = "Home";

    public bool IsDefault { get; set; }

    public DateTime CreatedAt { get; set; }

    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;
}
