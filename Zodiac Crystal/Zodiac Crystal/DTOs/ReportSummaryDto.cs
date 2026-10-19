namespace Zodiac_Crystal.DTOs
{
    public class ReportSummaryDto
    {
        public decimal TotalRevenue { get; set; }
        public int TotalOrders { get; set; }
        public int DeliveredOrders { get; set; }
        public int CancelledOrders { get; set; }
        public decimal AverageOrderValue { get; set; }

        // TotalRevenue split by whether the money has actually been received:
        // CollectedRevenue (card payments + COD collected on delivery) plus
        // PendingCodRevenue (COD orders not yet delivered) equals TotalRevenue.
        public decimal CollectedRevenue { get; set; }
        public decimal PendingCodRevenue { get; set; }

        // Card payments returned to customers for cancelled orders. Not part of
        // TotalRevenue (cancelled orders never are) - shown for reconciliation.
        public decimal RefundedAmount { get; set; }
    }
}
