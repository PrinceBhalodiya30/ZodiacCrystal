import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CouponService } from '../../services/coupon.service';
import { Coupon, CouponDiscountType } from '../../models/coupon';
import { AdminNav } from '../admin-nav/admin-nav';
import { Spinner } from '../../components/spinner/spinner';
import { Pager } from '../../components/pager/pager';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { debounced } from '../../utils/debounce.util';
import { InrPipe, formatInr } from '../../pipes/inr.pipe';
import { blobErrorMessage, downloadBlob } from '../../utils/download.util';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../services/notification.service';

const PAGE_SIZE = 20;

type CouponStatus = 'active' | 'scheduled' | 'expired' | 'usedup' | 'inactive';

// Server dates come without a zone but are UTC.
function utc(date: string): number {
  return new Date(/(Z|[+-]\d\d:\d\d)$/.test(date) ? date : date + 'Z').getTime();
}

@Component({
  selector: 'app-admin-coupons',
  standalone: true,
  imports: [InrPipe, Spinner, FormsModule, AdminNav, Pager, SlicePipe],
  templateUrl: './coupons.html',
  styleUrls: ['../admin-shared.css', './coupons.css']
})
export class AdminCoupons implements OnInit {
  private couponService = inject(CouponService);

  isExporting = signal(false);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  coupons = signal<Coupon[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  updatingCouponId = signal<number | null>(null);
  notifyingCouponId = signal<number | null>(null);

  page = signal(1);
  totalPages = signal(1);
  // Rows matching the current filters - shown on the Export button.
  totalCount = signal(0);
  searchTerm = signal('');
  statusFilter = signal<'' | CouponStatus>('');
  hasFilters = computed(() => !!this.searchTerm().trim() || !!this.statusFilter());

  formMode = signal<'closed' | 'create' | 'edit'>('closed');
  editingCouponId = signal<number | null>(null);
  isSubmitting = signal(false);
  formError = signal('');

  formCode = '';
  formDescription = '';
  formDiscountType: CouponDiscountType = 'Percentage';
  formDiscountValue = 0;
  formMinimumOrderAmount = 0;
  formStartDate = '';
  formEndDate = '';
  formUsageLimit = 1;
  // Empty (null) = no per-customer limit.
  formMaxUsesPerUser: number | null = null;
  formIsActive = true;

  private loadSubscription?: Subscription;
  // Typing searches once the admin pauses, instead of on every keystroke.
  onSearchInput = debounced((term: string) => this.onSearchChange(term));

  constructor() {
    // A new order may have used a coupon (SignalR) - reload the usage counts.
    inject(NotificationService).adminOrderPlaced
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.loadCoupons());
  }

  ngOnInit(): void {
    this.loadCoupons();
  }

  onSearchChange(term: string): void {
    this.onSearchInput.cancel();
    this.searchTerm.set(term);
    this.page.set(1);
    this.loadCoupons();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadCoupons();
  }

  clearFilters(): void {
    this.onSearchInput.cancel();
    this.searchTerm.set('');
    this.statusFilter.set('');
    this.onFilterChange();
  }

  // Same order of checks as the server's status filter (and checkout's coupon
  // validation), so the badge always matches the filter the row appears under.
  couponStatus(coupon: Coupon): CouponStatus {
    if (!coupon.isActive) {
      return 'inactive';
    }
    const now = Date.now();
    if (now < utc(coupon.startDate)) {
      return 'scheduled';
    }
    if (now > utc(coupon.endDate)) {
      return 'expired';
    }
    return coupon.usedCount >= coupon.usageLimit ? 'usedup' : 'active';
  }

  readonly statusLabels: Record<CouponStatus, string> = {
    active: 'Active', scheduled: 'Scheduled', expired: 'Expired', usedup: 'Used up', inactive: 'Inactive'
  };

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadCoupons();
  }

  loadCoupons(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    // A newer load (next page, new search) replaces any request still in flight.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.couponService.getCoupons(this.page(), PAGE_SIZE, this.searchTerm().trim() || undefined, this.statusFilter()).subscribe({
      next: result => {
        // Deleting the last row on the last page leaves it empty; step back a page.
        if (result.items.length === 0 && this.page() > 1) {
          this.page.set(this.page() - 1);
          this.loadCoupons();
          return;
        }
        this.coupons.set(result.items);
        this.totalPages.set(result.totalPages || 1);
        this.totalCount.set(result.totalCount);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load coupons.');
        this.isLoading.set(false);
      }
    });
  }

  discountLabel(coupon: Coupon): string {
    return coupon.discountType === 'Percentage'
      ? `${coupon.discountValue}% off`
      : `${formatInr(coupon.discountValue)} off`;
  }

  startCreate(): void {
    this.formMode.set('create');
    this.editingCouponId.set(null);
    this.formCode = '';
    this.formDescription = '';
    this.formDiscountType = 'Percentage';
    this.formDiscountValue = 0;
    this.formMinimumOrderAmount = 0;
    this.formStartDate = '';
    this.formEndDate = '';
    this.formUsageLimit = 1;
    this.formMaxUsesPerUser = null;
    this.formIsActive = true;
    this.formError.set('');
  }

  startEdit(coupon: Coupon): void {
    this.formMode.set('edit');
    this.editingCouponId.set(coupon.couponId);
    this.formCode = coupon.code;
    this.formDescription = coupon.description ?? '';
    this.formDiscountType = coupon.discountType;
    this.formDiscountValue = coupon.discountValue;
    this.formMinimumOrderAmount = coupon.minimumOrderAmount;
    this.formStartDate = coupon.startDate?.slice(0, 10) ?? '';
    this.formEndDate = coupon.endDate?.slice(0, 10) ?? '';
    this.formUsageLimit = coupon.usageLimit;
    this.formMaxUsesPerUser = coupon.maxUsesPerUser ?? null;
    this.formIsActive = coupon.isActive;
    this.formError.set('');
  }

  // Escape closes the form via the same path as the overlay click. Ignored while
  // a confirm dialog is on top so only the topmost layer closes.
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.formMode() === 'closed' || this.confirmDialog.request()) {
      return;
    }
    this.cancelForm();
  }

  cancelForm(): void {
    this.formMode.set('closed');
    this.editingCouponId.set(null);
  }

  submitForm(): void {
    // Mirror the backend rules so the admin sees why before a round trip.
    if (!this.formDiscountValue || this.formDiscountValue <= 0) {
      this.formError.set('Discount value must be more than 0.');
      return;
    }
    if (this.formDiscountType === 'Percentage' && this.formDiscountValue > 100) {
      this.formError.set('A percentage discount cannot be more than 100%.');
      return;
    }
    if (this.formMinimumOrderAmount < 0) {
      this.formError.set('Minimum order amount cannot be negative.');
      return;
    }
    if (!this.formUsageLimit || this.formUsageLimit < 1) {
      this.formError.set('Usage limit must be at least 1.');
      return;
    }
    if (this.formMaxUsesPerUser !== null && !(this.formMaxUsesPerUser >= 1)) {
      this.formError.set('Max uses per customer must be at least 1, or left empty.');
      return;
    }
    if (this.formStartDate && this.formEndDate && this.formEndDate <= this.formStartDate) {
      this.formError.set('End date must be after the start date.');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    const request = {
      code: this.formCode,
      description: this.formDescription || undefined,
      discountType: this.formDiscountType,
      discountValue: this.formDiscountValue,
      minimumOrderAmount: this.formMinimumOrderAmount,
      startDate: this.formStartDate,
      endDate: this.formEndDate,
      usageLimit: this.formUsageLimit,
      maxUsesPerUser: this.formMaxUsesPerUser,
      isActive: this.formIsActive
    };

    const editingId = this.editingCouponId();

    if (editingId) {
      this.couponService.updateCoupon(editingId, request).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.formMode.set('closed');
          this.loadCoupons();
          this.toast.success(`Coupon "${request.code}" updated.`);
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.formError.set(error.error?.message || 'Unable to save this coupon.');
        }
      });
    } else {
      this.couponService.createCoupon(request).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.formMode.set('closed');
          this.loadCoupons();
          this.toast.success(`Coupon "${request.code}" created.`);
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.formError.set(error.error?.message || 'Unable to save this coupon.');
        }
      });
    }
  }

  async toggleStatus(coupon: Coupon): Promise<void> {
    const newStatus = !coupon.isActive;

    const confirmed = await this.confirmDialog.confirm(
      newStatus
        ? `Activate coupon "${coupon.code}"?`
        : `Deactivate coupon "${coupon.code}"? Customers won't be able to use it anymore.`,
      { confirmLabel: newStatus ? 'Activate' : 'Deactivate', danger: !newStatus }
    );

    if (!confirmed) {
      return;
    }

    this.updatingCouponId.set(coupon.couponId);

    const request = {
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumOrderAmount: coupon.minimumOrderAmount,
      startDate: coupon.startDate,
      endDate: coupon.endDate,
      usageLimit: coupon.usageLimit,
      maxUsesPerUser: coupon.maxUsesPerUser ?? null,
      isActive: newStatus
    };

    this.couponService.updateCoupon(coupon.couponId, request).subscribe({
      next: () => {
        this.updatingCouponId.set(null);
        this.coupons.update(items =>
          items.map(c => (c.couponId === coupon.couponId ? { ...c, isActive: newStatus } : c))
        );
        this.toast.success(`Coupon "${coupon.code}" ${newStatus ? 'activated' : 'deactivated'}.`);
      },
      error: (error: HttpErrorResponse) => {
        this.updatingCouponId.set(null);
        const message = error.error?.message || `Unable to update "${coupon.code}".`;
        this.toast.error(message);
      }
    });
  }

  // In-app bell only (no email). Once per coupon, and only while it works.
  async notifyCustomers(coupon: Coupon): Promise<void> {
    const confirmed = await this.confirmDialog.confirm(
      `Notify all customers about "${coupon.code}" (${this.discountLabel(coupon)})? It will appear in their notifications and can only be sent once.`,
      { confirmLabel: 'Notify customers' }
    );

    if (!confirmed) {
      return;
    }

    this.notifyingCouponId.set(coupon.couponId);

    this.couponService.notifyCustomers(coupon.couponId).subscribe({
      next: result => {
        this.notifyingCouponId.set(null);
        this.coupons.update(items =>
          items.map(c => (c.couponId === coupon.couponId ? { ...c, notifiedAt: result.notifiedAt } : c))
        );
        this.toast.success(`"${coupon.code}" announced to ${result.recipients} customer${result.recipients === 1 ? '' : 's'}.`);
      },
      error: (error: HttpErrorResponse) => {
        this.notifyingCouponId.set(null);
        this.toast.error(error.error?.message || `Unable to notify customers about "${coupon.code}".`);
      }
    });
  }

  async deleteCoupon(coupon: Coupon): Promise<void> {
    const confirmed = await this.confirmDialog.confirm(
      `Delete coupon "${coupon.code}"? This cannot be undone.`,
      { confirmLabel: 'Delete', danger: true }
    );

    if (!confirmed) {
      return;
    }

    this.couponService.deleteCoupon(coupon.couponId).subscribe({
      next: () => {
        this.toast.success(`Coupon "${coupon.code}" deleted.`);
        this.loadCoupons();
      },
      error: (error: HttpErrorResponse) => {
        const message =
          error.error?.message ||
          `Unable to delete "${coupon.code}". It may already have been used — deactivate it instead.`;
        this.toast.error(message);
      }
    });
  }

  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);

    this.couponService.exportCouponsCsv(this.searchTerm().trim() || undefined, this.statusFilter()).subscribe({
      next: blob => {
        this.isExporting.set(false);
        downloadBlob(blob, 'coupons-export.csv');
      },
      error: (err: unknown) => {
        this.isExporting.set(false);
        blobErrorMessage(err, 'Unable to export coupons.').then(message => this.toast.error(message));
      }
    });
  }
}
