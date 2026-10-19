using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;

namespace Zodiac_Crystal.Services
{
    // Reports page "Operations" figures, for orders placed in a date range.
    // Revenue follows the same rule as the rest of the reports: not cancelled,
    // not refunded.
    public class ReportOperationsService
    {
        private const string CancelledStatus = "Cancelled";
        private const string DeliveredStatus = "Delivered";
        private const int TopLimit = 5;

        private readonly CrystalsDbContext _context;

        public ReportOperationsService(CrystalsDbContext context)
        {
            _context = context;
        }

        public async Task<ReportOperationsDto> ComputeAsync(DateTime? from, DateTime? to)
        {
            var query = _context.Orders.AsNoTracking();
            if (from.HasValue)
            {
                query = query.Where(o => o.OrderDate >= from.Value.Date);
            }
            if (to.HasValue)
            {
                var exclusiveEnd = to.Value.Date.AddDays(1);
                query = query.Where(o => o.OrderDate < exclusiveEnd);
            }

            // A shop this size has few enough orders in any range to work on in memory.
            var orders = await query
                .Select(o => new OrderRow(
                    o.OrderId, o.UserId, o.OrderDate, o.Status, o.PaymentMethod, o.PaymentStatus, o.TotalAmount,
                    o.State, o.ConfirmedAt, o.ShippedAt, o.DeliveredAt, o.CancellationReason,
                    o.User.Name, o.User.Email))
                .ToListAsync();

            var counted = orders.Where(o => o.Status != CancelledStatus && o.PaymentStatus != PaymentStatuses.Refunded).ToList();
            var delivered = orders.Where(o => o.Status == DeliveredStatus).ToList();

            return new ReportOperationsDto
            {
                Fulfilment = new FulfilmentSpeedDto
                {
                    HoursToConfirm = AverageHours(orders.Select(o => ((DateTime?)o.OrderDate, o.ConfirmedAt))),
                    HoursToShip = AverageHours(orders.Select(o => ((DateTime?)(o.ConfirmedAt ?? o.OrderDate), o.ShippedAt))),
                    HoursToDeliver = AverageHours(orders.Select(o => (o.ShippedAt, o.DeliveredAt))),
                    HoursEndToEnd = AverageHours(delivered.Select(o => ((DateTime?)o.OrderDate, o.DeliveredAt))),
                    DeliveredCount = delivered.Count
                },
                Returns = await ComputeReturns(orders, delivered.Count),
                Cancellations = ComputeCancellations(orders),
                Customers = await ComputeCustomers(orders, counted, from),
                States = counted
                    .GroupBy(o => string.IsNullOrWhiteSpace(o.State) ? "Unknown" : o.State.Trim())
                    .Select(g => new StateSalesDto { State = g.Key, Orders = g.Count(), Revenue = g.Sum(o => o.TotalAmount) })
                    .OrderByDescending(s => s.Revenue)
                    .ToList()
            };
        }

        private async Task<ReturnsReportDto> ComputeReturns(List<OrderRow> orders, int deliveredCount)
        {
            var orderIds = orders.Select(o => o.OrderId).ToList();

            var returns = await _context.ReturnRequests
                .AsNoTracking()
                .Where(r => orderIds.Contains(r.OrderId))
                .Select(r => new { r.OrderId, r.Reason, r.Status })
                .ToListAsync();

            var returnedOrderIds = returns.Select(r => r.OrderId).ToList();
            var returnedItems = await _context.OrderItems
                .AsNoTracking()
                .Where(oi => returnedOrderIds.Contains(oi.OrderId))
                .Select(oi => new { oi.ProductId, oi.Product.Name, oi.Quantity, oi.OrderId })
                .ToListAsync();

            var refundedOrderIds = returns.Where(r => r.Status == ReturnStatuses.Refunded).Select(r => r.OrderId).ToHashSet();

            return new ReturnsReportDto
            {
                Requested = returns.Count(r => r.Status == ReturnStatuses.Requested),
                Approved = returns.Count(r => r.Status == ReturnStatuses.Approved),
                Rejected = returns.Count(r => r.Status == ReturnStatuses.Rejected),
                Refunded = returns.Count(r => r.Status == ReturnStatuses.Refunded),
                DeliveredOrders = deliveredCount,
                ReturnRate = Percent(returns.Count, deliveredCount),
                RefundedAmount = orders.Where(o => refundedOrderIds.Contains(o.OrderId)).Sum(o => o.TotalAmount),
                Reasons = returns
                    .GroupBy(r => ReturnReasons.Label(r.Reason))
                    .Select(g => new CancellationReasonCountDto { Reason = g.Key, Count = g.Count() })
                    .OrderByDescending(r => r.Count)
                    .ToList(),
                TopProducts = returnedItems
                    .GroupBy(i => new { i.ProductId, i.Name })
                    .Select(g => new ReturnedProductDto
                    {
                        ProductId = g.Key.ProductId,
                        ProductName = g.Key.Name,
                        ReturnCount = g.Select(i => i.OrderId).Distinct().Count(),
                        UnitsReturned = g.Sum(i => i.Quantity)
                    })
                    .OrderByDescending(p => p.ReturnCount).ThenByDescending(p => p.UnitsReturned)
                    .Take(TopLimit)
                    .ToList()
            };
        }

        private static CancellationsReportDto ComputeCancellations(List<OrderRow> orders)
        {
            var cancelled = orders.Where(o => o.Status == CancelledStatus).ToList();
            double RateFor(string method)
            {
                var forMethod = orders.Where(o => o.PaymentMethod == method).ToList();
                return Percent(forMethod.Count(o => o.Status == CancelledStatus), forMethod.Count);
            }

            return new CancellationsReportDto
            {
                Cancelled = cancelled.Count,
                TotalOrders = orders.Count,
                CancellationRate = Percent(cancelled.Count, orders.Count),
                // Only customer cancellations record a reason.
                ByCustomer = cancelled.Count(o => o.CancellationReason != null),
                ByAdmin = cancelled.Count(o => o.CancellationReason == null),
                CardCancellationRate = RateFor(PaymentMethods.Card),
                CodCancellationRate = RateFor(PaymentMethods.CashOnDelivery),
                Reasons = cancelled
                    .Where(o => o.CancellationReason != null)
                    .GroupBy(o => o.CancellationReason!)
                    .Select(g => new CancellationReasonCountDto { Reason = g.Key, Count = g.Count() })
                    .OrderByDescending(r => r.Count)
                    .ToList()
            };
        }

        private async Task<CustomersReportDto> ComputeCustomers(List<OrderRow> orders, List<OrderRow> counted, DateTime? from)
        {
            // "New" = their first ever order falls in this range.
            var customerIds = orders.Select(o => o.UserId).Distinct().ToList();
            var firstOrderDates = await _context.Orders
                .AsNoTracking()
                .Where(o => customerIds.Contains(o.UserId))
                .GroupBy(o => o.UserId)
                .Select(g => new { UserId = g.Key, First = g.Min(o => o.OrderDate) })
                .ToDictionaryAsync(x => x.UserId, x => x.First);

            var rangeStart = from?.Date ?? DateTime.MinValue;
            var newCustomers = customerIds.Count(id => firstOrderDates.TryGetValue(id, out var first) && first >= rangeStart);

            return new CustomersReportDto
            {
                Customers = customerIds.Count,
                NewCustomers = newCustomers,
                ReturningCustomers = customerIds.Count - newCustomers,
                RepeatRate = Percent(orders.GroupBy(o => o.UserId).Count(g => g.Count() > 1), customerIds.Count),
                TopCustomers = counted
                    .GroupBy(o => new { o.UserId, o.CustomerName, o.CustomerEmail })
                    .Select(g => new TopCustomerDto
                    {
                        UserId = g.Key.UserId,
                        Name = g.Key.CustomerName,
                        Email = g.Key.CustomerEmail,
                        Orders = g.Count(),
                        Spent = g.Sum(o => o.TotalAmount)
                    })
                    .OrderByDescending(c => c.Spent)
                    .Take(TopLimit)
                    .ToList()
            };
        }

        private static double Percent(int part, int whole) => whole > 0 ? Math.Round(part * 100.0 / whole, 1) : 0;

        private static double? AverageHours(IEnumerable<(DateTime? Start, DateTime? End)> spans)
        {
            var hours = spans
                .Where(s => s.Start.HasValue && s.End.HasValue && s.End >= s.Start)
                .Select(s => (s.End!.Value - s.Start!.Value).TotalHours)
                .ToList();
            return hours.Count > 0 ? Math.Round(hours.Average(), 1) : null;
        }

        private record OrderRow(
            int OrderId, int UserId, DateTime OrderDate, string Status, string PaymentMethod, string PaymentStatus,
            decimal TotalAmount, string State, DateTime? ConfirmedAt, DateTime? ShippedAt, DateTime? DeliveredAt,
            string? CancellationReason, string CustomerName, string CustomerEmail);
    }
}
