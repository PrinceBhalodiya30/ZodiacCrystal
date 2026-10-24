import { Component, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService, GIFT_PACKAGING_FEE, shippingFeeFor } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { CouponService } from '../../services/coupon.service';
import { AddressService } from '../../services/address.service';
import { CartItem } from '../../models/cart';
import { Address } from '../../models/address';
import { PublicCoupon } from '../../models/coupon';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { PhoneInput } from '../../components/phone-input/phone-input';
import { PaymentMethodSelect } from '../../components/payment-method-select/payment-method-select';
import { PaymentDetails, PaymentMethod } from '../../models/order';
import { MapAddressFields } from '../../components/map-address-fields/map-address-fields';
import { GuestCheckoutGate } from '../../components/guest-checkout-gate/guest-checkout-gate';
import { GuestSessionService } from '../../services/guest-session.service';

import { InrPipe } from '../../pipes/inr.pipe';
@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [InrPipe, FormsModule, RouterLink, ImgFallbackDirective, PhoneInput, PaymentMethodSelect, MapAddressFields, GuestCheckoutGate],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css'
})
export class Checkout implements OnInit {
  readonly cartService = inject(CartService);
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private couponService = inject(CouponService);
  private addressService = inject(AddressService);
  private guestSession = inject(GuestSessionService);
  private router = inject(Router);

  paymentMethod = signal<PaymentMethod>('COD');
  paymentSelect = viewChild(PaymentMethodSelect);

  // A Buy Now purchase checks out just that one item; otherwise, the whole cart.
  items = computed<CartItem[]>(() => {
    const buyNowItem = this.cartService.buyNowItem();
    return buyNowItem ? [buyNowItem] : this.cartService.items();
  });

  // Buy Now checkouts go back to that product; cart checkouts go back to the cart.
  buyNowProductId = computed(() => this.cartService.buyNowItem()?.product.productId ?? null);

  // Leaving a Buy Now checkout drops that one-off item so it can't linger and
  // replace the cart the next time the shopper reaches checkout.
  leaveBuyNow(): void {
    this.cartService.clearBuyNowItem();
  }

  total = computed(() =>
    this.items().reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  );

  // Display estimate only - the backend computes the fee it actually charges.
  shippingFee = computed(() => shippingFeeFor(this.total()));

  // Lines asking for more than is in stock (or sold out). Payment is blocked until fixed.
  stockProblems = computed(() =>
    this.items().filter(i => i.product.stockQuantity <= 0 || i.quantity > i.product.stockQuantity)
  );

  // Notes from re-checking prices/availability when checkout opened.
  changeNotes = signal<string[]>([]);

  // Discount is only ever a server-validated amount, never computed client-side.
  appliedCouponCode = signal<string | null>(null);
  appliedDiscountAmount = signal(0);

  // The subtotal the applied discount was validated against. If the items change
  // (price refresh, live stock), the coupon is re-checked so the discount shown
  // is the one the server will actually give.
  private couponValidatedForTotal: number | null = null;

  private revalidateCoupon = effect(() => {
    const total = this.total();
    untracked(() => {
      const code = this.appliedCouponCode();
      if (code && this.couponValidatedForTotal !== null && this.couponValidatedForTotal !== total && !this.isApplyingCoupon()) {
        this.applyCouponCode(code);
      }
    });
  });

  couponCodeInput = '';
  isApplyingCoupon = signal(false);
  couponMessage = signal('');
  couponMessageType = signal<'success' | 'error'>('error');

  availableCoupons = signal<PublicCoupon[]>([]);
  isLoadingCoupons = signal(true);

  remainingAfterCoupon = computed(() => Math.max(0, this.total() - this.appliedDiscountAmount()));

  readonly giftPackagingFee = GIFT_PACKAGING_FEE;

  orderTotal = computed(() => this.remainingAfterCoupon() + this.shippingFee() + this.cartService.giftFee());

  toggleGiftWrap(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.cartService.setGiftWrap(checked);
  }

  onRecipientChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.cartService.setGiftWrap(this.cartService.isGiftWrap(), val, this.cartService.giftMessage());
  }

  onMessageChange(event: Event): void {
    const val = (event.target as HTMLTextAreaElement).value;
    this.cartService.setGiftWrap(this.cartService.isGiftWrap(), this.cartService.giftRecipient(), val);
  }

  // Saved addresses
  savedAddresses = signal<Address[]>([]);
  isLoadingAddresses = signal(false);
  // null selection = filling in a new/one-off address by hand.
  selectedAddressId = signal<number | null>(null);

  // Guest checkout: a logged-out shopper must verify their email first (the
  // gate); after that the form works as usual, card payment only.
  isGuest = computed(() => !this.authService.isLoggedIn());
  showGuestGate = computed(() => this.isGuest() && !this.guestSession.current());

  shippingName = this.authService.currentUser()?.name ?? this.guestSession.current()?.name ?? '';
  shippingEmail = this.authService.currentUser()?.email ?? this.guestSession.current()?.email ?? '';
  shippingAddress = '';
  city = '';
  state = '';
  postalCode = '';
  phone = '';
  // Pin from the map, if the customer used it; cleared whenever the address comes from elsewhere.
  latitude: number | null | undefined = null;
  longitude: number | null | undefined = null;

  // Step 1 (address) folds into a summary line once confirmed, opening step 2 (payment).
  addressConfirmed = signal(false);

  isSubmitting = signal(false);
  errorMessage = signal('');

  // Idempotency key for this checkout attempt. Reused while the order being
  // submitted is unchanged (a retry after a network error returns the order
  // already placed rather than a second one); a new key once anything in the
  // order changes or after it's placed.
  private idempotencyKey: string | null = null;
  private idempotencyKeyFor: string | null = null;

  private idempotencyKeyForOrder(contents: string): string {
    if (!this.idempotencyKey || this.idempotencyKeyFor !== contents) {
      this.idempotencyKey = crypto.randomUUID();
      this.idempotencyKeyFor = contents;
    }
    return this.idempotencyKey;
  }

  ngOnInit(): void {
    // The cart is a saved snapshot; show today's prices before the customer pays.
    const refresh$ = this.cartService.buyNowItem() ? this.cartService.refreshBuyNow() : this.cartService.refresh();
    refresh$.subscribe(notes => this.changeNotes.set(notes));
    // Guests have no address book.
    if (!this.isGuest()) {
      this.loadAddresses();
    }
    this.loadAvailableCoupons();
  }

  onGuestVerified(): void {
    const session = this.guestSession.current();
    this.shippingName = session?.name ?? this.shippingName;
    this.shippingEmail = session?.email ?? '';
  }

  // Back to the gate to verify another address.
  switchGuestEmail(): void {
    this.guestSession.clear();
    this.removeCoupon();
  }

  private loadAvailableCoupons(): void {
    this.couponService.getActiveCoupons().subscribe({
      next: coupons => {
        this.availableCoupons.set(coupons);
        this.isLoadingCoupons.set(false);
      },
      error: () => {
        // Checkout still works via manual code entry if this fails to load.
        this.isLoadingCoupons.set(false);
      }
    });
  }

  private loadAddresses(): void {
    this.isLoadingAddresses.set(true);

    this.addressService.getAddresses().subscribe({
      next: addresses => {
        this.savedAddresses.set(addresses);
        this.isLoadingAddresses.set(false);

        const defaultAddress = addresses.find(a => a.isDefault) ?? addresses[0];

        if (defaultAddress) {
          this.selectAddress(defaultAddress);
          // Returning shoppers start on payment with their default address confirmed.
          this.addressConfirmed.set(true);
        }
      },
      error: () => {
        // Checkout still works with manual entry if the address book fails to load.
        this.isLoadingAddresses.set(false);
      }
    });
  }

  addressLine1And2(address: Address): string {
    return address.addressLine2 ? `${address.addressLine1}, ${address.addressLine2}` : address.addressLine1;
  }

  selectAddress(address: Address): void {
    this.selectedAddressId.set(address.addressId);
    // A saved address brings its own pin (if it was picked on the map).
    this.latitude = address.latitude ?? null;
    this.longitude = address.longitude ?? null;
    this.shippingName = address.fullName;
    this.phone = address.phone;
    this.shippingAddress = address.addressLine2
      ? `${address.addressLine1}, ${address.addressLine2}`
      : address.addressLine1;
    this.city = address.city;
    this.state = address.state;
    this.postalCode = address.postalCode;
  }

  useNewAddress(): void {
    this.selectedAddressId.set(null);
    this.clearMapPin();
    this.shippingName = this.authService.currentUser()?.name ?? '';
    this.shippingAddress = '';
    this.city = '';
    this.state = '';
    this.postalCode = '';
    // The profile has no phone, so reuse the one from their saved address book.
    this.phone = (this.savedAddresses().find(a => a.isDefault) ?? this.savedAddresses()[0])?.phone ?? '';
  }

  private clearMapPin(): void {
    this.latitude = null;
    this.longitude = null;
  }

  itemImage(item: CartItem): string | null {
    return getPrimaryImageUrl(item.product);
  }

  itemSubtotal(item: CartItem): number {
    return item.product.price * item.quantity;
  }

  couponValueLabel(coupon: PublicCoupon): string {
    return coupon.discountType === 'Percentage'
      ? `${coupon.discountValue}% off`
      : `₹${coupon.discountValue} off`;
  }

  applyCoupon(): void {
    this.applyCouponCode(this.couponCodeInput);
  }

  selectCoupon(coupon: PublicCoupon): void {
    this.couponCodeInput = coupon.code;
    this.applyCouponCode(coupon.code);
  }

  private applyCouponCode(rawCode: string): void {
    const code = rawCode.trim();

    if (!code) {
      return;
    }

    this.isApplyingCoupon.set(true);
    this.couponMessage.set('');

    const orderAmount = this.total();
    this.couponService.validateCoupon({ code, orderAmount }).subscribe({
      next: result => {
        this.isApplyingCoupon.set(false);
        this.couponMessage.set(result.message);

        if (result.valid) {
          this.couponMessageType.set('success');
          this.appliedCouponCode.set(result.code ?? code);
          this.appliedDiscountAmount.set(result.discountAmount);
          this.couponValidatedForTotal = orderAmount;
        } else {
          this.couponValidatedForTotal = null;
          this.couponMessageType.set('error');
          this.appliedCouponCode.set(null);
          this.appliedDiscountAmount.set(0);
        }
      },
      error: error => {
        this.isApplyingCoupon.set(false);
        this.couponValidatedForTotal = null;
        this.couponMessageType.set('error');
        this.appliedCouponCode.set(null);
        this.appliedDiscountAmount.set(0);
        this.couponMessage.set(error.error?.message || 'Unable to validate this coupon.');
      }
    });
  }

  removeCoupon(): void {
    this.couponValidatedForTotal = null;
    this.appliedCouponCode.set(null);
    this.appliedDiscountAmount.set(0);
    this.couponCodeInput = '';
    this.couponMessage.set('');
  }

  // While step 2 is closed only the address controls are in the form, so its
  // validity is exactly "is the address complete".
  continueToPayment(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }
    this.addressConfirmed.set(true);
  }

  editAddress(): void {
    this.addressConfirmed.set(false);
    this.errorMessage.set('');
  }

  // Enter in an address field continues to payment rather than placing the order.
  onSubmit(form: NgForm): void {
    if (this.addressConfirmed()) {
      this.placeOrder();
    } else {
      this.continueToPayment(form);
    }
  }

  async placeOrder(): Promise<void> {
    const items = this.items();
    const paymentSelect = this.paymentSelect();

    // Guard against a second submit while the first is still awaiting payment details.
    if (this.isSubmitting() || items.length === 0 || !paymentSelect || this.stockProblems().length > 0) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    let payment: PaymentDetails;
    try {
      payment = await paymentSelect.getPaymentDetails();
    } catch (error: any) {
      this.isSubmitting.set(false);
      this.errorMessage.set(error?.message || 'Please check your payment details.');
      return;
    }

    const orderContents = {
      items: items.map(item => ({
        productId: item.product.productId,
        quantity: item.quantity
      })),
      shippingName: this.shippingName,
      shippingEmail: this.shippingEmail,
      shippingAddress: this.shippingAddress,
      city: this.city,
      state: this.state,
      postalCode: this.postalCode,
      phone: this.phone,
      latitude: this.latitude ?? undefined,
      longitude: this.longitude ?? undefined,
      couponCode: this.appliedCouponCode() || undefined,
      isGiftWrap: this.cartService.isGiftWrap(),
      giftRecipient: this.cartService.giftRecipient() || undefined,
      giftMessage: this.cartService.giftMessage() || undefined
    };
    // The payment nonce is single-use, so it's left out of "what's being ordered".
    const idempotencyKey = this.idempotencyKeyForOrder(
      JSON.stringify({ ...orderContents, paymentMethod: payment.paymentMethod })
    );

    this.orderService
      .createOrder({ ...payment, ...orderContents, idempotencyKey })
      .subscribe({
        next: order => {
          this.isSubmitting.set(false);
          this.idempotencyKey = null;

          // Clear gift wrap selections upon order completion
          this.cartService.clearGiftWrap();

          // Only clear the cart if this was a cart checkout, not a Buy Now.
          if (this.cartService.buyNowItem()) {
            this.cartService.clearBuyNowItem();
          } else {
            this.cartService.clearCart();
          }

          if (this.isGuest()) {
            // Guests have no My Orders page; show the confirmation from the response.
            this.router.navigate(['/order-placed'], { state: { order, email: this.shippingEmail } });
            return;
          }

          this.router.navigate(['/orders', order.orderId], {
            state: { justPlaced: true }
          });
        },
        error: error => {
          this.isSubmitting.set(false);
          if (payment.paymentMethod === 'Card') {
            paymentSelect.resetAfterFailure();
          }
          this.errorMessage.set(
            error.error?.message || 'Your order could not be placed. Please try again.'
          );
        }
      });
  }
}
