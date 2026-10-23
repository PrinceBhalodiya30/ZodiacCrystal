import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { getStockStatus, getStockLabel } from '../../utils/stock-status.util';
import { AdminNav } from '../admin-nav/admin-nav';
import { Spinner } from '../../components/spinner/spinner';
import { Pager } from '../../components/pager/pager';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { blobErrorMessage, downloadBlob } from '../../utils/download.util';
import { debounced } from '../../utils/debounce.util';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../services/notification.service';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-stock',
  standalone: true,
  imports: [Spinner, FormsModule, AdminNav, Pager],
  templateUrl: './stock.html',
  styleUrls: ['../admin-shared.css', './stock.css']
})
export class AdminStock implements OnInit {
  private productService = inject(ProductService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  products = signal<Product[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  page = signal(1);
  totalPages = signal(1);
  // Rows matching the current filters - shown on the Export button.
  totalCount = signal(0);
  searchTerm = signal('');
  isExporting = signal(false);
  // Opened with ?lowStock=1 from a low-stock notification.
  lowStockOnly = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('lowStock') === '1');

  // Multi-select & Bulk toolbar state
  selectedIds = signal<Set<number>>(new Set());
  selectedCount = computed(() => this.selectedIds().size);
  pageAllSelected = computed(() => {
    const items = this.products();
    return items.length > 0 && items.every(p => this.selectedIds().has(p.productId));
  });

  bulkAction = signal<'add' | 'subtract' | 'set' | 'outOfStock'>('add');
  bulkQuantity = signal<number | null>(10);
  isBulkUpdating = signal(false);
  isSavingAll = signal(false);

  // productId -> pending edited stock value (kept separate from the loaded
  // product so the Save button only appears once the value actually changes).
  stockEdits: Record<number, number | null> = {};
  savingProductId = signal<number | null>(null);
  rowErrors: Record<number, string> = {};

  changedCount = computed(() => {
    return this.products().filter(p => this.hasChanged(p)).length;
  });

  private loadSubscription?: Subscription;
  // Typing searches once the admin pauses, instead of on every keystroke.
  onSearchInput = debounced((term: string) => this.onSearchChange(term));

  constructor() {
    // Live stock (SignalR): orders, cancellations and restocks update the rows
    // in place. A row the admin is mid-edit keeps their typed value.
    inject(NotificationService).stockChanged
      .pipe(takeUntilDestroyed())
      .subscribe(levels => {
        const byId = new Map(levels.map(l => [l.productId, l.stockQuantity]));
        const visible = new Set(this.products().map(p => p.productId));

        // A product off this page may have just become low - refetch the filtered list.
        if (this.lowStockOnly() && levels.some(l => !visible.has(l.productId))) {
          this.loadProducts();
          return;
        }

        this.products.update(items =>
          items.map(p => {
            const stock = byId.get(p.productId);
            if (stock === undefined) {
              return p;
            }
            if (!this.hasChanged(p)) {
              this.stockEdits[p.productId] = stock;
            }
            return { ...p, stockQuantity: stock };
          })
        );
      });
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  onPageChange(page: number): void {
    this.clearSelection();
    this.page.set(page);
    this.loadProducts();
  }

  onSearchChange(term: string): void {
    this.clearSelection();
    this.onSearchInput.cancel();
    this.searchTerm.set(term);
    this.page.set(1);
    this.loadProducts();
  }

  onLowStockToggle(value: boolean): void {
    this.clearSelection();
    this.lowStockOnly.set(value);
    this.page.set(1);
    this.loadProducts();
  }

  hasFilters = computed(() => !!this.searchTerm().trim() || this.lowStockOnly());

  clearFilters(): void {
    this.clearSelection();
    this.onSearchInput.cancel();
    this.searchTerm.set('');
    this.lowStockOnly.set(false);
    this.page.set(1);
    this.loadProducts();
  }

  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);

    this.productService.exportStockCsv(this.searchTerm().trim() || undefined, this.lowStockOnly()).subscribe({
      next: blob => {
        this.isExporting.set(false);
        downloadBlob(blob, this.lowStockOnly() ? 'low-stock-export.csv' : 'stock-export.csv');
      },
      error: (err: unknown) => {
        this.isExporting.set(false);
        blobErrorMessage(err, 'Unable to export stock.').then(message => this.toast.error(message));
      }
    });
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const lowStockOnly = this.lowStockOnly();

    // A newer load (next page, new search) replaces any request still in flight.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.productService.getProductsPaged(
      this.page(),
      PAGE_SIZE,
      this.searchTerm().trim() || undefined,
      undefined,
      false,
      undefined,
      undefined,
      undefined,
      false,
      // Most urgent first when looking at low stock.
      lowStockOnly ? 'stock_asc' : undefined,
      lowStockOnly
    ).subscribe({
      next: result => {
        // Removing the last row on the last page leaves it empty; step back a page.
        if (result.items.length === 0 && this.page() > 1) {
          this.page.set(Math.max(1, result.totalPages));
          this.loadProducts();
          return;
        }
        this.products.set(result.items);
        this.totalPages.set(result.totalPages || 1);
        this.totalCount.set(result.totalCount);
        this.stockEdits = Object.fromEntries(
          result.items.map(p => [p.productId, p.stockQuantity])
        );
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load products.');
        this.isLoading.set(false);
      }
    });
  }

  status(product: Product): string {
    return getStockStatus(this.stockEdits[product.productId] ?? product.stockQuantity);
  }

  label(product: Product): string {
    return getStockLabel(this.stockEdits[product.productId] ?? product.stockQuantity);
  }

  hasChanged(product: Product): boolean {
    return this.stockEdits[product.productId] !== product.stockQuantity;
  }

  saveStock(product: Product): void {
    const newStock = this.stockEdits[product.productId];

    if (!this.hasChanged(product)) {
      return;
    }

    // Cleared or fractional input would be rejected by the API; explain it here instead.
    if (newStock === null || newStock === undefined || !Number.isInteger(newStock) || newStock < 0) {
      this.rowErrors[product.productId] = 'Enter a whole number, 0 or more.';
      return;
    }

    this.savingProductId.set(product.productId);
    delete this.rowErrors[product.productId];

    // Send only the change from the stock shown on screen; the API applies it to the
    // live value, so orders placed since the page loaded still count.
    const delta = newStock - product.stockQuantity;

    this.productService.adjustStock(product.productId, delta).subscribe({
      next: result => {
        this.savingProductId.set(null);
        this.products.update(items =>
          items.map(p =>
            p.productId === product.productId ? { ...p, stockQuantity: result.stockQuantity } : p
          )
        );
        this.stockEdits[product.productId] = result.stockQuantity;
        const sign = delta > 0 ? '+' : '';
        this.toast.success(`"${product.name}": ${sign}${delta} (now ${result.stockQuantity} in stock).`);
      },
      error: (error: HttpErrorResponse) => {
        this.savingProductId.set(null);
        // 409: orders took stock since load - show the live number so the admin can re-enter.
        if (error.status === 409 && typeof error.error?.stockQuantity === 'number') {
          this.products.update(items =>
            items.map(p =>
              p.productId === product.productId ? { ...p, stockQuantity: error.error.stockQuantity } : p
            )
          );
          this.stockEdits[product.productId] = error.error.stockQuantity;
        }
        this.rowErrors[product.productId] =
          error.error?.message || 'Unable to update stock.';
      }
    });
  }

  toggleSelectProduct(productId: number): void {
    this.selectedIds.update(current => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  toggleSelectAllPage(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      const pageIds = this.products().map(p => p.productId);
      this.selectedIds.update(current => {
        const next = new Set(current);
        for (const id of pageIds) next.add(id);
        return next;
      });
    } else {
      const pageIds = new Set(this.products().map(p => p.productId));
      this.selectedIds.update(current => {
        const next = new Set(current);
        for (const id of pageIds) next.delete(id);
        return next;
      });
    }
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  async saveAllChanged(): Promise<void> {
    const changed = this.products().filter(p => this.hasChanged(p));
    if (changed.length === 0 || this.isSavingAll()) return;

    this.isSavingAll.set(true);
    let successCount = 0;
    let failedCount = 0;

    for (const p of changed) {
      const newStock = this.stockEdits[p.productId];
      if (newStock === null || newStock === undefined || !Number.isInteger(newStock) || newStock < 0) {
        this.rowErrors[p.productId] = 'Enter a whole number, 0 or more.';
        failedCount++;
        continue;
      }

      delete this.rowErrors[p.productId];
      const delta = newStock - p.stockQuantity;
      try {
        const result = await firstValueFrom(this.productService.adjustStock(p.productId, delta));
        this.products.update(items =>
          items.map(item => item.productId === p.productId ? { ...item, stockQuantity: result.stockQuantity } : item)
        );
        this.stockEdits[p.productId] = result.stockQuantity;
        successCount++;
      } catch (err: unknown) {
        failedCount++;
        const error = err as HttpErrorResponse;
        if (error.status === 409 && typeof error.error?.stockQuantity === 'number') {
          this.products.update(items =>
            items.map(item => item.productId === p.productId ? { ...item, stockQuantity: error.error.stockQuantity } : item)
          );
          this.stockEdits[p.productId] = error.error.stockQuantity;
        }
        this.rowErrors[p.productId] = error.error?.message || 'Failed to update';
      }
    }

    this.isSavingAll.set(false);
    if (successCount > 0 && failedCount === 0) {
      this.toast.success(`Saved all stock changes (${successCount} product${successCount === 1 ? '' : 's'}).`);
    } else if (successCount > 0 && failedCount > 0) {
      this.toast.success(`Updated ${successCount} product(s); ${failedCount} could not be updated.`);
    } else if (failedCount > 0) {
      this.toast.error(`Unable to update ${failedCount} product(s). Please review row errors.`);
    }
  }

  async applyBulkAction(): Promise<void> {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0 || this.isBulkUpdating()) return;

    const action = this.bulkAction();
    const qty = this.bulkQuantity() ?? 0;

    if (action !== 'outOfStock' && (qty === null || qty === undefined || isNaN(qty) || qty < 0 || !Number.isInteger(qty))) {
      this.toast.error('Please enter a valid whole number for quantity.');
      return;
    }

    if (action === 'outOfStock') {
      const ok = await this.confirmDialog.confirm(
        `Set stock to 0 (Out of Stock) for ${ids.length} selected product(s)?`,
        { confirmLabel: 'Mark Out of Stock', cancelLabel: 'Cancel', danger: true }
      );
      if (!ok) return;
    }

    this.isBulkUpdating.set(true);
    let successCount = 0;
    let failedCount = 0;

    for (const id of ids) {
      const p = this.products().find(item => item.productId === id);
      if (!p) continue;

      let delta = 0;
      if (action === 'add') {
        delta = qty;
      } else if (action === 'subtract') {
        delta = -Math.min(p.stockQuantity, qty);
      } else if (action === 'set') {
        delta = qty - p.stockQuantity;
      } else if (action === 'outOfStock') {
        delta = -p.stockQuantity;
      }

      if (delta === 0) {
        successCount++;
        continue;
      }

      try {
        const result = await firstValueFrom(this.productService.adjustStock(id, delta));
        this.products.update(items =>
          items.map(item => item.productId === id ? { ...item, stockQuantity: result.stockQuantity } : item)
        );
        this.stockEdits[id] = result.stockQuantity;
        delete this.rowErrors[id];
        successCount++;
      } catch (err: unknown) {
        failedCount++;
        const error = err as HttpErrorResponse;
        if (error.status === 409 && typeof error.error?.stockQuantity === 'number') {
          this.products.update(items =>
            items.map(item => item.productId === id ? { ...item, stockQuantity: error.error.stockQuantity } : item)
          );
          this.stockEdits[id] = error.error.stockQuantity;
        }
        this.rowErrors[id] = error.error?.message || 'Failed to update';
      }
    }

    this.isBulkUpdating.set(false);
    this.clearSelection();

    if (successCount > 0 && failedCount === 0) {
      this.toast.success(`Successfully updated stock for ${successCount} product(s).`);
    } else if (successCount > 0 && failedCount > 0) {
      this.toast.success(`Updated stock for ${successCount} product(s); ${failedCount} could not be updated.`);
    } else if (failedCount > 0) {
      this.toast.error(`Unable to update ${failedCount} product(s).`);
    }
  }
}

