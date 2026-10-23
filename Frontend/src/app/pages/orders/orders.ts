import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { CANCELLATION_REASONS, OrderSummary, OrderSummaryItem } from '../../models/order';
import { getProductSlug } from '../../utils/product-slug.util';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { NotificationService } from '../../services/notification.service';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

import { InrPipe } from '../../pipes/inr.pipe';
@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [InrPipe, RouterLink, DatePipe, ImgFallbackDirective],
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class Orders implements OnInit {
  private orderService = inject(OrderService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  orders = signal<OrderSummary[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  actionError = signal('');
  cancellingOrderId = signal<number | null>(null);

  constructor() {
    // An admin changed one of these orders (status or return) - refresh quietly.
    inject(NotificationService).orderUpdated
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.loadOrders(true));
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  // silent: refresh in place (live updates) without swapping in the spinner.
  loadOrders(silent = false): void {
    if (!silent) {
      this.isLoading.set(true);
    }
    this.errorMessage.set('');

    this.orderService.getMyOrders().subscribe({
      next: orders => {
        this.orders.set(orders);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load your orders.');
        this.isLoading.set(false);
      }
    });
  }

  orderItems(order: OrderSummary): OrderSummaryItem[] {
    return order.items ?? [];
  }

  itemSlug(item: OrderSummaryItem): string {
    return getProductSlug({ productId: item.productId, name: item.productName });
  }

  // Like the big stores: first few products listed, the rest behind "+N more".
  readonly maxItems = 3;
  private expandedOrders = signal<ReadonlySet<number>>(new Set());

  isExpanded(orderId: number): boolean {
    return this.expandedOrders().has(orderId);
  }

  toggleItems(orderId: number): void {
    this.expandedOrders.update(ids => {
      const next = new Set(ids);
      if (!next.delete(orderId)) {
        next.add(orderId);
      }
      return next;
    });
  }

  visibleItems(order: OrderSummary): OrderSummaryItem[] {
    const items = this.orderItems(order);
    return this.isExpanded(order.orderId) ? items : items.slice(0, this.maxItems);
  }

  hiddenCount(order: OrderSummary): number {
    return this.isExpanded(order.orderId) ? 0 : Math.max(0, this.orderItems(order).length - this.maxItems);
  }

  statusTitle(order: OrderSummary): string {
    switch (order.status) {
      case 'Delivered': return order.deliveredAt ? `Delivered on ${this.formatDate(order.deliveredAt)}` : 'Delivered';
      case 'Shipped': return 'Shipped';
      case 'Cancelled': return 'Cancelled';
      case 'Confirmed': return 'Confirmed';
      default: return 'Order placed';
    }
  }

  statusSubtitle(order: OrderSummary): string {
    switch (order.status) {
      case 'Delivered': return 'Your item has been delivered';
      case 'Shipped': return order.shippedAt ? `Shipped on ${this.formatDate(order.shippedAt)} · on its way` : 'Your item is on its way';
      case 'Cancelled': return order.paymentStatus === 'Refunded' ? 'Refund issued to your card' : 'This order was cancelled';
      case 'Confirmed': return 'Preparing to ship';
      default: return 'Awaiting confirmation';
    }
  }

  private formatDate(value: string): string {
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  statusTone(order: OrderSummary): string {
    switch (order.status) {
      case 'Delivered': return 'delivered';
      case 'Cancelled': return 'cancelled';
      case 'Shipped': return 'shipped';
      default: return 'pending';
    }
  }

  canCancel(order: OrderSummary): boolean {
    return order.status === 'Pending' || order.status === 'Confirmed';
  }

  async cancelOrder(order: OrderSummary): Promise<void> {
    const reason = await this.confirmDialog.chooseReason(`Cancel order #${order.orderId}?`, CANCELLATION_REASONS, {
      confirmLabel: 'Cancel Order',
      cancelLabel: 'Keep Order',
      danger: true
    });

    if (!reason) {
      return;
    }

    this.cancellingOrderId.set(order.orderId);
    this.actionError.set('');

    this.orderService.cancelOrder(order.orderId, reason).subscribe({
      next: () => {
        this.cancellingOrderId.set(null);
        const wasPaid = order.paymentStatus === 'Paid';
        this.orders.update(items =>
          items.map(o => (o.orderId === order.orderId
            ? {
                ...o,
                status: 'Cancelled',
                paymentStatus: wasPaid ? 'Refunded' : o.paymentStatus === 'Pending' ? 'Cancelled' : o.paymentStatus
              }
            : o))
        );
        this.toast.success(
          wasPaid
            ? `Order #${order.orderId} cancelled. Your card payment has been refunded.`
            : `Order #${order.orderId} cancelled.`
        );
        // Pick up the server's final state (refund status etc.) without a spinner.
        this.loadOrders(true);
      },
      error: error => {
        this.cancellingOrderId.set(null);
        const message = error.error?.message || 'Unable to cancel this order.';
        this.actionError.set(message);
        this.toast.error(message);
      }
    });
  }
}
