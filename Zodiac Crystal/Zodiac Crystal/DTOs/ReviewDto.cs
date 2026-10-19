namespace Zodiac_Crystal.DTOs
{
    public class ReviewDto
    {
        public int ReviewId { get; set; }

        public int ProductId { get; set; }

        public int UserId { get; set; }

        public string UserName { get; set; } = null!;

        public int Rating { get; set; }

        public string? Comment { get; set; }

        public DateTime CreatedAt { get; set; }

        public string? AdminReply { get; set; }

        public DateTime? AdminReplyAt { get; set; }

        public List<ReviewPhotoDto> Images { get; set; } = new();
    }
}
