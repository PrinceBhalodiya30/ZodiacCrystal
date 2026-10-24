using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    /// <summary>
    /// Single source of truth for coupon validation/discount-calculation rules.
    /// Used by both the customer-facing "validate" endpoint (UX-only, never mutates
    /// UsedCount) and OrdersController.CreateOrder (authoritative, re-validates
    /// inside the order transaction right before atomically incrementing UsedCount).
    /// Keeping this logic in one place guarantees both call sites agree on what
    /// counts as a valid coupon and how the discount is computed.
    /// </summary>
    public class CouponValidationService
    {
        // userUses: orders this customer has already placed with the coupon
        // (CountUsesByUserAsync). Only matters when the coupon has MaxUsesPerUser.
        public CouponValidationResultDto Validate(Coupon? coupon, decimal orderAmount, int userUses = 0)
        {
            if (coupon == null)
            {
                return Invalid("Invalid coupon code");
            }

            if (!coupon.IsActive)
            {
                return Invalid("This coupon is no longer active");
            }

            var now = DateTime.UtcNow;

            if (now < coupon.StartDate)
            {
                return Invalid("This coupon is not active yet");
            }

            if (now > coupon.EndDate)
            {
                return Invalid("This coupon has expired");
            }

            if (coupon.UsedCount >= coupon.UsageLimit)
            {
                return Invalid("This coupon has reached its usage limit");
            }

            if (coupon.MaxUsesPerUser is int maxPerUser && userUses >= maxPerUser)
            {
                return Invalid(maxPerUser == 1
                    ? "You've already used this coupon"
                    : $"You've already used this coupon the maximum of {maxPerUser} times");
            }

            if (orderAmount < coupon.MinimumOrderAmount)
            {
                return Invalid($"Minimum order amount of ₹{coupon.MinimumOrderAmount} required");
            }

            decimal discountAmount;

            if (string.Equals(coupon.DiscountType, "Percentage", StringComparison.OrdinalIgnoreCase))
            {
                discountAmount = orderAmount * (coupon.DiscountValue / 100m);
                if (discountAmount > orderAmount)
                {
                    discountAmount = orderAmount;
                }
            }
            else
            {
                // FixedAmount (or any other configured type) - never discount more than the order itself.
                discountAmount = Math.Min(coupon.DiscountValue, orderAmount);
            }

            discountAmount = Math.Round(discountAmount, 2, MidpointRounding.AwayFromZero);

            return new CouponValidationResultDto
            {
                Valid = true,
                Code = coupon.Code,
                DiscountAmount = discountAmount,
                Message = "Coupon applied successfully"
            };
        }

        // Orders this customer has placed with the coupon. Cancelled orders count
        // too, matching how the overall UsedCount works (a cancel never gives a use
        // back), so apply-cancel-reapply can't get around the limit.
        //
        // lockRows: at checkout, called inside the order transaction with UPDLOCK +
        // HOLDLOCK so a second simultaneous checkout by the same customer with the
        // same coupon waits for the first to finish, then counts its order.
        public static async Task<int> CountUsesByUserAsync(
            CrystalsDbContext context,
            int userId,
            string code,
            string? email = null,
            bool lockRows = false)
        {
            var cleanEmail = email?.Trim().ToLowerInvariant();

            if (!lockRows)
            {
                if (!string.IsNullOrEmpty(cleanEmail) && userId > 0)
                {
                    return await context.Orders.CountAsync(o =>
                        o.CouponCode == code && (o.UserId == userId || o.ShippingEmail.ToLower() == cleanEmail));
                }
                else if (!string.IsNullOrEmpty(cleanEmail))
                {
                    return await context.Orders.CountAsync(o =>
                        o.CouponCode == code && o.ShippingEmail.ToLower() == cleanEmail);
                }
                else
                {
                    return await context.Orders.CountAsync(o =>
                        o.CouponCode == code && o.UserId == userId);
                }
            }

            if (!string.IsNullOrEmpty(cleanEmail) && userId > 0)
            {
                return await context.Database
                    .SqlQuery<int>($"SELECT COUNT(*) AS [Value] FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK) WHERE CouponCode = {code} AND (UserId = {userId} OR LOWER(ShippingEmail) = {cleanEmail})")
                    .SingleAsync();
            }
            else if (!string.IsNullOrEmpty(cleanEmail))
            {
                return await context.Database
                    .SqlQuery<int>($"SELECT COUNT(*) AS [Value] FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK) WHERE CouponCode = {code} AND LOWER(ShippingEmail) = {cleanEmail}")
                    .SingleAsync();
            }
            else
            {
                return await context.Database
                    .SqlQuery<int>($"SELECT COUNT(*) AS [Value] FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK) WHERE CouponCode = {code} AND UserId = {userId}")
                    .SingleAsync();
            }
        }

        private static CouponValidationResultDto Invalid(string message)
        {
            return new CouponValidationResultDto
            {
                Valid = false,
                Code = null,
                DiscountAmount = 0,
                Message = message
            };
        }
    }
}
