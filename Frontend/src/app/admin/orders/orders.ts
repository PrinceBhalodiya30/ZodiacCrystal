import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
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
import { debounced } from '../../utils/debounce.util';
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
  imports: [InrPipe, Spinner, DatePipe, FormsModule, AdminNav, Pager, OrderDetailDrawer],
  templateUrl: './orders.html',
  styleUrls: ['../admin-shared.css', './orders.css']
})
export class AdminOrders implements OnInit {
  private orderService = inject(OrderService);
  private toast = inject(ToastService);

  statuses = STATUSES;
  orders = signal<AdminOrder[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  // The order open in the detail drawer (also deep-linkable as ?order=123).
  openOrderId = signal<number | null>(validOrderId(inject(ActivatedRoute).snapshot.queryParamMap.get('order')));
  isExporting = signal(false);

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

  openOrder(order: AdminOrder): void {
    this.openOrderId.set(order.orderId);
  }

  closeOrder(): void {
    this.openOrderId.set(null);
  }

  // Keep the row in step with a status change made in the drawer.
  onOrderChanged(update: OrderRowUpdate): void {
    this.orders.update(orders =>
      orders.map(o =>
        o.orderId === update.orderId ? { ...o, status: update.status, paymentStatus: update.paymentStatus } : o
      )
    );
  }
}
