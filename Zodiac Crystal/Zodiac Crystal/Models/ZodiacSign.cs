using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Zodiac_Crystal.Models;

[Index("Name", Name = "UQ__ZodiacSi__737584F65EBA2ECE", IsUnique = true)]
public partial class ZodiacSign
{
    [Key]
    public int ZodiacId { get; set; }

    [StringLength(50)]
    public string Name { get; set; } = null!;

    [StringLength(10)]
    public string? Symbol { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }

    [StringLength(500)]
    public string? ImageUrl { get; set; }

    [ForeignKey("ZodiacId")]
    [InverseProperty("Zodiacs")]
    public virtual ICollection<Product> Products { get; set; } = new List<Product>();
}
