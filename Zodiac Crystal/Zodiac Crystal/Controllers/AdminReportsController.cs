using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Models;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    // Revenue definition used consistently across every endpoint here: the sum of
    // Order.TotalAmount (the final, post-discount amount actually charged) for
    // every order that is NOT "Cancelled" and whose payment was NOT refunded (a
    // delivered order refunded through a return) - matching the same rule the
    // Admin Dashboard uses for its "Total Revenue" stat, so the two pages never
    // disagree with each other.
    //
    // Top-products/category-sales figures are based on OrderItem.Subtotal (the
    // per-line pre-discount amount), since a coupon discount is applied at the
    // order level, not allocated back to individual items - this is standard
    // practice for this kind of report and is intentionally NOT forced to add up
    // exactly to net order revenue when a discount was applied.
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminReportsController : ControllerBase
    {
        private const string CancelledStatus = "Cancelled";
        private const string DeliveredStatus = "Delivered";
        private const int DefaultTopProductsLimit = 10;

        private readonly CrystalsDbContext _context;
        private readonly CsvExportService _csvExportService;
        private readonly ReportOperationsService _operationsService;

        public AdminReportsController(CrystalsDbContext context, CsvExportService csvExportService, ReportOperationsService operationsService)
        {
            _context = context;
            _csvExportService = csvExportService;
            _operationsService = operationsService;
        }

        // GET: api/adminreports/operations?from=&to=
        // Fulfilment speed, returns, cancellations, customers and sales by state.
        [HttpGet("operations")]
        public async Task<ActionResult<ReportOperationsDto>> GetOperations(DateTime? from = null, DateTime? to = null)
        {
            return Ok(await _operationsService.ComputeAsync(from, to));
        }

        // GET: api/adminreports/summary?from=&to=    
        [HttpGet("summary")]                      
        public async Task<ActionResult<ReportSummaryDto>> GetSummary(DateTime? from = null, DateTime? to = null)
        {
            return Ok(await ComputeSummary(from, to));
        }
               
        // GET: api/adminreports/top-products?from=&to=&limit=10
        [HttpGet("top-products")]  
        public async Task<ActionResult<IEnumerable<TopProductDto>>> GetTopProducts(
            DateTime? from = null,
            DateTime? to = null,
            int limit = DefaultTopProductsLimit)
        { 
            return Ok(await ComputeTopProducts(from, to, limit)); 
        }
         
        // GET: api/adminreports/category-sales?from=&to=
        [HttpGet("category-sales")]                          
        public async Task<ActionResult<IEnumerable<CategorySalesDto>>> GetCategorySales( 
            DateTime? from = null, 
            DateTime? to = null) 
        {  
            return Ok(await ComputeCategorySales(from, to));
        }

        // GET: api/adminreports/zodiac-sales?from=&to=
        [HttpGet("zodiac-sales")]                                    
        public async Task<ActionResult<IEnumerable<ZodiacSalesDto>>> GetZodiacSales(
            DateTime? from = null,
            DateTime? to = null)
        {
            return Ok(await ComputeZodiacSales(from, to));
        }
        
        // GET: api/adminreports/coupon-performance?from=&to=
        [HttpGet("coupon-performance")]
        public async Task<ActionResult<IEnumerable<CouponPerformanceDto>>> GetCouponPerformance(
            DateTime? from = null,
            DateTime? to = null)
        {
            return Ok(await ComputeCouponPerformance(from, to));
        }

        // GET: api/adminreports/unsold-products?from=&to=&limit=20
        [HttpGet("unsold-products")]
        public async Task<ActionResult<UnsoldProductsDto>> GetUnsoldProducts(
            DateTime? from = null,
            DateTime? to = null,
            int limit = 20)
        {
            return Ok(await ComputeUnsoldProducts(from, to, Math.Clamp(limit, 1, 100)));
        }

        // GET: api/adminreports/daily-sales?from=&to=
        [HttpGet("daily-sales")]
        public async Task<ActionResult<IEnumerable<DailySalesDto>>> GetDailySales(
            DateTime? from = null,
            DateTime? to = null)
        {
            return Ok(await ComputeDailySales(from, to));
        }

        // GET: api/adminreports/order-insights?from=&to=
        [HttpGet("order-insights")]
        public async Task<ActionResult<OrderInsightsDto>> GetOrderInsights(DateTime? from = null, DateTime? to = null)
        {
            var ordersInRange = ApplyOrderDateRange(_context.Orders.AsNoTracking(), from, to);

            var statusCounts = await ordersInRange
                .GroupBy(o => o.Status)
                .Select(g => new StatusCountDto { Status = g.Key, Count = g.Count() })
                .ToListAsync();

            var paymentMethods = await ordersInRange
                .Where(o => o.Status != CancelledStatus)
                .GroupBy(o => o.PaymentMethod)
                .Select(g => new PaymentMethodSalesDto
                {
                    Method = g.Key,
                    Orders = g.Count(),
                    Revenue = g.Where(o => o.PaymentStatus != PaymentStatuses.Refunded).Sum(o => (decimal?)o.TotalAmount) ?? 0m
                })
                .ToListAsync();

            var cancellationReasons = await ordersInRange
                .Where(o => o.Status == CancelledStatus && o.CancellationReason != null)
                .GroupBy(o => o.CancellationReason!)
                .Select(g => new CancellationReasonCountDto { Reason = g.Key, Count = g.Count() })
                .OrderByDescending(r => r.Count)
                .ToListAsync();

            // Calendar days, a little looser than the business-day estimate.
            var overdueBefore = DateTime.Now.AddDays(-(DeliveryEstimate.ShippedMaxDays + 2));
            var overdueDeliveries = await _context.Orders
                .AsNoTracking()
                .CountAsync(o => o.Status == "Shipped" && o.ShippedAt != null && o.ShippedAt < overdueBefore);

            return Ok(new OrderInsightsDto
            {
                StatusCounts = statusCounts,
                PaymentMethods = paymentMethods,
                CancellationReasons = cancellationReasons,
                OverdueDeliveries = overdueDeliveries
            });
        }

        // GET: api/adminreports/export?from=&to=
        // Every section of the Reports page in one CSV, computed with the same
        // helpers as the JSON endpoints so the file always matches the page.
        private const int ExportUnsoldLimit = 500;

        [HttpGet("export")]
        public async Task<IActionResult> ExportReports(DateTime? from = null, DateTime? to = null, string rankBy = "revenue")
        {
            // rankBy mirrors the page's Revenue/Units toggle so the exported top 10 matches the chart.
            var byUnits = string.Equals(rankBy, "units", StringComparison.OrdinalIgnoreCase);

            var summary = await ComputeSummary(from, to);
            var topProducts = await ComputeTopProducts(from, to, DefaultTopProductsLimit, byUnits);
            var categorySales = await ComputeCategorySales(from, to);
            if (byUnits)
            {
                categorySales = categorySales.OrderByDescending(c => c.QuantitySold).ToList();
            }
            var dailySales = await ComputeDailySales(from, to);
            var zodiacSales = await ComputeZodiacSales(from, to);
            if (byUnits)
            {
                zodiacSales = zodiacSales.OrderByDescending(z => z.QuantitySold).ThenBy(z => z.ZodiacName).ToList();
            }
            var couponPerformance = await ComputeCouponPerformance(from, to);
            var unsold = await ComputeUnsoldProducts(from, to, ExportUnsoldLimit);
            var operations = await _operationsService.ComputeAsync(from, to);

            var builder = new System.Text.StringBuilder();

            builder.AppendLine("Report Period");
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "From", "To", "RankedBy" },
                new[]
                {
                    new object?[]
                    {
                        from?.ToString("yyyy-MM-dd") ?? "All time",
                        to?.ToString("yyyy-MM-dd") ?? "All time",
                        byUnits ? "Units" : "Revenue"
                    }
                }));
            builder.AppendLine();

            builder.AppendLine("Summary");
            builder.Append(_csvExportService.BuildCsvSection(
                new[]
                {
                    "TotalRevenue", "CollectedRevenue", "PendingCodRevenue", "RefundedAmount",
                    "TotalOrders", "DeliveredOrders", "CancelledOrders", "AverageOrderValue"
                },
                new[]
                {
                    new object?[]
                    {
                        summary.TotalRevenue, summary.CollectedRevenue, summary.PendingCodRevenue, summary.RefundedAmount,
                        summary.TotalOrders, summary.DeliveredOrders, summary.CancelledOrders, summary.AverageOrderValue
                    }
                }));
            builder.AppendLine();

            builder.AppendLine("Top-Selling Products");        
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "ProductId", "ProductName", "QuantitySold", "Revenue" },
                topProducts.Select(p => new object?[] { p.ProductId, p.ProductName, p.QuantitySold, p.Revenue }))); 
            builder.AppendLine();

            builder.AppendLine("Sales by Category");
            builder.Append(_csvExportService.BuildCsvSection( 
                new[] { "CategoryId", "CategoryName", "QuantitySold", "Revenue" },
                categorySales.Select(c => new object?[] { c.CategoryId, c.CategoryName, c.QuantitySold, c.Revenue })));
            builder.AppendLine();

            builder.AppendLine("Sales by Zodiac Sign (a product linked to several signs counts for each)");
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "ZodiacSign", "VedicRashi", "DisplayName", "QuantitySold", "Revenue" },
                zodiacSales.Select(z => new object?[] { z.ZodiacName, z.VedicRashi, z.DisplayName, z.QuantitySold, z.Revenue })));
            builder.AppendLine();

            builder.AppendLine("Coupon Performance");
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "Coupon", "Orders", "DiscountGiven", "Sales", "Active" },
                couponPerformance.Select(c => new object?[] { c.Code, c.OrderCount, c.DiscountGiven, c.Sales, c.IsActive })));
            builder.AppendLine();

            builder.AppendLine(unsold.TotalCount > unsold.Items.Count
                ? $"Products Not Selling (first {unsold.Items.Count} of {unsold.TotalCount})"
                : "Products Not Selling");
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "SKU", "Product", "Category", "Price", "InStock", "StockValue" },
                unsold.Items.Select(p => new object?[] { p.Sku, p.ProductName, p.CategoryName, p.Price, p.StockQuantity, p.Price * p.StockQuantity })));
            builder.AppendLine();

            var speed = operations.Fulfilment;
            builder.AppendLine("Fulfilment Speed (average hours)");
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "OrderToConfirmed", "ToShipped", "ShippedToDelivered", "OrderToDelivered", "DeliveredOrders" },
                new[] { new object?[] { speed.HoursToConfirm, speed.HoursToShip, speed.HoursToDeliver, speed.HoursEndToEnd, speed.DeliveredCount } }));
            builder.AppendLine();

            var cancellations = operations.Cancellations;
            builder.AppendLine("Cancellations");
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "Cancelled", "TotalOrders", "CancellationRatePercent", "ByCustomer", "ByAdmin", "CardRatePercent", "CodRatePercent" },
                new[] { new object?[] { cancellations.Cancelled, cancellations.TotalOrders, cancellations.CancellationRate, cancellations.ByCustomer, cancellations.ByAdmin, cancellations.CardCancellationRate, cancellations.CodCancellationRate } }));
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "CancellationReason", "Count" },
                cancellations.Reasons.Select(r => new object?[] { r.Reason, r.Count })));
            builder.AppendLine();

            var returns = operations.Returns;
            builder.AppendLine("Returns (orders placed in the period)");
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "Requested", "Approved", "Rejected", "Refunded", "DeliveredOrders", "ReturnRatePercent", "RefundedAmount" },
                new[] { new object?[] { returns.Requested, returns.Approved, returns.Rejected, returns.Refunded, returns.DeliveredOrders, returns.ReturnRate, returns.RefundedAmount } }));
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "ReturnReason", "Count" },
                returns.Reasons.Select(r => new object?[] { r.Reason, r.Count })));
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "MostReturnedProduct", "Returns", "UnitsReturned" },
                returns.TopProducts.Select(p => new object?[] { p.ProductName, p.ReturnCount, p.UnitsReturned })));
            builder.AppendLine();

            var customers = operations.Customers;
            builder.AppendLine("Customers");
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "Customers", "NewCustomers", "ReturningCustomers", "RepeatRatePercent" },
                new[] { new object?[] { customers.Customers, customers.NewCustomers, customers.ReturningCustomers, customers.RepeatRate } }));
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "TopCustomer", "Email", "Orders", "Spent" },
                customers.TopCustomers.Select(t => new object?[] { t.Name, t.Email, t.Orders, t.Spent })));
            builder.AppendLine();

            builder.AppendLine("Sales by State");
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "State", "Orders", "Revenue" },
                operations.States.Select(s => new object?[] { s.State, s.Orders, s.Revenue })));
            builder.AppendLine();

            // Like the chart, list every day in the range (0 for days with no sales),
            // not only the days that had orders.
            var dailyRows = dailySales.Select(d => (Date: d.Date.Date, d.Revenue, d.OrderCount)).ToList();
            if (from.HasValue && to.HasValue && from.Value.Date <= to.Value.Date)
            {
                var byDay = dailyRows.ToDictionary(d => d.Date);
                dailyRows = Enumerable
                    .Range(0, (to.Value.Date - from.Value.Date).Days + 1)
                    .Select(i => from.Value.Date.AddDays(i))
                    .Select(day => byDay.TryGetValue(day, out var row) ? row : (day, 0m, 0))
                    .ToList();
            }

            builder.AppendLine("Daily Sales");
            builder.Append(_csvExportService.BuildCsvSection(
                new[] { "Date", "Revenue", "OrderCount" },
                dailyRows.Select(d => new object?[] { d.Date.ToString("yyyy-MM-dd"), d.Revenue, d.OrderCount })));

            var csv = _csvExportService.WrapWithBom(builder.ToString());

            return File(csv, "text/csv", "sales-report-export.csv");
        }

        private async Task<ReportSummaryDto> ComputeSummary(DateTime? from, DateTime? to)
        {
            var ordersInRange = ApplyOrderDateRange(_context.Orders.AsNoTracking(), from, to);

            var totalOrders = await ordersInRange.CountAsync();
            var cancelledOrders = await ordersInRange.CountAsync(o => o.Status == CancelledStatus);
            var deliveredOrders = await ordersInRange.CountAsync(o => o.Status == DeliveredStatus);

            var revenueOrders = ordersInRange.Where(o => o.Status != CancelledStatus && o.PaymentStatus != PaymentStatuses.Refunded);
            var revenueOrderCount = await revenueOrders.CountAsync();
            var totalRevenue = revenueOrderCount > 0
                ? await revenueOrders.SumAsync(o => o.TotalAmount)
                : 0m;

            // Money actually received (card captured, or COD cash collected on delivery).
            var collectedRevenue = await ordersInRange
                .Where(o => o.Status != CancelledStatus && o.PaymentStatus == PaymentStatuses.Paid)
                .SumAsync(o => (decimal?)o.TotalAmount) ?? 0m;

            // COD orders still on their way - revenue booked, cash not yet in hand.
            var pendingCodRevenue = await ordersInRange
                .Where(o => o.Status != CancelledStatus &&
                            o.PaymentMethod == PaymentMethods.CashOnDelivery &&
                            o.PaymentStatus == PaymentStatuses.Pending)
                .SumAsync(o => (decimal?)o.TotalAmount) ?? 0m;

            var refundedAmount = await ordersInRange
                .Where(o => o.PaymentStatus == PaymentStatuses.Refunded)
                .SumAsync(o => (decimal?)o.TotalAmount) ?? 0m;

            return new ReportSummaryDto
            {
                TotalRevenue = totalRevenue,
                TotalOrders = totalOrders,
                DeliveredOrders = deliveredOrders,
                CancelledOrders = cancelledOrders,
                AverageOrderValue = revenueOrderCount > 0 ? Math.Round(totalRevenue / revenueOrderCount, 2) : 0m,
                CollectedRevenue = collectedRevenue,
                PendingCodRevenue = pendingCodRevenue,
                RefundedAmount = refundedAmount
            };
        }

        private async Task<List<TopProductDto>> ComputeTopProducts(DateTime? from, DateTime? to, int limit, bool byUnits = false)
        {
            if (limit < 1)
            {
                limit = DefaultTopProductsLimit;
            }
            else if (limit > 50)
            {
                limit = 50;
            }

            var items = ApplyOrderItemDateRange(
                _context.OrderItems.AsNoTracking().Where(oi => oi.Order.Status != CancelledStatus && oi.Order.PaymentStatus != PaymentStatuses.Refunded),
                from,
                to);

            var grouped = items
                .GroupBy(oi => new { oi.ProductId, oi.Product.Name })
                .Select(g => new TopProductDto
                {
                    ProductId = g.Key.ProductId,
                    ProductName = g.Key.Name,
                    QuantitySold = g.Sum(x => x.Quantity),
                    Revenue = g.Sum(x => x.Subtotal)
                });

            var ordered = byUnits
                ? grouped.OrderByDescending(p => p.QuantitySold)
                : grouped.OrderByDescending(p => p.Revenue);

            return await ordered
                .Take(limit)
                .ToListAsync();
        }

        private async Task<List<CategorySalesDto>> ComputeCategorySales(DateTime? from, DateTime? to)
        {
            var items = ApplyOrderItemDateRange(
                _context.OrderItems.AsNoTracking().Where(oi => oi.Order.Status != CancelledStatus && oi.Order.PaymentStatus != PaymentStatuses.Refunded),
                from,
                to);

            return await items
                .GroupBy(oi => new { oi.Product.CategoryId, oi.Product.Category.Name })
                .Select(g => new CategorySalesDto
                {
                    CategoryId = g.Key.CategoryId,
                    CategoryName = g.Key.Name,
                    QuantitySold = g.Sum(x => x.Quantity),
                    Revenue = g.Sum(x => x.Subtotal)
                })
                .OrderByDescending(c => c.Revenue)
                .ToListAsync();
        }

        private async Task<List<DailySalesDto>> ComputeDailySales(DateTime? from, DateTime? to)
        {
            var ordersInRange = ApplyOrderDateRange(
                _context.Orders.AsNoTracking().Where(o => o.Status != CancelledStatus && o.PaymentStatus != PaymentStatuses.Refunded),
                from,
                to);

            return await ordersInRange
                .GroupBy(o => o.OrderDate.Date)
                .Select(g => new DailySalesDto
                {
                    Date = g.Key,
                    Revenue = g.Sum(o => o.TotalAmount),
                    OrderCount = g.Count()
                })
                .OrderBy(d => d.Date)
                .ToListAsync();
        }

        private IQueryable<OrderItem> CountedItems(DateTime? from, DateTime? to) =>
            ApplyOrderItemDateRange(
                _context.OrderItems.AsNoTracking().Where(oi => oi.Order.Status != CancelledStatus && oi.Order.PaymentStatus != PaymentStatuses.Refunded),
                from,
                to);

        // A product can belong to several signs, so its sales count towards each
        // of them. Every sign is returned, including ones with no sales.
        private async Task<List<ZodiacSalesDto>> ComputeZodiacSales(DateTime? from, DateTime? to)
        {
            var totals = await CountedItems(from, to)
                .SelectMany(oi => oi.Product.Zodiacs, (oi, z) => new { z.ZodiacId, oi.Quantity, oi.Subtotal })
                .GroupBy(x => x.ZodiacId)
                .Select(g => new { ZodiacId = g.Key, Quantity = g.Sum(x => x.Quantity), Revenue = g.Sum(x => x.Subtotal) })
                .ToDictionaryAsync(x => x.ZodiacId);

            var signs = await _context.ZodiacSigns.AsNoTracking().ToListAsync();

            return signs
                .Select(z => new ZodiacSalesDto
                {
                    ZodiacId = z.ZodiacId,
                    ZodiacName = z.Name,
                    Symbol = z.Symbol,
                    QuantitySold = totals.TryGetValue(z.ZodiacId, out var t) ? t.Quantity : 0,
                    Revenue = totals.TryGetValue(z.ZodiacId, out var r) ? r.Revenue : 0m
                })
                .OrderByDescending(z => z.Revenue)
                .ThenBy(z => z.ZodiacName)
                .ToList();
        }

        private async Task<List<CouponPerformanceDto>> ComputeCouponPerformance(DateTime? from, DateTime? to)
        {
            var rows = await ApplyOrderDateRange(
                    _context.Orders.AsNoTracking().Where(o => o.CouponCode != null &&
                                                              o.CouponCode != MysteryBoxController.MysteryBoxCouponCode &&
                                                              o.Status != CancelledStatus &&
                                                              o.PaymentStatus != PaymentStatuses.Refunded),
                    from,
                    to)
                .GroupBy(o => o.CouponCode!)
                .Select(g => new
                {
                    Code = g.Key,
                    OrderCount = g.Count(),
                    DiscountGiven = g.Sum(o => o.DiscountAmount),
                    Sales = g.Sum(o => o.TotalAmount)
                })
                .ToListAsync();

            var codes = rows.Select(r => r.Code).ToList();
            var activeByCode = await _context.Coupons.AsNoTracking()
                .Where(c => codes.Contains(c.Code))
                .ToDictionaryAsync(c => c.Code, c => c.IsActive, StringComparer.OrdinalIgnoreCase);

            return rows
                .Select(r => new CouponPerformanceDto
                {
                    Code = r.Code,
                    OrderCount = r.OrderCount,
                    DiscountGiven = r.DiscountGiven,
                    Sales = r.Sales,
                    IsActive = activeByCode.TryGetValue(r.Code, out var active) && active
                })
                .OrderByDescending(r => r.OrderCount)
                .ThenByDescending(r => r.Sales)
                .ToList();
        }

        // Active products that were on sale during the range but sold nothing,
        // most stock first (that's the money sitting on the shelf).
        private async Task<UnsoldProductsDto> ComputeUnsoldProducts(DateTime? from, DateTime? to, int limit)
        {
            var soldIds = CountedItems(from, to).Select(oi => oi.ProductId);

            var query = _context.Products.AsNoTracking().Where(p => p.IsActive && !soldIds.Contains(p.ProductId));

            if (to.HasValue)
            {
                var exclusiveEnd = to.Value.Date.AddDays(1);
                query = query.Where(p => p.CreatedAt < exclusiveEnd);
            }

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(p => p.StockQuantity)
                .ThenBy(p => p.Name)
                .Take(limit)
                .Select(p => new UnsoldProductDto
                {
                    ProductId = p.ProductId,
                    ProductName = p.Name,
                    Sku = p.Sku,
                    CategoryName = p.Category.Name,
                    StockQuantity = p.StockQuantity,
                    Price = p.Price
                })
                .ToListAsync();

            return new UnsoldProductsDto { TotalCount = totalCount, Items = items };
        }

        private static IQueryable<Order> ApplyOrderDateRange(IQueryable<Order> query, DateTime? from, DateTime? to)
        {
            if (from.HasValue)
            {
                query = query.Where(o => o.OrderDate >= from.Value.Date);
            }

            if (to.HasValue)
            {
                var exclusiveEnd = to.Value.Date.AddDays(1);
                query = query.Where(o => o.OrderDate < exclusiveEnd);
            }

            return query;
        }

        private static IQueryable<OrderItem> ApplyOrderItemDateRange(IQueryable<OrderItem> query, DateTime? from, DateTime? to)
        {
            if (from.HasValue)
            {
                query = query.Where(oi => oi.Order.OrderDate >= from.Value.Date);
            }

            if (to.HasValue)
            {
                var exclusiveEnd = to.Value.Date.AddDays(1);
                query = query.Where(oi => oi.Order.OrderDate < exclusiveEnd);
            }

            return query;
        }
    }
}
