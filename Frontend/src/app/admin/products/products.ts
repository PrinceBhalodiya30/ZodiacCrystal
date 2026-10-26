import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, of, switchMap } from 'rxjs';
import { AdminProductFilters, BulkAction, BulkUpdateRequest, BulkUpdateResult, ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { ZodiacService } from '../../services/zodiac.service';
import { Product } from '../../models/product';
import { Category } from '../../models/category';
import { Zodiac } from '../../models/zodiac';
import { AdminNav } from '../admin-nav/admin-nav';
import { ImageManagerModal } from '../shared/image-manager-modal/image-manager-modal';
import { Spinner } from '../../components/spinner/spinner';
import { Pager } from '../../components/pager/pager';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { blobErrorMessage, downloadBlob } from '../../utils/download.util';
import { debounced } from '../../utils/debounce.util';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { InrPipe } from '../../pipes/inr.pipe';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../services/notification.service';
import { ZodiacIcon } from '../../components/zodiac-icon/zodiac-icon';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [InrPipe, Spinner, FormsModule, AdminNav, ImageManagerModal, Pager, ImgFallbackDirective, ZodiacIcon],
  templateUrl: './products.html',
  styleUrls: ['../admin-shared.css', './products.css']
})
export class AdminProducts implements OnInit {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private zodiacService = inject(ZodiacService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  zodiacs = signal<Zodiac[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  page = signal(1);
  totalPages = signal(1);
  // Rows matching the current filters - shown on the Export button.
  totalCount = signal(0);
  isExporting = signal(false);
  searchTerm = signal('');
  categoryFilter = signal<number | null>(null);
  statusFilter = signal<'' | 'active' | 'inactive'>('');
  stockFilter = signal<'' | 'in' | 'low' | 'out'>('');
  hasFilters = computed(() =>
    !!this.searchTerm().trim() || this.categoryFilter() !== null || !!this.statusFilter() || !!this.stockFilter());

  private loadSubscription?: Subscription;
  // Typing searches once the admin pauses, instead of on every keystroke.
  onSearchInput = debounced((term: string) => this.onSearchChange(term));

  onSearchChange(term: string): void {
    this.onSearchInput.cancel();
    this.searchTerm.set(term);
    this.clearSelection();
    this.page.set(1);
    this.loadProducts();
  }

  onFilterChange(): void {
    this.clearSelection();
    this.page.set(1);
    this.loadProducts();
  }

  clearFilters(): void {
    this.onSearchInput.cancel();
    this.searchTerm.set('');
    this.categoryFilter.set(null);
    this.statusFilter.set('');
    this.stockFilter.set('');
    this.onFilterChange();
  }

  // Same filters for the list and the CSV export.
  private filters(): AdminProductFilters {
    return {
      search: this.searchTerm().trim() || undefined,
      categoryId: this.categoryFilter(),
      status: this.statusFilter(),
      stock: this.stockFilter()
    };
  }

  // ---- Bulk actions ----
  // Ticked product ids (kept across pages), or every row matching the filters.
  selectedIds = signal<Set<number>>(new Set());
  selectAllMatching = signal(false);
  selectedCount = computed(() => this.selectAllMatching() ? this.totalCount() : this.selectedIds().size);
  pageAllSelected = computed(() =>
    this.selectAllMatching() || (this.products().length > 0 && this.products().every(p => this.selectedIds().has(p.productId))));

  bulkAction: BulkAction = 'increasePercent';
  bulkValue: number | null = null;
  bulkRounding: 'none' | 'whole' | '99' = 'none';
  bulkCategoryId: number | null = null;
  bulkPreview = signal<BulkUpdateResult | null>(null);
  bulkBusy = signal(false);
  bulkError = signal('');

  readonly bulkActions: { value: BulkAction; label: string }[] = [
    { value: 'increasePercent', label: 'Increase price by %' },
    { value: 'decreasePercent', label: 'Decrease price by %' },
    { value: 'increaseAmount', label: 'Increase price by ₹' },
    { value: 'decreaseAmount', label: 'Decrease price by ₹' },
    { value: 'setPrice', label: 'Set price to ₹' },
    { value: 'startSale', label: 'Put on sale (% off)' },
    { value: 'endSale', label: 'End sale' },
    { value: 'activate', label: 'Activate' },
    { value: 'deactivate', label: 'Deactivate' },
    { value: 'setCategory', label: 'Move to category' }
  ];

  bulkNeedsValue(): boolean {
    return ['setPrice', 'increasePercent', 'decreasePercent', 'increaseAmount', 'decreaseAmount', 'startSale'].includes(this.bulkAction);
  }

  bulkIsPercent(): boolean {
    return ['increasePercent', 'decreasePercent', 'startSale'].includes(this.bulkAction);
  }

  isSelected(id: number): boolean {
    return this.selectAllMatching() || this.selectedIds().has(id);
  }

  toggleSelected(id: number, checked: boolean): void {
    if (this.selectAllMatching()) {
      // Unticking one row turns "all matching" back into this page's ids.
      this.selectAllMatching.set(false);
      this.selectedIds.set(new Set(this.products().map(p => p.productId)));
    }
    const next = new Set(this.selectedIds());
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selectedIds.set(next);
  }

  togglePage(checked: boolean): void {
    this.selectAllMatching.set(false);
    const next = new Set(this.selectedIds());
    for (const p of this.products()) {
      if (checked) {
        next.add(p.productId);
      } else {
        next.delete(p.productId);
      }
    }
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectAllMatching.set(false);
    this.selectedIds.set(new Set());
    this.bulkPreview.set(null);
    this.bulkError.set('');
    this.bulkValue = null;
    this.bulkRounding = 'none';
    this.bulkCategoryId = null;
  }

  private bulkRequest(preview: boolean): BulkUpdateRequest {
    const f = this.filters();
    return {
      productIds: this.selectAllMatching() ? null : [...this.selectedIds()],
      filter: this.selectAllMatching() ? { search: f.search, categoryId: f.categoryId, status: f.status, stock: f.stock } : undefined,
      action: this.bulkAction,
      value: this.bulkNeedsValue() ? this.bulkValue : null,
      rounding: this.bulkRounding,
      categoryId: this.bulkAction === 'setCategory' ? this.bulkCategoryId : null,
      preview
    };
  }

  previewBulk(): void {
    if (this.bulkBusy() || this.selectedCount() === 0) {
      return;
    }
    this.bulkBusy.set(true);
    this.bulkError.set('');
    this.productService.bulkUpdate(this.bulkRequest(true)).subscribe({
      next: result => {
        this.bulkBusy.set(false);
        this.bulkPreview.set(result);
      },
      error: (error: HttpErrorResponse) => {
        this.bulkBusy.set(false);
        this.bulkError.set(error.error?.message || 'Unable to preview this change.');
      }
    });
  }

  applyBulk(): void {
    if (this.bulkBusy()) {
      return;
    }
    this.bulkBusy.set(true);
    this.productService.bulkUpdate(this.bulkRequest(false)).subscribe({
      next: result => {
        this.bulkBusy.set(false);
        this.bulkPreview.set(null);
        const skipped = result.skippedCount ? `, ${result.skippedCount} skipped` : '';
        this.toast.success(`${result.changedCount} product(s) updated${skipped}.`);
        this.clearSelection();
        this.loadProducts();
      },
      error: (error: HttpErrorResponse) => {
        this.bulkBusy.set(false);
        this.bulkError.set(error.error?.message || 'Unable to apply this change.');
      }
    });
  }

  closeBulkPreview(): void {
    if (!this.bulkBusy()) {
      this.bulkPreview.set(null);
    }
  }

  formMode = signal<'closed' | 'create' | 'edit'>('closed');
  editingProductId = signal<number | null>(null);
  editingProduct = signal<Product | null>(null);
  isSubmitting = signal(false);
  formError = signal('');

  formSku = '';
  formName = '';
  formDescription = '';
  formPrice: number | null = null;
  formCompareAtPrice: number | null = null;
  formStock: number | null = null;
  formCategoryId: number | null = null;
  formIsActive = true;
  formZodiacIds: number[] = [];
  formWaterSafe = '';
  formSunlightExposure = '';
  formChakra = '';
  formElement = '';

  constructor() {
    // Live stock (SignalR): orders, cancellations and restocks update the Stock column.
    inject(NotificationService).stockChanged
      .pipe(takeUntilDestroyed())
      .subscribe(levels => {
        const byId = new Map(levels.map(l => [l.productId, l.stockQuantity]));
        this.products.update(items =>
          items.map(p => byId.has(p.productId) ? { ...p, stockQuantity: byId.get(p.productId)! } : p)
        );
      });
  }

  ngOnInit(): void {
    this.loadProducts();

    this.categoryService.getCategories().subscribe({
      next: categories => this.categories.set(categories),
      error: () => {
        // Category dropdown may be empty if this fails; not fatal.
      }
    });

    this.zodiacService.getZodiacSigns().subscribe({
      next: zodiacs => this.zodiacs.set(zodiacs),
      error: () => {
        // Zodiac checklist may be empty if this fails; not fatal.
      }
    });
  }

  isZodiacSelected(zodiacId: number): boolean {
    return this.formZodiacIds.includes(zodiacId);
  }

  toggleZodiac(zodiacId: number, checked: boolean): void {
    if (checked) {
      if (!this.formZodiacIds.includes(zodiacId)) {
        this.formZodiacIds = [...this.formZodiacIds, zodiacId];
      }
    } else {
      this.formZodiacIds = this.formZodiacIds.filter(id => id !== zodiacId);
    }
  }

  // Image management panel
  manageImagesProduct = signal<Product | null>(null);

  openImageManager(product: Product): void {
    this.manageImagesProduct.set(product);
  }

  closeImageManager(): void {
    this.manageImagesProduct.set(null);
  }

  onImagesProductUpdated(updated: Product): void {
    this.manageImagesProduct.set(updated);
    this.products.update(items =>
      items.map(p => (p.productId === updated.productId ? updated : p))
    );
    if (this.editingProductId() === updated.productId) {
      this.editingProduct.set(updated);
    }
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadProducts();
  }

  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);

    this.productService.exportProductsCsv(this.filters()).subscribe({
      next: blob => {
        this.isExporting.set(false);
        downloadBlob(blob, 'products-export.csv');
      },
      error: (err: unknown) => {
        this.isExporting.set(false);
        blobErrorMessage(err, 'Unable to export products.').then(message => this.toast.error(message));
      }
    });
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    // A newer load (next page, new search) replaces any request still in flight,
    // so a slow older response can't overwrite newer results.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.productService.getProductsAdminPaged(this.page(), PAGE_SIZE, this.filters()).subscribe({
      next: result => {
        // Deleting the last row on the last page leaves it empty; step back a page.
        if (result.items.length === 0 && this.page() > 1) {
          this.page.set(this.page() - 1);
          this.loadProducts();
          return;
        }
        this.products.set(result.items);
        this.totalPages.set(result.totalPages || 1);
        this.totalCount.set(result.totalCount);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load products.');
        this.isLoading.set(false);
      }
    });
  }

  startCreate(): void {
    this.formMode.set('create');
    this.editingProductId.set(null);
    this.editingProduct.set(null);
    this.formSku = '';
    this.formName = '';
    this.formDescription = '';
    this.formPrice = null;
    this.formCompareAtPrice = null;
    this.formStock = null;
    this.formCategoryId = this.categories()[0]?.categoryId ?? null;
    this.formIsActive = true;
    this.formZodiacIds = [];
    this.formWaterSafe = '';
    this.formSunlightExposure = '';
    this.formChakra = '';
    this.formElement = '';
    this.formError.set('');
  }

  startEdit(product: Product): void {
    this.formMode.set('edit');
    this.editingProductId.set(product.productId);
    this.editingProduct.set(product);
    this.formSku = product.sku;
    this.formName = product.name;
    this.formDescription = product.description ?? '';
    this.formPrice = product.price;
    this.formCompareAtPrice = product.compareAtPrice ?? null;
    this.formStock = product.stockQuantity;
    this.formCategoryId = product.categoryId;
    this.formIsActive = product.isActive;
    this.formZodiacIds = product.zodiacs.map(z => z.zodiacId);
    this.formWaterSafe = product.waterSafe ?? '';
    this.formSunlightExposure = product.sunlightExposure ?? '';
    this.formChakra = product.chakra ?? '';
    this.formElement = product.element ?? '';
    this.formError.set('');
  }

  // Escape closes the form via the same path as the overlay click. Ignored while
  // a confirm dialog or the image manager is on top so only the topmost layer closes.
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.bulkPreview() && !this.confirmDialog.request()) {
      this.closeBulkPreview();
      return;
    }
    if (this.formMode() === 'closed' || this.confirmDialog.request() || this.manageImagesProduct()) {
      return;
    }
    this.cancelForm();
  }

  cancelForm(): void {
    this.formMode.set('closed');
    this.editingProductId.set(null);
  }

  // Same rule the server enforces: a "was" price only makes sense above Price.
  compareAtTooLow(): boolean {
    return !!this.formCompareAtPrice && this.formPrice !== null && this.formCompareAtPrice <= this.formPrice;
  }

  // Discount the shop will show for the entered prices, or null for none.
  compareAtPreviewPercent(): number | null {
    if (!this.formCompareAtPrice || !this.formPrice || this.compareAtTooLow()) {
      return null;
    }
    return Math.round(((this.formCompareAtPrice - this.formPrice) / this.formCompareAtPrice) * 100);
  }

  submitForm(): void {
    if (
      !this.formSku.trim() ||
      !this.formName.trim() ||
      this.formPrice === null ||
      this.formStock === null ||
      this.formCategoryId === null
    ) {
      return;
    }

    if (this.compareAtTooLow()) {
      this.formError.set('Compare-at price must be higher than the price, or left empty.');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    const request = {
      sku: this.formSku,
      name: this.formName,
      description: this.formDescription || undefined,
      price: this.formPrice!,
      compareAtPrice: this.formCompareAtPrice || null,
      stockQuantity: this.formStock!,
      categoryId: this.formCategoryId!,
      isActive: this.formIsActive,
      zodiacIds: this.formZodiacIds,
      waterSafe: this.formWaterSafe?.trim() || null,
      sunlightExposure: this.formSunlightExposure?.trim() || null,
      chakra: this.formChakra?.trim() || null,
      element: this.formElement?.trim() || null
    };

    const editingId = this.editingProductId();

    if (editingId) {
      // The product save no longer writes stock (it would erase orders placed
      // since the form opened). A stock edit is sent as a change against the
      // number the form loaded, applied to the current stock by adjust-stock.
      const stockDelta = this.formStock! - (this.editingProduct()?.stockQuantity ?? this.formStock!);

      this.productService.updateProduct(editingId, request).pipe(
        switchMap(() => stockDelta !== 0 ? this.productService.adjustStock(editingId, stockDelta) : of(null))
      ).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.formMode.set('closed');
          this.toast.success(`"${request.name}" updated.`);
          this.loadProducts();
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.formError.set(error.error?.message || 'Unable to save this product.');
        }
      });
    } else {
      this.productService.createProduct(request).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.formMode.set('closed');
          this.toast.success(`"${request.name}" added.`);
          this.loadProducts();
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.formError.set(error.error?.message || 'Unable to save this product.');
        }
      });
    }
  }

  async deleteProduct(product: Product): Promise<void> {
    const confirmed = await this.confirmDialog.confirm(
      `Delete "${product.name}"? If it has past orders, reviews or wishlist entries, it will be hidden from the storefront instead of removed.`,
      { confirmLabel: 'Delete', danger: true }
    );

    if (!confirmed) {
      return;
    }

    this.productService.deleteProduct(product.productId).subscribe({
      next: () => {
        this.toast.success(`"${product.name}" deleted.`);
        this.loadProducts();
      },
      error: (error: HttpErrorResponse) => {
        this.toast.error(error.error?.message || `Unable to delete "${product.name}".`);
      }
    });
  }
}
