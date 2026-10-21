import { Component, DestroyRef, ElementRef, computed, effect, inject, input, model, signal, untracked, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Dropin } from 'braintree-web-drop-in';
import { PaymentService } from '../../services/payment.service';
import { PaymentDetails, PaymentMethod } from '../../models/order';
import { SITE_NAME } from '../../services/page-title.service';

type CardFormStatus = 'idle' | 'loading' | 'ready' | 'error';

// "Pay online (card)" vs "Cash on Delivery" picker. For card, it renders the
// Braintree Drop-in UI, which collects card details in Braintree-hosted
// fields and hands back a one-time nonce - raw card numbers never touch our
// app or API. The parent page calls getPaymentDetails() when submitting.
@Component({
  selector: 'app-payment-method-select',
  standalone: true,
  templateUrl: './payment-method-select.html',
  styleUrl: './payment-method-select.css'
})
export class PaymentMethodSelect {
  readonly siteName = SITE_NAME;
  private paymentService = inject(PaymentService);

  method = model<PaymentMethod>('COD');
  // Pages that already show their own "Payment" heading hide the legend
  // visually; it stays for screen readers so the radio group keeps its name.
  hideLegend = input(false);
  // Guest checkout: card payment only (Cash on Delivery is hidden).
  cardOnly = input(false);
  private forceCard = effect(() => {
    if (this.cardOnly() && untracked(() => this.method()) !== 'Card') {
      this.method.set('Card');
    }
  });

  status = signal<CardFormStatus>('idle');
  loadError = signal('');

  // The parent's submit button should stay disabled until this is true.
  canSubmit = computed(() => this.method() === 'COD' || this.status() === 'ready');

  private container = viewChild<ElementRef<HTMLDivElement>>('dropinContainer');
  private dropin: Dropin | null = null;

  constructor() {
    // The Drop-in container only exists while "Pay online" is selected, so
    // start loading the card form as soon as it appears.
    effect(() => {
      const container = this.container();
      if (this.method() === 'Card' && container && untracked(() => this.status()) === 'idle') {
        untracked(() => this.loadCardForm(container.nativeElement));
      }
    });

    inject(DestroyRef).onDestroy(() => this.teardown());
  }

  selectMethod(method: PaymentMethod): void {
    if (method === this.method()) {
      return;
    }

    if (method === 'COD') {
      this.teardown();
    }

    this.method.set(method);
  }

  retryLoad(): void {
    const container = this.container();
    if (container) {
      this.loadCardForm(container.nativeElement);
    }
  }

  // Throws with a customer-friendly message if the card form is incomplete.
  async getPaymentDetails(): Promise<PaymentDetails> {
    if (this.method() === 'COD') {
      return { paymentMethod: 'COD' };
    }

    if (!this.dropin) {
      throw new Error('The card form is still loading. Please wait a moment.');
    }

    try {
      const payload = await this.dropin.requestPaymentMethod();
      return { paymentMethod: 'Card', paymentNonce: payload.nonce, deviceData: payload.deviceData };
    } catch {
      throw new Error('Please check your card details.');
    }
  }

  // A nonce can only be used once - after a declined payment the customer
  // must re-enter (or re-confirm) their card to get a fresh one.
  resetAfterFailure(): void {
    this.dropin?.clearSelectedPaymentMethod();
  }

  private async loadCardForm(container: HTMLDivElement): Promise<void> {
    this.status.set('loading');
    this.loadError.set('');

    try {
      const { clientToken } = await firstValueFrom(this.paymentService.getClientToken());
      const dropinModule: any = await import('braintree-web-drop-in');
      const create = dropinModule.create ?? dropinModule.default?.create;

      // The customer may have switched back to COD while this was loading.
      if (this.method() !== 'Card' || !container.isConnected) {
        this.status.set('idle');
        return;
      }

      this.dropin = await create({
        authorization: clientToken,
        container,
        card: { cardholderName: { required: true } }
      });

      this.status.set('ready');
    } catch (error: any) {
      this.status.set('error');
      this.loadError.set(
        error?.error?.message || 'The secure card form could not be loaded. Please try again or choose Cash on Delivery.'
      );
    }
  }

  private teardown(): void {
    const dropin = this.dropin;
    this.dropin = null;
    this.status.set('idle');
    dropin?.teardown().catch(() => {
      // Nothing to clean up if the Drop-in was already gone.
    });
  }
}
