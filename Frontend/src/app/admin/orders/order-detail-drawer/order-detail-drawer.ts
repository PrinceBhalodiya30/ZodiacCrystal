import { Component, EventEmitter, HostListener, Input, OnInit, Output, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OrderService } from '../../../services/order.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { ToastService } from '../../../services/toast.service';
import { AdminOrderDetail, PaymentStatus } from '../../../models/order';
import { blobErrorMessage, downloadBlob } from '../../../utils/download.util';
import { InrPipe, formatInr } from '../../../pipes/inr.pipe';
import { LocationMap } from '../../../components/location-map/location-map';

export interface OrderRowUpdate {
  orderId: number;
  status: string;
  paymentStatus: PaymentStatus;
}

const STATUS_ACTION_LABELS: Record<string, string> = {
  Confirmed: 'Confirm Order',
  Shipped: 'Mark as Shipped',
  Delivered: 'Mark as Delivered',
  Cancelled: 'Cancel Order'
};

// Demo couriers for the "Mark as Shipped" form - nothing is sent to them.
const COURIERS = ['Delhivery', 'Blue Dart', 'DTDC', 'Ekart', 'India Post', 'Xpressbees'];

// Side drawer with everything about one order - items, customer, shipping,
// payment, a timeline - and the only place its status can be changed, so a
// stray click in the orders table can't cancel or refund anything.
import { AdminNavCountsService } from '../../admin-nav/admin-nav-counts.service';
@Component({
  selector: 'app-order-detail-drawer',
  standalone: true,
  imports: [InrPipe, DatePipe, FormsModule, LocationMap],
  templateUrl: './order-detail-drawer.html',
  styleUrls: ['../../admin-shared.css', './order-detail-drawer.css']
})
export class OrderDetailDrawer implements OnInit {
  private orderService = inject(OrderService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);
  private navCounts = inject(AdminNavCountsService);

  @Input({ required: true }) orderId!: number;
  @Output() closed = new EventEmitter<void>();
  // Tells the table to update its row after a status change.
  @Output() orderChanged = new EventEmitter<OrderRowUpdate>();

  detail = signal<AdminOrderDetail | null>(null);
  isLoading = signal(true);
  errorMessage = signal('');
  updatingTo = signal<string | null>(null);
  isDownloadingInvoice = signal(false);
  private isConfirming = false;

  readonly couriers = COURIERS;
  // "Mark as Shipped" opens a small form for the courier and tracking number.
  isShipFormOpen = signal(false);
  // Delivery pin shown inline in the drawer instead of a new tab.
  isMapOpen = signal(false);
  shipCourier = COURIERS[0];
  shipTrackingNumber = '';

  ngOnInit(): void {
    this.load();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    // Don't close underneath an open confirmation or a save in progress.
    if (this.isShipFormOpen() && !this.updatingTo()) {
      this.isShipFormOpen.set(false);
    } else if (!this.isConfirming && !this.updatingTo()) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  load(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.orderService.getOrderAdmin(this.orderId).subscribe({
      next: detail => {
        this.detail.set(detail);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set(`Unable to load order #${this.orderId}.`);
        this.isLoading.set(false);
      }
    });
  }

  actionLabel(status: string): string {
    return STATUS_ACTION_LABELS[status] ?? `Mark as ${status}`;
  }

  get forwardStatuses(): string[] {
    return this.detail()?.allowedNextStatuses.filter(s => s !== 'Cancelled') ?? [];
  }

  get canCancel(): boolean {
    return this.detail()?.allowedNextStatuses.includes('Cancelled') ?? false;
  }

  get subtotal(): number {
    return this.detail()?.order.items.reduce((sum, item) => sum + item.subtotal, 0) ?? 0;
  }

  async changeStatus(status: string): Promise<void> {
    const detail = this.detail();
    if (!detail || this.updatingTo()) {
      return;
    }

    if (status === 'Shipped' && !this.isShipFormOpen()) {
      this.shipCourier = COURIERS[0];
      this.shipTrackingNumber = '';
      this.isShipFormOpen.set(true);
      return;
    }

    const order = detail.order;
    const total = formatInr(order.totalAmount);
    const refundsCard = order.paymentMethod === 'Card' && order.paymentStatus === 'Paid';

    // Cancelling and delivering are final, so both ask first.
    const confirmed = await this.confirmFinalStep(status, order.orderId, total, refundsCard,
      order.paymentMethod === 'COD' && order.paymentStatus === 'Pending');
    if (!confirmed) {
      return;
    }

    this.updatingTo.set(status);

    const shipment = status === 'Shipped'
      ? { courierName: this.shipCourier, trackingNumber: this.shipTrackingNumber.trim() || undefined }
      : undefined;

    this.orderService.updateOrderStatus(order.orderId, status, shipment).subscribe({
      next: () => {
        this.isShipFormOpen.set(false);
        this.navCounts.refresh();
        this.toast.success(
          status === 'Cancelled' && refundsCard
            ? `Order #${order.orderId} cancelled and the card payment refunded.`
            : `Order #${order.orderId} marked as ${status}.`
        );
        // Reload so the payment status, timeline and next actions come from the server.
        this.orderService.getOrderAdmin(order.orderId).subscribe({
          next: updated => {
            this.updatingTo.set(null);
            this.detail.set(updated);
            this.orderChanged.emit({
              orderId: updated.order.orderId,
              status: updated.order.status,
              paymentStatus: updated.order.paymentStatus
            });
          },
          error: () => {
            this.updatingTo.set(null);
            this.orderChanged.emit({ orderId: order.orderId, status, paymentStatus: order.paymentStatus });
            this.load();
          }
        });
      },
      error: (error: HttpErrorResponse) => {
        this.updatingTo.set(null);
        this.toast.error(error.error?.message || `Unable to update order #${order.orderId}'s status.`);
      }
    });
  }

  private async confirmFinalStep(
    status: string,
    orderId: number,
    total: string,
    refundsCard: boolean,
    collectsCash: boolean
  ): Promise<boolean> {
    if (status !== 'Cancelled' && status !== 'Delivered') {
      return true;
    }

    this.isConfirming = true;
    try {
      if (status === 'Cancelled') {
        return await this.confirmDialog.confirm(
          refundsCard
            ? `Cancel order #${orderId}? The customer's card will be refunded ${total}. This can't be undone.`
            : `Cancel order #${orderId}? This can't be undone.`,
          { confirmLabel: 'Cancel Order', cancelLabel: 'Keep Order', danger: true }
        );
      }

      return await this.confirmDialog.confirm(
        collectsCash
          ? `Mark order #${orderId} as delivered? The ${total} cash payment will be recorded as collected.`
          : `Mark order #${orderId} as delivered?`,
        { confirmLabel: 'Mark as Delivered' }
      );
    } finally {
      this.isConfirming = false;
    }
  }

  downloadInvoice(): void {
    if (this.isDownloadingInvoice()) {
      return;
    }

    this.isDownloadingInvoice.set(true);

    this.orderService.getInvoiceAdmin(this.orderId).subscribe({
      next: blob => {
        this.isDownloadingInvoice.set(false);
        downloadBlob(blob, `invoice-${this.orderId}.pdf`);
      },
      error: (err: unknown) => {
        this.isDownloadingInvoice.set(false);
        blobErrorMessage(err, `Unable to download the invoice for order #${this.orderId}.`).then(message => this.toast.error(message));
      }
    });
  }
}
