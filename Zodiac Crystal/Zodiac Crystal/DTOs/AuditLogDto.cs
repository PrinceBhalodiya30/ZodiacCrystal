namespace Zodiac_Crystal.DTOs
{
    public class AuditLogDto
    {
        public int AuditLogId { get; set; }

        public string AdminName { get; set; } = null!;

        public string Action { get; set; } = null!;

        public string EntityType { get; set; } = null!;

        public int? EntityId { get; set; }

        public string? Details { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}
