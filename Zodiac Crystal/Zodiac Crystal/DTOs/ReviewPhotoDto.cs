namespace Zodiac_Crystal.DTOs
{
    // A customer photo on a review. Status is only sent to admins and to the
    // photo's own author; the public product page only ever gets Approved ones.
    public class ReviewPhotoDto
    {
        public int ReviewImageId { get; set; }

        public string ImageUrl { get; set; } = null!;

        public string? Status { get; set; }
    }

    public class UpdateReviewPhotoStatusDto
    {
        public string Status { get; set; } = null!;
    }
}
