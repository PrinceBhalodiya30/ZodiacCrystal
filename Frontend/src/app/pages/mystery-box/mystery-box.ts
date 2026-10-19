import { Component, ElementRef, Injector, OnDestroy, OnInit, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { MysteryBoxService } from '../../services/mystery-box.service';
import { AuthService } from '../../services/auth.service';
import { AddressService } from '../../services/address.service';
import { CheckoutModeService } from '../../services/checkout-mode.service';
import { Spinner } from '../../components/spinner/spinner';
import { PhoneInput } from '../../components/phone-input/phone-input';
import { PaymentMethodSelect } from '../../components/payment-method-select/payment-method-select';
import { MysteryBoxInfo } from '../../models/mystery-box';
import { PaymentDetails, PaymentMethod } from '../../models/order';
import { Address } from '../../models/address';
import { MapAddressFields } from '../../components/map-address-fields/map-address-fields';
import { scrollBehavior } from '../../utils/motion.util';

import { InrPipe } from '../../pipes/inr.pipe';
@Component({
  selector: 'app-mystery-box',
  standalone: true,
  imports: [InrPipe, FormsModule, Spinner, PhoneInput, PaymentMethodSelect, MapAddressFields],
  templateUrl: './mystery-box.html',
  styleUrl: './mystery-box.css'
})
export class MysteryBox implements OnInit, OnDestroy {
  private mysteryBoxService = inject(MysteryBoxService);
  private authService = inject(AuthService);
  private addressService = inject(AddressService);
  private router = inject(Router);
  private injector = inject(Injector);
  private checkoutMode = inject(CheckoutModeService);
  private shippingFormRef = viewChild<ElementRef<HTMLFormElement>>('shippingForm');

  paymentMethod = signal<PaymentMethod>('COD');
  paymentSelect = viewChild(PaymentMethodSelect);

  info = signal<MysteryBoxInfo | null>(null);
  isLoadingInfo = signal(true);
  infoError = signal('');

  isPurchasing = signal(false);
  purchaseError = signal('');

  // Idempotency key for this purchase attempt - same approach as Checkout:
  // reused while the request is unchanged, replaced once it changes or succeeds.
  private idempotencyKey: string | null = null;
  private idempotencyKeyFor: string | null = null;

  private idempotencyKeyForOrder(contents: string): string {
    if (!this.idempotencyKey || this.idempotencyKeyFor !== contents) {
      this.idempotencyKey = crypto.randomUUID();
      this.idempotencyKeyFor = contents;
    }
    return this.idempotencyKey;
  }

  // Only shown once the customer clicks "Get Mystery Box" and is logged in -
  // keeps the promo card itself uncluttered for a visitor just browsing.
  showShippingForm = signal(false);
  // Step 1 (address) folds into a summary line once confirmed, opening step 2 (payment).
  addressConfirmed = signal(false);

  savedAddresses = signal<Address[]>([]);
  selectedAddressId = signal<number | null>(null);

  shippingName = this.authService.currentUser()?.name ?? '';
  shippingEmail = this.authService.currentUser()?.email ?? '';
  shippingAddress = '';
  city = '';
  state = '';
  postalCode = '';
  phone = '';
  // Pin from the map, if the customer used it; cleared whenever the address comes from elsewhere.
  latitude: number | null | undefined = null;
  longitude: number | null | undefined = null;

  ngOnInit(): void {
    this.loadInfo();
  }

  // "Back" closes the inline checkout and returns to the promo card, with the
  // normal navbar - the same exit normal checkout offers via "Back to cart".
  cancelPurchase(): void {
    this.showShippingForm.set(false);
    this.addressConfirmed.set(false);
    this.purchaseError.set('');
    this.checkoutMode.active.set(false);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  // Leaving the page (or placing the order) restores the normal navbar.
  ngOnDestroy(): void {
    this.checkoutMode.active.set(false);
  }

  private loadInfo(): void {
    this.isLoadingInfo.set(true);
    this.infoError.set('');

    this.mysteryBoxService.getInfo().subscribe({
      next: info => {
        this.info.set(info);
        this.isLoadingInfo.set(false);
      },
      error: () => {
        this.infoError.set('Unable to load the Mystery Crystal Box right now.');
        this.isLoadingInfo.set(false);
      }
    });
  }

  startPurchase(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/mystery-box' } });
      return;
    }

    this.showShippingForm.set(true);
    // Address + payment happen right here, so switch to the "Secure checkout" header.
    this.checkoutMode.active.set(true);
    this.loadAddresses();

    // The form opens below the promo card, often off-screen on phones.
    afterNextRender(
      () => this.shippingFormRef()?.nativeElement.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }),
      { injector: this.injector }
    );
  }

  private loadAddresses(): void {
    this.addressService.getAddresses().subscribe({
      next: addresses => {
        this.savedAddresses.set(addresses);
        const defaultAddress = addresses.find(a => a.isDefault) ?? addresses[0];

        if (defaultAddress) {
          this.selectAddress(defaultAddress);
          // Returning shoppers start on payment with their default address confirmed.
          this.addressConfirmed.set(true);
        }
      },
      error: () => {
        // Manual entry still works if the address book fails to load.
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
    this.shippingAddress = this.addressLine1And2(address);
    this.city = address.city;
    this.state = address.state;
    this.postalCode = address.postalCode;
  }

  private clearMapPin(): void {
    this.latitude = null;
    this.longitude = null;
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
    this.purchaseError.set('');
  }

  // Enter in an address field continues to payment rather than placing the order.
  onSubmit(form: NgForm): void {
    if (this.addressConfirmed()) {
      this.confirmPurchase();
    } else {
      this.continueToPayment(form);
    }
  }

  async confirmPurchase(): Promise<void> {
    const paymentSelect = this.paymentSelect();

    // Guard against a second submit while the first is still in progress.
    if (!paymentSelect || this.isPurchasing()) {
      return;
    }

    this.isPurchasing.set(true);
    this.purchaseError.set('');

    let payment: PaymentDetails;
    try {
      payment = await paymentSelect.getPaymentDetails();
    } catch (error: any) {
      this.isPurchasing.set(false);
      this.purchaseError.set(error?.message || 'Please check your payment details.');
      return;
    }

    const shipping = {
      shippingName: this.shippingName,
      shippingEmail: this.shippingEmail,
      shippingAddress: this.shippingAddress,
      city: this.city,
      state: this.state,
      postalCode: this.postalCode,
      phone: this.phone,
      latitude: this.latitude ?? undefined,
      longitude: this.longitude ?? undefined
    };
    // The payment nonce is single-use, so it's left out of "what's being ordered".
    const idempotencyKey = this.idempotencyKeyForOrder(
      JSON.stringify({ ...shipping, paymentMethod: payment.paymentMethod })
    );

    this.mysteryBoxService
      .purchase({ ...payment, ...shipping, idempotencyKey })
      .subscribe({
        next: order => {
          this.isPurchasing.set(false);
          this.idempotencyKey = null;
          this.router.navigate(['/orders', order.orderId], { state: { justPlaced: true } });
        },
        error: error => {
          this.isPurchasing.set(false);
          if (payment.paymentMethod === 'Card') {
            paymentSelect.resetAfterFailure();
          }
          this.purchaseError.set(
            error.error?.message || 'Your Mystery Crystal Box could not be created. Please try again.'
          );
        }
      });
  }
}
