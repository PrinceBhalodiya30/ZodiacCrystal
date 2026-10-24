import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../services/order.service';
import { AdminOrder } from '../../models/order';
import { AdminNav } from '../admin-nav/admin-nav';
import { Spinner } from '../../components/spinner/spinner';
import { Pager } from '../../components/pager/pager';
import { ToastService } from '../../services/toast.service';
import { NotificationService } from '../../services/notification.service';
import { blobErrorMessage, downloadBlob } from '../../utils/download.util';
import { OrderDetailDrawer, OrderRowUpdate } from './order-detail-drawer/order-detail-drawer';
import { Customer360Drawer } from '../shared/customer-360-drawer/customer-360-drawer';
import { debounced } from '../../utils/debounce.util';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { InrPipe } from '../../pipes/inr.pipe';

const STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
const PAGE_SIZE = 20;
const NEW_ORDER_HIGHLIGHT_MS = 8000;

function validOrderId(value: string | null): number | null {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : null;
}

function validStatus(value: string | null): string {
  return value && STATUSES.includes(value) ? value : '';
}

const PAYMENT_FILTERS = ['Paid', 'Pending', 'Refunded', 'Cancelled', 'Card', 'COD'];

function validPayment(value: string | null): string {
  return value && PAYMENT_FILTERS.includes(value) ? value : '';
}

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [InrPipe, Spinner, DatePipe, FormsModule, AdminNav, Pager, OrderDetailDrawer, Customer360Drawer],
  templateUrl: './orders.html',
  styleUrls: ['../admin-shared.css', './orders.css']
})
export class AdminOrders implements OnInit {
  private orderService = inject(OrderService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  statuses = STATUSES;
  orders = signal<AdminOrder[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  // The order open in the detail drawer (also deep-linkable as ?order=123).
  openOrderId = signal<number | null>(validOrderId(inject(ActivatedRoute).snapshot.queryParamMap.get('order')));
  isExporting = signal(false);
  downloadingInvoiceId = signal<number | null>(null);

  // Bulk order selection & actions
  selectedIds = signal<Set<number>>(new Set());
  selectedCount = computed(() => this.selectedIds().size);
  pageAllSelected = computed(() => this.orders().length > 0 && this.orders().every(o => this.selectedIds().has(o.orderId)));
  bulkAction = signal<'Confirmed' | 'Shipped' | 'Cancelled'>('Confirmed');
  isBulkUpdating = signal(false);

  // Customer 360 intelligence drawer
  customer360Email = signal<string | null>(null);
  previousOrderForCustomer360 = signal<number | null>(null);

  page = signal(1);
  totalPages = signal(1);
  // Rows matching the current filters - shown on the Export button.
  totalCount = signal(0);
  searchTerm = signal('');
  // Deep-linkable (e.g. the dashboard's "orders to ship" card links to ?status=Confirmed).
  statusFilter = signal(validStatus(inject(ActivatedRoute).snapshot.queryParamMap.get('status')));
  // A payment status (Paid/Pending/Refunded/Cancelled) or method (Card/COD).
  // Deep-linkable too (the dashboard's Payments panel links to ?payment=COD).
  paymentFilter = signal(validPayment(inject(ActivatedRoute).snapshot.queryParamMap.get('payment')));
  hasFilters = computed(() => !!this.searchTerm().trim() || !!this.statusFilter() || !!this.paymentFilter());

  // Orders that just arrived live; their rows are highlighted for a few seconds.
  newOrderIds = signal<ReadonlySet<number>>(new Set());

  private markNew(orderId: number): void {
    this.newOrderIds.update(ids => new Set(ids).add(orderId));
    setTimeout(() => {
      this.newOrderIds.update(ids => {
        const next = new Set(ids);
        next.delete(orderId);
        return next;
      });
    }, NEW_ORDER_HIGHLIGHT_MS);
  }

  private loadSubscription?: Subscription;
  // Typing searches once the admin pauses, instead of on every keystroke.
  onSearchInput = debounced((term: string) => this.onSearchChange(term));

  constructor() {
    // A customer just placed an order (pushed over SignalR) - refresh the
    // current page/filters quietly so it appears without a reload.
    inject(NotificationService).adminOrderPlaced
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        this.markNew(event.orderId);
        this.loadOrders(true);
      });

    // A customer cancelled, or another admin changed an order.
    inject(NotificationService).adminDataChanged
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        if (event.kind === 'order') {
          this.loadOrders(true);
        }
      });
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  onSearchChange(term: string): void {
    this.onSearchInput.cancel();
    this.searchTerm.set(term);
    this.page.set(1);
    this.loadOrders();
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter.set(status);
    this.page.set(1);
    this.loadOrders();
  }

  onPaymentFilterChange(payment: string): void {
    this.paymentFilter.set(payment);
    this.page.set(1);
    this.loadOrders();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadOrders();
  }

  clearFilters(): void {
    this.onSearchInput.cancel();
    this.searchTerm.set('');
    this.statusFilter.set('');
    this.paymentFilter.set('');
    this.page.set(1);
    this.loadOrders();
  }

  // silent: refresh in place (live updates) without swapping in the spinner.
  loadOrders(silent = false): void {
    if (!silent) {
      this.isLoading.set(true);
    }
    this.errorMessage.set('');

    // A newer load (next page, new search) replaces any request still in flight.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.orderService
      .getAllOrdersAdminPaged(
        this.page(),
        PAGE_SIZE,
        this.searchTerm().trim() || undefined,
        this.statusFilter() || undefined,
        this.paymentFilter() || undefined
      )
      .subscribe({
        next: result => {
          // Removing the last row on the last page leaves it empty; step back a page.
          if (result.items.length === 0 && this.page() > 1) {
            this.page.set(Math.max(1, result.totalPages));
            this.loadOrders(silent);
            return;
          }
          this.orders.set(result.items);
          this.totalPages.set(result.totalPages || 1);
        this.totalCount.set(result.totalCount);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load orders.');
          this.isLoading.set(false);
        }
      });
  }

  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);

    this.orderService
      .exportOrdersCsv(
        this.searchTerm().trim() || undefined,
        this.statusFilter() || undefined,
        this.paymentFilter() || undefined
      )
      .subscribe({
        next: blob => {
          this.isExporting.set(false);
          downloadBlob(blob, 'orders-export.csv');
        },
        error: (err: unknown) => {
          this.isExporting.set(false);
          blobErrorMessage(err, 'Unable to export orders.').then(message => this.toast.error(message));
        }
      });
  }

  downloadInvoice(orderId: number, event: Event): void {
    event.stopPropagation();
    if (this.downloadingInvoiceId() !== null) {
      return;
    }

    this.downloadingInvoiceId.set(orderId);
    this.orderService.getInvoiceAdmin(orderId).subscribe({
      next: blob => {
        this.downloadingInvoiceId.set(null);
        downloadBlob(blob, `invoice-${orderId}.pdf`);
      },
      error: (err: unknown) => {
        this.downloadingInvoiceId.set(null);
        blobErrorMessage(err, `Unable to download the invoice for order #${orderId}.`).then(message => this.toast.error(message));
      }
    });
  }

  openOrder(order: AdminOrder): void {
    this.openOrderId.set(order.orderId);
  }

  closeOrder(): void {
    this.openOrderId.set(null);
  }

  openCustomer360(email: string, fromOrderId?: number): void {
    if (fromOrderId) {
      this.previousOrderForCustomer360.set(fromOrderId);
      this.openOrderId.set(null); // Cleanly close order drawer so overlays never stack!
    } else {
      this.previousOrderForCustomer360.set(null);
    }
    this.customer360Email.set(email);
  }

  closeCustomer360(): void {
    this.customer360Email.set(null);
    this.previousOrderForCustomer360.set(null);
  }

  returnToPreviousOrder(orderId: number): void {
    this.customer360Email.set(null);
    this.previousOrderForCustomer360.set(null);
    this.openOrderId.set(orderId);
  }

  // Keep the row in step with a status change made in the drawer.
  onOrderChanged(update: OrderRowUpdate): void {
    this.orders.update(orders =>
      orders.map(o =>
        o.orderId === update.orderId ? { ...o, status: update.status, paymentStatus: update.paymentStatus } : o
      )
    );
  }

  toggleSelectOrder(orderId: number): void {
    this.selectedIds.update(set => {
      const next = new Set(set);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  toggleSelectAllPage(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.update(set => {
      const next = new Set(set);
      if (checked) {
        this.orders().forEach(o => next.add(o.orderId));
      } else {
        this.orders().forEach(o => next.delete(o.orderId));
      }
      return next;
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  async applyBulkAction(): Promise<void> {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0 || this.isBulkUpdating()) return;

    const action = this.bulkAction();
    if (action === 'Cancelled') {
      const ok = await this.confirmDialog.confirm(
        `Are you sure you want to cancel ${ids.length} selected order(s)? This will mark them as Cancelled.`,
        { confirmLabel: 'Cancel Orders', cancelLabel: 'Keep Orders', danger: true }
      );
      if (!ok) return;
    }

    this.isBulkUpdating.set(true);
    let successCount = 0;
    let skippedCount = 0;

    for (const id of ids) {
      try {
        await firstValueFrom(this.orderService.updateOrderStatus(id, action));
        successCount++;
      } catch {
        skippedCount++;
      }
    }

    this.isBulkUpdating.set(false);
    this.clearSelection();
    this.loadOrders();

    if (successCount > 0 && skippedCount === 0) {
      this.toast.success(`Updated ${successCount} order(s) to ${action}.`);
    } else if (successCount > 0 && skippedCount > 0) {
      this.toast.success(`Updated ${successCount} order(s) to ${action} (${skippedCount} skipped due to status rules).`);
    } else if (skippedCount > 0) {
      this.toast.error(`Could not update ${skippedCount} order(s) due to status rules.`);
    }
  }
}
