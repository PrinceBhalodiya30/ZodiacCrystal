using Zodiac_Crystal.Services;
using Zodiac_Crystal.Tests.Infrastructure;

namespace Zodiac_Crystal.Tests;

// Pure unit tests - no database.
public class CouponValidationServiceTests
{
    private readonly CouponValidationService _service = new();

    [Fact]
    public void Null_coupon_is_invalid()
    {
        var result = _service.Validate(null, 1000m);
        Assert.False(result.Valid);
        Assert.Equal("Invalid coupon code", result.Message);
    }

    [Fact]
    public void Inactive_coupon_is_rejected()
    {
        var coupon = TestData.NewCoupon();
        coupon.IsActive = false;
        Assert.Equal("This coupon is no longer active", _service.Validate(coupon, 1000m).Message);
    }

    [Fact]
    public void Not_yet_started_coupon_is_rejected()
    {
        var coupon = TestData.NewCoupon();
        coupon.StartDate = DateTime.UtcNow.AddDays(1);
        Assert.Equal("This coupon is not active yet", _service.Validate(coupon, 1000m).Message);
    }

    [Fact]
    public void Expired_coupon_is_rejected()
    {
        var coupon = TestData.NewCoupon();
        coupon.EndDate = DateTime.UtcNow.AddMinutes(-1);
        var result = _service.Validate(coupon, 1000m);
        Assert.False(result.Valid);
        Assert.Equal("This coupon has expired", result.Message);
    }

    [Fact]
    public void Coupon_at_usage_limit_is_rejected()
    {
        var coupon = TestData.NewCoupon();
        coupon.UsageLimit = 3;
        coupon.UsedCount = 3;
        Assert.Equal("This coupon has reached its usage limit", _service.Validate(coupon, 1000m).Message);
    }

    [Fact]
    public void Coupon_one_below_usage_limit_is_valid()
    {
        var coupon = TestData.NewCoupon();
        coupon.UsageLimit = 3;
        coupon.UsedCount = 2;
        Assert.True(_service.Validate(coupon, 1000m).Valid);
    }

    [Theory]
    [InlineData(1, 1, "You've already used this coupon")]
    [InlineData(2, 2, "You've already used this coupon the maximum of 2 times")]
    public void Per_user_limit_is_enforced(int maxPerUser, int userUses, string expected)
    {
        var coupon = TestData.NewCoupon();
        coupon.MaxUsesPerUser = maxPerUser;
        var result = _service.Validate(coupon, 1000m, userUses);
        Assert.False(result.Valid);
        Assert.Equal(expected, result.Message);
    }

    [Fact]
    public void Per_user_limit_allows_remaining_uses()
    {
        var coupon = TestData.NewCoupon();
        coupon.MaxUsesPerUser = 2;
        Assert.True(_service.Validate(coupon, 1000m, userUses: 1).Valid);
    }

    [Fact]
    public void Below_minimum_order_is_rejected_and_at_minimum_is_valid()
    {
        var coupon = TestData.NewCoupon();
        coupon.MinimumOrderAmount = 500m;

        Assert.False(_service.Validate(coupon, 499.99m).Valid);
        Assert.True(_service.Validate(coupon, 500m).Valid);
    }

    [Fact]
    public void Percentage_discount_is_rounded_to_two_places()
    {
        var coupon = TestData.NewCoupon();
        coupon.DiscountValue = 15m;
        var result = _service.Validate(coupon, 333.33m);
        Assert.True(result.Valid);
        Assert.Equal(50.00m, result.DiscountAmount); // 49.9995 rounds away from zero
    }

    [Fact]
    public void Fixed_discount_never_exceeds_order_amount()
    {
        var coupon = TestData.NewCoupon();
        coupon.DiscountType = "FixedAmount";
        coupon.DiscountValue = 1000m;
        Assert.Equal(200m, _service.Validate(coupon, 200m).DiscountAmount);
    }
}
