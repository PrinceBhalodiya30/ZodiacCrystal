import { AuthService } from '../../services/auth.service';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { NotificationService } from '../../services/notification.service';
import { OrderService } from '../../services/order.service';
import { CANCELLATION_REASONS, Order } from '../../models/order';
import { Spinner } from '../../components/spinner/spinner';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { blobErrorMessage, downloadBlob } from '../../utils/download.util';
import { ReturnRequestPanel } from '../../components/return-request-panel/return-request-panel';

const STATUS_STEPS = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];

const STATUS_LABELS: Record<string, string> = {
  Pending: 'Placed',
  Confirmed: 'Confirmed',
  Shipped: 'Shipped',
  Delivered: 'Delivered'
};

interface StatusStep {
  label: string;
  state: 'completed' | 'current' | 'upcoming';
}

import { InrPipe } from '../../pipes/inr.pipe';
@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [InrPipe, Breadcrumbs, Spinner, RouterLink, DatePipe, ReturnRequestPanel],
  templateUrl: './order-details.html',
  styleUrl: './order-details.css'
})
export class OrderDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private router = inject(Router);

  // Opened from a guest's emailed order link (/order/:id): no My Account
  // breadcrumbs or links, and returns aren't available to guests yet.
  readonly isGuestView = !inject(AuthService).isLoggedIn();
  readonly orderBase = this.isGuestView ? '/order' : '/orders';

  order = signal<Order | null>(null);
  isLoading = signal(true);
  errorMessage = signal('');
  actionError = signal('');
  isCancelling = signal(false);
  isDownloadingInvoice = signal(false);
  isBuyingAgain = signal(false);

  // Only true immediately after Checkout navigates here with { state: { justPlaced: true } }
  // - not on a normal visit or a page refresh, since history.state won't carry it then.
  justPlaced = !!history.state?.['justPlaced'];

  isCancelled = computed(() => this.order()?.status === 'Cancelled');

  // The "Order placed" banner hides after 8s (or via its close button)
  // and never shows on a cancelled order.
  private bannerVisible = signal(this.justPlaced);
  showConfirmation = computed(() => this.bannerVisible() && !this.isCancelled());
  private bannerTimer = this.justPlaced ? setTimeout(() => this.dismissConfirmation(), 8000) : undefined;

  dismissConfirmation(): void {
    clearTimeout(this.bannerTimer);
    this.bannerVisible.set(false);
  }

  // A mystery box order is a normal Order with this sentinel CouponCode
  // (see MysteryBoxController) rather than a real, redeemable coupon.
  isMysteryBox = computed(() => this.order()?.couponCode === 'MYSTERY-BOX');

  couponDiscountAmount = computed(() => this.order()?.discountAmount ?? 0);

  statusSteps = computed<StatusStep[]>(() => {
    const status = this.order()?.status;
    const currentIndex = STATUS_STEPS.indexOf(status ?? '');

    return STATUS_STEPS.map((status, index) => ({
      label: STATUS_LABELS[status],
      state: index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming'
    }));
  });

  constructor() {
    // An admin changed this order (status or return) - refresh quietly.
    inject(NotificationService).orderUpdated
      .pipe(takeUntilDestroyed())
      .subscribe(orderId => {
        if (orderId === this.order()?.orderId) {
          this.loadOrder(true);
        }
      });
  }

  ngOnInit(): void {
    this.loadOrder();
  }

  // silent: refresh in place (live updates) without swapping in the spinner.
  loadOrder(silent = false): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!silent) {
      this.isLoading.set(true);
    }
    this.errorMessage.set('');

    this.orderService.getOrder(id).subscribe({
      next: order => {
        this.order.set(order);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Order not found.');
        this.isLoading.set(false);
      }
    });
  }

  downloadInvoice(): void {
    const order = this.order();

    if (!order || this.isDownloadingInvoice()) {
      return;
    }

    this.isDownloadingInvoice.set(true);

    this.orderService.getInvoice(order.orderId).subscribe({
      next: blob => {
        this.isDownloadingInvoice.set(false);
        downloadBlob(blob, `invoice-${order.orderId}.pdf`);
      },
      error: (err: unknown) => {
        this.isDownloadingInvoice.set(false);
        blobErrorMessage(err, 'Unable to download the invoice. Please try again.').then(message => this.toast.error(message));
      }
    });
  }

  // Adds this order's items back to the cart at today's price and stock, skipping
  // anything no longer for sale, then opens the cart.
  buyAgain(): void {
    const order = this.order();

    if (!order || this.isBuyingAgain()) {
      return;
    }

    this.isBuyingAgain.set(true);

    forkJoin(order.items.map(item =>
      this.productService.getProduct(item.productId).pipe(catchError(() => of(null)))
    )).subscribe(products => {
      this.isBuyingAgain.set(false);

      let added = 0;
      products.forEach((product, index) => {
        if (product && product.isActive && product.stockQuantity > 0) {
          this.cartService.addToCart(product, order.items[index].quantity);
          added++;
        }
      });

      const skipped = order.items.length - added;

      if (added === 0) {
        this.toast.error('These items are no longer available.');
        return;
      }

      this.toast.success(
        skipped > 0
          ? `Added ${added} item${added === 1 ? '' : 's'} to your cart. ${skipped} ${skipped === 1 ? 'is' : 'are'} no longer available.`
          : 'Items added to your cart.'
      );
      this.router.navigate(['/cart']);
    });
  }

  canCancel(): boolean {
    const status = this.order()?.status;
    return status === 'Pending' || status === 'Confirmed';
  }

  paymentLabel(order: Order): string {
    if (order.paymentMethod === 'Card') {
      switch (order.paymentStatus) {
        case 'Paid': return 'Paid by card';
        case 'Refunded': return 'Card payment refunded';
        default: return 'Card payment pending';
      }
    }

    switch (order.paymentStatus) {
      case 'Paid': return 'Cash on Delivery · Paid';
      case 'Cancelled': return 'Cash on Delivery · Cancelled';
      case 'Refunded': return 'Cash on Delivery · Refunded';
      default: return 'Cash on Delivery · Pay when delivered';
    }
  }

  async cancelOrder(): Promise<void> {
    const order = this.order();

    if (!order) {
      return;
    }

    const reason = await this.confirmDialog.chooseReason(`Cancel order #${order.orderId}?`, CANCELLATION_REASONS, {
      confirmLabel: 'Cancel Order',
      cancelLabel: 'Keep Order',
      danger: true
    });

    if (!reason) {
      return;
    }

    this.isCancelling.set(true);
    this.actionError.set('');

    this.orderService.cancelOrder(order.orderId, reason).subscribe({
      next: () => {
        this.isCancelling.set(false);
        const wasPaid = order.paymentStatus === 'Paid';
        this.order.set({
          ...order,
          status: 'Cancelled',
          cancellationReason: reason,
          estimatedDeliveryFrom: null,
          estimatedDeliveryTo: null,
          paymentStatus: wasPaid ? 'Refunded' : order.paymentStatus === 'Pending' ? 'Cancelled' : order.paymentStatus
        });
        this.toast.success(
          wasPaid
            ? `Order #${order.orderId} cancelled. Your card payment has been refunded.`
            : `Order #${order.orderId} cancelled.`
        );
      },
      error: error => {
        this.isCancelling.set(false);
        const message = error.error?.message || 'Unable to cancel this order.';
        this.actionError.set(message);
        this.toast.error(message);
      }
    });
  }
}
