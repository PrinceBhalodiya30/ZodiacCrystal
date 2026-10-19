namespace Zodiac_Crystal.DTOs
{
    // Reports page "Operations": fulfilment speed, returns, cancellations,
    // customers and where orders ship to - all for orders placed in the range.
    public class ReportOperationsDto
    {
        public FulfilmentSpeedDto Fulfilment { get; set; } = new();
        public ReturnsReportDto Returns { get; set; } = new();
        public CancellationsReportDto Cancellations { get; set; } = new();
        public CustomersReportDto Customers { get; set; } = new();
        public List<StateSalesDto> States { get; set; } = new();
    }

    // Average hours for each step; null when no order in the range reached it.
    public class FulfilmentSpeedDto
    {
        public double? HoursToConfirm { get; set; }
        public double? HoursToShip { get; set; }
        public double? HoursToDeliver { get; set; }
        public double? HoursEndToEnd { get; set; }
        public int DeliveredCount { get; set; }
    }

    public class ReturnsReportDto
    {
        public int Requested { get; set; }
        public int Approved { get; set; }
        public int Rejected { get; set; }
        public int Refunded { get; set; }
        public int DeliveredOrders { get; set; }
        // Returns requested as a share of delivered orders, in percent.
        public double ReturnRate { get; set; }
        public decimal RefundedAmount { get; set; }
        public List<CancellationReasonCountDto> Reasons { get; set; } = new();
        public List<ReturnedProductDto> TopProducts { get; set; } = new();
    }

    public class ReturnedProductDto
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = null!;
        public int ReturnCount { get; set; }
        public int UnitsReturned { get; set; }
    }

    public class CancellationsReportDto
    {
        public int Cancelled { get; set; }
        public int TotalOrders { get; set; }
        public double CancellationRate { get; set; }
        public int ByCustomer { get; set; }
        public int ByAdmin { get; set; }
        public double CardCancellationRate { get; set; }
        public double CodCancellationRate { get; set; }
        public List<CancellationReasonCountDto> Reasons { get; set; } = new();
    }

    public class CustomersReportDto
    {
        public int Customers { get; set; }
        // Placed their first ever order in this range.
        public int NewCustomers { get; set; }
        public int ReturningCustomers { get; set; }
        // Customers with 2+ orders in the range, in percent.
        public double RepeatRate { get; set; }
        public List<TopCustomerDto> TopCustomers { get; set; } = new();
    }

    public class TopCustomerDto
    {
        public int UserId { get; set; }
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public int Orders { get; set; }
        public decimal Spent { get; set; }
    }

    public class StateSalesDto
    {
        public string State { get; set; } = null!;
        public int Orders { get; set; }
        public decimal Revenue { get; set; }
    }
}
