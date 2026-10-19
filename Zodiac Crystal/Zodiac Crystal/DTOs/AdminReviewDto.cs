namespace Zodiac_Crystal.DTOs
{
    public class AdminReviewDto
    {
        public int ReviewId { get; set; }

        public int ProductId { get; set; }

        public string ProductName { get; set; } = null!;

        public int UserId { get; set; }

        public string UserName { get; set; } = null!;

        public int Rating { get; set; }

        public string? Comment { get; set; }

        public DateTime CreatedAt { get; set; }

        public string Status { get; set; } = null!;

        public string? AdminReply { get; set; }

        public DateTime? AdminReplyAt { get; set; }

        public List<ReviewPhotoDto> Images { get; set; } = new();
    }
}
