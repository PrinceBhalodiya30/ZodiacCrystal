using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Zodiac_Crystal.Models;

public partial class Order
{
    [Key]
    public int OrderId { get; set; }

    public int UserId { get; set; }

    public DateTime OrderDate { get; set; }

    [Column(TypeName = "decimal(10, 2)")]
    public decimal TotalAmount { get; set; }

    [StringLength(20)]
    public string Status { get; set; } = "Pending";

    [StringLength(100)]
    public string ShippingName { get; set; } = null!;

    [StringLength(256)]
    public string ShippingEmail { get; set; } = null!;

    [StringLength(410)]
    public string ShippingAddress { get; set; } = null!;

    [StringLength(100)]
    public string City { get; set; } = null!;

    [StringLength(100)]
    public string State { get; set; } = null!;

    [StringLength(20)]
    public string PostalCode { get; set; } = null!;

    [StringLength(20)]
    public string Phone { get; set; } = null!;

    [Column(TypeName = "decimal(9, 6)")]
    public decimal? Latitude { get; set; }

    [Column(TypeName = "decimal(9, 6)")]
    public decimal? Longitude { get; set; }

    [StringLength(50)]
    public string? CouponCode { get; set; }

    [Column(TypeName = "decimal(10, 2)")]
    public decimal DiscountAmount { get; set; }

    // Threshold-based shipping charge applied at checkout (free at/above ₹999
    // item subtotal, ₹50 flat otherwise). Stored on the order itself - not
    // recalculated later - so historical orders keep whatever fee actually
    // applied to them even if the threshold/rate changes in the future.
    [Column(TypeName = "decimal(10, 2)")]
    public decimal ShippingFee { get; set; }

    public bool IsGiftWrap { get; set; } = false;

    [Column(TypeName = "decimal(10, 2)")]
    public decimal GiftFee { get; set; } = 0;

    [StringLength(100)]
    public string? GiftRecipient { get; set; }

    [StringLength(500)]
    public string? GiftMessage { get; set; }

    // 'Card' (Braintree) or 'COD'. See PaymentMethods / PaymentStatuses.
    [StringLength(20)]
    public string PaymentMethod { get; set; } = "COD";

    [StringLength(20)]
    public string PaymentStatus { get; set; } = "Pending";

    // Braintree transaction id - only set for card payments.
    [StringLength(64)]
    public string? PaymentTransactionId { get; set; }

    public DateTime? PaidAt { get; set; }

    public DateTime? ConfirmedAt { get; set; }

    public DateTime? ShippedAt { get; set; }

    // Entered (or auto-generated) when the order is marked Shipped. Demo data -
    // shown on the customer's tracking page, not linked to a real courier.
    [StringLength(50)]
    public string? CourierName { get; set; }

    [StringLength(50)]
    public string? TrackingNumber { get; set; }

    // Chosen by the customer when they cancel; null for admin cancellations.
    [StringLength(100)]
    public string? CancellationReason { get; set; }

    // Set when an admin marks the order Delivered; the return window runs from here.
    public DateTime? DeliveredAt { get; set; }

    // Sent by the checkout page, one per checkout attempt, so a retried or
    // double-submitted request returns this order instead of placing another.
    // Unique per customer (UX_Orders_UserId_IdempotencyKey).
    [StringLength(64)]
    public string? IdempotencyKey { get; set; }

    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;

    [InverseProperty("Order")]
    public virtual ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
