namespace Zodiac_Crystal.DTOs
{
    // Everything the admin order drawer shows: the order itself (same shape the
    // customer sees), who placed it, what happened to it and when, and which
    // status changes are still allowed from here.
    public class AdminOrderDetailDto
    {
        public OrderDto Order { get; set; } = null!;

        public int CustomerUserId { get; set; }

        public string CustomerName { get; set; } = null!;

        public string CustomerEmail { get; set; } = null!;

        public List<string> AllowedNextStatuses { get; set; } = new();

        // Oldest first.
        public List<OrderTimelineEventDto> Timeline { get; set; } = new();
    }

    public class OrderTimelineEventDto
    {
        // Null when the moment isn't recorded (e.g. a customer cancellation).
        public DateTime? At { get; set; }

        public string Title { get; set; } = null!;

        public string? Detail { get; set; }

        // placed | paid | status | cancelled | return | refund - lets the UI pick an icon/colour.
        public string Kind { get; set; } = null!;
    }
}
