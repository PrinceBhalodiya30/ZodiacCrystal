using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

// A customer photo on a review. Moderated on its own: shown on the product
// page only once Status is "Approved" (see ReviewPhotoStatuses).
public partial class ReviewImage
{
    [Key]
    public int ReviewImageId { get; set; }

    public int ReviewId { get; set; }

    [StringLength(500)]
    public string ImageUrl { get; set; } = null!;

    [StringLength(20)]
    public string Status { get; set; } = "Pending";

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    [ForeignKey("ReviewId")]
    public virtual ProductReview Review { get; set; } = null!;
}
