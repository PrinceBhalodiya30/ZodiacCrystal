using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Models;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    // "Mystery Crystal Box" - a fixed-price bundle of randomly selected, currently
    // in-stock crystals, guaranteed to be worth at least MinValue at catalog prices.
    // Reuses the existing Order/OrderItem tables rather than adding new schema -
    // a mystery box order is a normal Order whose CouponCode is set to the
    // MysteryBoxCouponCode sentinel (never a real, redeemable coupon) so the
    // order details page can label it distinctly instead of "Coupon: ...".
    [Route("api/mysterybox")]
    [ApiController]
    public class MysteryBoxController : ControllerBase
    {
        public const string MysteryBoxCouponCode = "MYSTERY-BOX";

        internal const int ItemCount = 3;
        internal const decimal MinValue = 2500m;
        internal const decimal Price = 1499m;
        private const int RandomAttempts = 25;

        private readonly CrystalsDbContext _context;
        private readonly ILogger<MysteryBoxController> _logger;
        private readonly BraintreePaymentService _paymentService;
        private readonly LowStockAlertService _lowStockAlertService;
        private readonly NotificationService _notificationService;
        private readonly IEmailService _emailService;
        private readonly AddressCheckService _addressCheckService;

        public MysteryBoxController(
            CrystalsDbContext context,
            ILogger<MysteryBoxController> logger,
            BraintreePaymentService paymentService,
            NotificationService notificationService,
            IEmailService emailService,
            LowStockAlertService lowStockAlertService,
            AddressCheckService addressCheckService)
        {
            _addressCheckService = addressCheckService;
            _context = context;
            _logger = logger;
            _paymentService = paymentService;
            _lowStockAlertService = lowStockAlertService;
            _notificationService = notificationService;
            _emailService = emailService;
        }

        // GET: api/mysterybox
        [HttpGet]
        public ActionResult<MysteryBoxInfoDto> GetInfo()
        {
            return Ok(new MysteryBoxInfoDto
            {
                ItemCount = ItemCount,
                MinimumValue = MinValue,
                Price = Price
            });
        }

        // POST: api/mysterybox/purchase
        [Authorize(Roles = "User")]
        [EnableRateLimiting(RateLimitPolicies.Checkout)]
        [HttpPost("purchase")]
        public async Task<ActionResult<OrderDto>> Purchase(CreateMysteryBoxOrderDto dto)
        {
            var userId = GetCurrentUserId();

            // Same as OrdersController.CreateOrder: a repeat of an attempt that
            // already placed its box gets that order back, without a new charge.
            if (dto.IdempotencyKey != null)
            {
                var existingId = await FindOrderByIdempotencyKeyAsync(userId, dto.IdempotencyKey);
                if (existingId != null)
                {
                    return await CreatedOrderResponseAsync(existingId.Value);
                }
            }

            var payByCard = dto.PaymentMethod == PaymentMethods.Card;

            if (payByCard && string.IsNullOrWhiteSpace(dto.PaymentNonce))
            {
                return BadRequest(new { message = "Please enter your card details to pay online." });
            }

            if (payByCard && !_paymentService.IsConfigured)
            {
                return BadRequest(new { message = "Card payments are not available right now. Please choose Cash on Delivery." });
            }

            var addressError = await _addressCheckService.ValidateAsync(
                dto.Latitude, dto.Longitude, dto.City, dto.State, dto.PostalCode, HttpContext.RequestAborted);
            if (addressError != null)
            {
                return BadRequest(new { message = addressError });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            string? chargedTransactionId = null;
            decimal chargedAmount = 0m;
            Order order;
            decimal actualValue;
            // Each product's stock before this order, for the low-stock alert.
            var stockBefore = new List<(Product Product, int Stock)>();

            try
            {
                // Re-checked inside the transaction (not just at selection time) so a
                // product that sold out between selection and commit can't be double-sold.
                var eligibleProducts = await _context.Products
                    .Where(p => p.IsActive && p.StockQuantity > 0)
                    .ToListAsync();

                var selected = SelectBoxProducts(eligibleProducts);

                if (selected == null)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new
                    {
                        message = "Mystery Crystal Box is currently unavailable. Please check back later."
                    });
                }

                actualValue = selected.Sum(p => p.Price);
                var discountAmount = actualValue - Price;

                order = new Order
                {
                    UserId = userId,
                    TotalAmount = Price,
                    CouponCode = MysteryBoxCouponCode,
                    DiscountAmount = discountAmount,
                    Status = "Pending",
                    ShippingName = dto.ShippingName,
                    ShippingEmail = dto.ShippingEmail,
                    ShippingAddress = dto.ShippingAddress,
                    City = dto.City,
                    State = dto.State,
                    PostalCode = dto.PostalCode,
                    Phone = dto.Phone,
                    // Only keep a complete pin; half a coordinate is useless.
                    Latitude = dto.Latitude.HasValue && dto.Longitude.HasValue ? Math.Round(dto.Latitude.Value, 6) : null,
                    Longitude = dto.Latitude.HasValue && dto.Longitude.HasValue ? Math.Round(dto.Longitude.Value, 6) : null,
                    PaymentMethod = payByCard ? PaymentMethods.Card : PaymentMethods.CashOnDelivery,
                    PaymentStatus = PaymentStatuses.Pending,
                    IdempotencyKey = dto.IdempotencyKey
                };

                foreach (var product in selected)
                {
                    order.OrderItems.Add(new OrderItem
                    {
                        ProductId = product.ProductId,
                        Quantity = 1,
                        UnitPrice = product.Price,
                        Subtotal = product.Price
                    });

                    // Atomic, like CreateOrder: the list above can be stale by now,
                    // so the unit is only taken if it's still in stock. Losing the
                    // race rolls the whole box back rather than overselling.
                    if (!await _context.Products.TryReserveAsync(product.ProductId, 1))
                    {
                        await transaction.RollbackAsync();
                        return Conflict(new
                        {
                            message = "One of the crystals for your box just sold out. Please try again."
                        });
                    }

                    // ExecuteUpdate bypasses the change tracker - reload so the tracked
                    // entity reflects the real stock (and SaveChanges won't overwrite it).
                    await _context.Entry(product).ReloadAsync();
                    stockBefore.Add((product, product.StockQuantity + 1));
                }

                _context.Orders.Add(order);

                await _context.SaveChangesAsync();

                // Same approach as OrdersController.CreateOrder: charge inside the
                // transaction so a declined card leaves no order or stock change behind.
                if (payByCard)
                {
                    var payment = await _paymentService.ChargeAsync(
                        order.TotalAmount, dto.PaymentNonce!, dto.DeviceData, order.OrderId);

                    if (!payment.Success)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = payment.ErrorMessage, paymentFailed = true });
                    }

                    chargedTransactionId = payment.TransactionId;
                    chargedAmount = order.TotalAmount;
                    order.PaymentStatus = PaymentStatuses.Paid;
                    order.PaymentTransactionId = payment.TransactionId;
                    order.PaidAt = DateTime.Now;

                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();
            }
            catch (DbUpdateException ex) when (chargedTransactionId == null
                && dto.IdempotencyKey != null
                && CheckoutSafety.IsDuplicateIdempotencyKey(ex))
            {
                // A simultaneous request with the same key placed the box first.
                // Only possible at the first SaveChanges, before any charge, so
                // rolling back the stock reservation is all that's needed.
                await transaction.RollbackAsync();
                _context.ChangeTracker.Clear();

                var existingId = await FindOrderByIdempotencyKeyAsync(userId, dto.IdempotencyKey!);
                if (existingId != null)
                {
                    return await CreatedOrderResponseAsync(existingId.Value);
                }

                _logger.LogError(ex, "Mystery box purchase failed for user {UserId}", userId);
                return StatusCode(500, new { message = "Your Mystery Crystal Box could not be created. Please try again." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Mystery box purchase failed for user {UserId}", userId);

                var reversed = false;
                if (chargedTransactionId != null)
                {
                    try
                    {
                        var reversal = await _paymentService.RefundAsync(chargedTransactionId);
                        reversed = reversal.Success;
                        if (!reversal.Success)
                        {
                            _logger.LogCritical("Charged transaction {TransactionId} could not be reversed after a failed mystery box save",
                                chargedTransactionId);
                        }
                    }
                    catch (Exception reverseEx)
                    {
                        _logger.LogCritical(reverseEx, "Charged transaction {TransactionId} could not be reversed after a failed mystery box save",
                            chargedTransactionId);
                    }

                    // The transaction above is already rolled back, so this row
                    // saves on its own and stays even though the order didn't.
                    if (!reversed)
                    {
                        await CheckoutSafety.RecordPaymentFailureAsync(_context, _logger, userId, chargedTransactionId,
                            chargedAmount, $"Mystery box save failed and the charge could not be reversed: {ex.Message}");
                    }
                }

                // Tell the customer what actually happened to their money. If the
                // reversal failed, they get the transaction reference to quote; the
                // LogCritical above alerts staff, and RefundAsync is safe to retry.
                return StatusCode(500, new
                {
                    message = chargedTransactionId == null
                        ? "Your Mystery Crystal Box could not be created. Please try again."
                        : reversed
                            ? "Your Mystery Crystal Box could not be created and your payment has been reversed. Please try again."
                            : $"Your Mystery Crystal Box could not be created, and we couldn't reverse your card payment automatically. Our team has been alerted and will refund it - please contact support@zodiaccrystals.com quoting payment reference {chargedTransactionId}.",
                    paymentReference = chargedTransactionId != null && !reversed ? chargedTransactionId : null
                });
            }

            // The order (and any card payment) is committed at this point. Nothing
            // below may roll it back or report it as failed - a notification or
            // email failure is only logged.
            Order createdOrder;
            try
            {
                createdOrder = await _context.Orders
                    .Include(o => o.User)
                    .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Product)
                    .FirstAsync(o => o.OrderId == order.OrderId);
            }
            catch (Exception ex)
            {
                // Fall back to the tracked order (its items and products are
                // already loaded) rather than reporting a placed order as failed.
                _logger.LogError(ex, "Mystery box order {OrderId} placed but reloading it failed", order.OrderId);
                createdOrder = order;
            }

            _logger.LogInformation(
                "Mystery box order {OrderId} created for user {UserId}, value {ActualValue}, paid {Price}",
                order.OrderId, userId, actualValue, Price);

            try
            {
                await _notificationService.NotifyOrderPlacedAsync(createdOrder);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Mystery box order {OrderId} placed but order-placed notification failed", order.OrderId);
            }

            // Sent to the order owner's account email (Order.User), not the
            // client-supplied ShippingEmail.
            try
            {
                await _emailService.SendOrderConfirmationAsync(createdOrder);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Mystery box order {OrderId} placed but order-confirmation email failed", order.OrderId);
            }

            try
            {
                await _lowStockAlertService.AlertIfCrossedAsync(stockBefore);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Mystery box order {OrderId} placed but low-stock alert failed", order.OrderId);
            }

            try
            {
                await _notificationService.BroadcastStockAsync(stockBefore.Select(s => s.Product));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Mystery box order {OrderId} placed but stock broadcast failed", order.OrderId);
            }

            return CreatedAtAction(
                "GetOrder",
                "Orders",
                new { id = order.OrderId },
                MapToOrderDto(createdOrder)
            );
        }

        private Task<int?> FindOrderByIdempotencyKeyAsync(int userId, string idempotencyKey)
        {
            return _context.Orders
                .AsNoTracking()
                .Where(o => o.UserId == userId && o.IdempotencyKey == idempotencyKey)
                .Select(o => (int?)o.OrderId)
                .FirstOrDefaultAsync();
        }

        // The same 201 response Purchase gives for a new box.
        private async Task<ActionResult<OrderDto>> CreatedOrderResponseAsync(int orderId)
        {
            var existing = await _context.Orders
                .AsNoTracking()
                .Include(o => o.User)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .FirstAsync(o => o.OrderId == orderId);

            _logger.LogInformation("Mystery box order {OrderId} returned for a repeated checkout request", orderId);

            return CreatedAtAction("GetOrder", "Orders", new { id = orderId }, MapToOrderDto(existing));
        }

        // Picks ItemCount distinct eligible products whose combined price is at
        // least MinValue. Tries a handful of random samples first (so the box is
        // genuinely a surprise), then falls back to the highest-priced eligible
        // products (the only combination guaranteed to reach MinValue if any can).
        // Returns null if the catalog simply can't support the guarantee right now.
        internal static List<Product>? SelectBoxProducts(List<Product> eligibleProducts)
        {
            if (eligibleProducts.Count < ItemCount)
            {
                return null;
            }

            var random = Random.Shared;

            for (var attempt = 0; attempt < RandomAttempts; attempt++)
            { 
                var sample = eligibleProducts
                    .OrderBy(_ => random.Next()) 
                    .Take(ItemCount)
                    .ToList(); 

                if (sample.Sum(p => p.Price) >= MinValue)
                {
                    return sample;
                }
            }

            var topByPrice = eligibleProducts
                .OrderByDescending(p => p.Price)
                .Take(ItemCount)
                .ToList();

            return topByPrice.Sum(p => p.Price) >= MinValue ? topByPrice : null;
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }

        private static OrderDto MapToOrderDto(Order order)
        {
            return new OrderDto
            {
                OrderId = order.OrderId,
                OrderDate = order.OrderDate,
                TotalAmount = order.TotalAmount, 
                Status = order.Status,
                CouponCode = order.CouponCode,
                DiscountAmount = order.DiscountAmount,
                PaymentMethod = order.PaymentMethod,
                PaymentStatus = order.PaymentStatus,
                PaidAt = order.PaidAt,
                ShippingName = order.ShippingName,
                ShippingEmail = order.ShippingEmail,
                ShippingAddress = order.ShippingAddress,
                City = order.City,
                State = order.State,
                PostalCode = order.PostalCode,
                Phone = order.Phone,
                Latitude = order.Latitude,
                Longitude = order.Longitude,
                Items = order.OrderItems.Select(oi => new OrderItemDto
                {
                    OrderItemId = oi.OrderItemId,
                    ProductId = oi.ProductId,
                    ProductName = oi.Product.Name,
                    Quantity = oi.Quantity,
                    UnitPrice = oi.UnitPrice,
                    Subtotal = oi.Subtotal
                }).ToList()
            };
        }
    }
}
