import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, ElementRef, Injector, OnInit, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { debounced } from '../../utils/debounce.util';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AdminNav } from '../admin-nav/admin-nav';
import { Spinner } from '../../components/spinner/spinner';
import { ReturnService } from '../../services/return.service';
import { ToastService } from '../../services/toast.service';
import { ReturnRequest } from '../../models/return-request';
import { scrollBehavior } from '../../utils/motion.util';
import { InrPipe } from '../../pipes/inr.pipe';
import { Pager } from '../../components/pager/pager';
import { Subscription, firstValueFrom } from 'rxjs';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

const PAGE_SIZE = 20;

type ReturnAction = 'approve' | 'reject' | 'refund';

import { AdminNavCountsService } from '../admin-nav/admin-nav-counts.service';
import { NotificationService } from '../../services/notification.service';
import { blobErrorMessage, downloadBlob } from '../../utils/download.util';
@Component({
  selector: 'app-admin-returns',
  standalone: true,
  imports: [InrPipe, AdminNav, Spinner, DatePipe, FormsModule, Pager],
  templateUrl: './returns.html',
  styleUrls: ['../admin-shared.css', './returns.css']
})
export class AdminReturns implements OnInit {
  private returnService = inject(ReturnService);
  private confirmDialog = inject(ConfirmDialogService);

  isExporting = signal(false);
  private toast = inject(ToastService);
  private navCounts = inject(AdminNavCountsService);
  private injector = inject(Injector);

  private actionPanel = viewChild<ElementRef<HTMLDivElement>>('actionPanel');

  readonly statuses = ['Requested', 'Approved', 'Rejected', 'Refunded'];

  returns = signal<ReturnRequest[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  // Defaults to what needs attention; a link can pick another one (?status=Approved, or ?status= for all).
  statusFilter = signal(this.initialStatus());

  // Multi-select & Bulk toolbar state
  selectedIds = signal<Set<number>>(new Set());
  selectedCount = computed(() => this.selectedIds().size);
  pageAllSelected = computed(() => {
    const items = this.returns();
    return items.length > 0 && items.every(r => this.selectedIds().has(r.returnRequestId));
  });
  bulkAction = signal<'approve' | 'reject'>('approve');
  isBulkUpdating = signal(false);

  page = signal(1);
  totalPages = signal(1);
  // Rows matching the current filter - shown on the Export button.
  totalCount = signal(0);
  private loadSubscription?: Subscription;

  // The request + action currently being confirmed in the action panel.
  active = signal<{ request: ReturnRequest; action: ReturnAction } | null>(null);
  adminNote = '';
  restock = true;
  isActing = signal(false);

  constructor() {
    // New return requests from customers, or another admin's action.
    inject(NotificationService).adminDataChanged
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        if (event.kind === 'return') {
          this.loadReturns(true);
        }
      });
  }

  ngOnInit(): void {
    this.loadReturns();
  }

  private initialStatus(): string {
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    if (!params.has('status')) {
      return 'Requested';
    }
    const status = params.get('status') ?? '';
    return this.statuses.includes(status) ? status : '';
  }

  onStatusFilterChange(status: string): void {
    this.clearSelection();
    this.statusFilter.set(status);
    this.page.set(1);
    this.active.set(null);
    this.loadReturns();
  }

  // Search by order number ("93" / "#93"), customer name or email.
  searchTerm = signal('');
  // "Clear filters" goes back to the page's normal view: returns waiting for review.
  private readonly defaultStatus = 'Requested';
  hasFilters = computed(() => !!this.searchTerm().trim() || this.statusFilter() !== this.defaultStatus);
  // Typing searches once the admin pauses, instead of on every keystroke.
  onSearchInput = debounced((term: string) => this.onSearchChange(term));

  onSearchChange(term: string): void {
    this.clearSelection();
    this.onSearchInput.cancel();
    this.searchTerm.set(term);
    this.page.set(1);
    this.active.set(null);
    this.loadReturns();
  }

  clearFilters(): void {
    this.clearSelection();
    this.onSearchInput.cancel();
    this.searchTerm.set('');
    this.onStatusFilterChange(this.defaultStatus);
  }

  onPageChange(page: number): void {
    this.clearSelection();
    this.page.set(page);
    this.active.set(null);
    this.loadReturns();
  }

  // silent: refresh in place (live updates) without swapping in the spinner.
  loadReturns(silent = false): void {
    if (!silent) {
      this.isLoading.set(true);
    }
    this.errorMessage.set('');

    // A newer load (next page, new filter) replaces any request still in flight.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.returnService
      .getReturnsAdminPaged(this.page(), PAGE_SIZE, this.statusFilter() || undefined, this.searchTerm().trim() || undefined)
      .subscribe({
      next: result => {
        // Acting on the last row of the last page (e.g. approving it while
        // filtered to "Requested") leaves it empty; step back a page.
        if (result.items.length === 0 && this.page() > 1) {
          this.page.set(Math.max(1, result.totalPages));
          this.loadReturns(silent);
          return;
        }
        this.returns.set(result.items);
        this.totalPages.set(result.totalPages || 1);
        this.totalCount.set(result.totalCount);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load return requests.');
        this.isLoading.set(false);
      }
    });
  }

  startAction(request: ReturnRequest, action: ReturnAction): void {
    this.adminNote = '';
    this.restock = true;
    this.active.set({ request, action });

    // The panel sits above the table, so bring it into view when acting on a row further down.
    afterNextRender(
      () => this.actionPanel()?.nativeElement.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' }),
      { injector: this.injector }
    );
  }

  showAllReturns(): void {
    this.onStatusFilterChange('');
  }

  cancelAction(): void {
    this.active.set(null);
  }

  // Filter options say what each stage still needs, so "Approved" isn't read as "done".
  statusFilterLabel(status: string): string {
    return status === 'Requested' ? 'Requested (needs review)' : status === 'Approved' ? 'Approved (refund due)' : status;
  }

  // COD refunds are paid outside the site, so the button records it rather than sending money.
  confirmLabel(active: { request: ReturnRequest; action: ReturnAction }): string {
    if (active.action === 'refund' && active.request.paymentMethod !== 'Card') {
      return 'Mark as refunded';
    }
    return this.actionTitle(active.action);
  }

  actionTitle(action: ReturnAction): string {
    return action === 'approve' ? 'Approve return' : action === 'reject' ? 'Reject return' : 'Issue refund';
  }

  confirmAction(): void {
    const active = this.active();
    if (!active || this.isActing()) {
      return;
    }

    const { request, action } = active;
    const note = this.adminNote.trim() || undefined;

    const call =
      action === 'approve' ? this.returnService.approve(request.returnRequestId, note)
      : action === 'reject' ? this.returnService.reject(request.returnRequestId, note)
      : this.returnService.refund(request.returnRequestId, this.restock, note);

    this.isActing.set(true);

    call.subscribe({
      next: updated => {
        this.navCounts.refresh();
        this.isActing.set(false);
        this.active.set(null);
        this.toast.success(
          action === 'refund'
            ? `Order #${updated.orderId} refunded${updated.paymentMethod === 'Card' ? ' to the customer\'s card' : ''}.`
            : `Return for order #${updated.orderId} ${updated.status.toLowerCase()}.`
        );
        // Refresh so the row moves out of (or into) the current filter.
        this.loadReturns();
      },
      error: (error: HttpErrorResponse) => {
        this.isActing.set(false);
        this.toast.error(error.error?.message || 'Unable to update this return.');
      }
    });
  }

  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);

    this.returnService.exportReturnsCsv(this.statusFilter() || undefined, this.searchTerm().trim() || undefined).subscribe({
      next: blob => {
        this.isExporting.set(false);
        downloadBlob(blob, this.statusFilter() ? `returns-${this.statusFilter().toLowerCase()}.csv` : 'returns-export.csv');
      },
      error: (err: unknown) => {
        this.isExporting.set(false);
        blobErrorMessage(err, 'Unable to export returns.').then(message => this.toast.error(message));
      }
    });
  }

  toggleSelectReturn(returnId: number): void {
    this.selectedIds.update(current => {
      const next = new Set(current);
      if (next.has(returnId)) {
        next.delete(returnId);
      } else {
        next.add(returnId);
      }
      return next;
    });
  }

  toggleSelectAllPage(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      const pageIds = this.returns().map(r => r.returnRequestId);
      this.selectedIds.update(current => {
        const next = new Set(current);
        for (const id of pageIds) next.add(id);
        return next;
      });
    } else {
      const pageIds = new Set(this.returns().map(r => r.returnRequestId));
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

  async applyBulkAction(): Promise<void> {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0 || this.isBulkUpdating()) return;

    const action = this.bulkAction();
    if (action === 'reject') {
      const confirmed = await this.confirmDialog.confirm(
        `Are you sure you want to reject ${ids.length} selected return request(s)?`,
        { confirmLabel: 'Reject Returns', cancelLabel: 'Cancel', danger: true }
      );
      if (!confirmed) return;
    }

    this.isBulkUpdating.set(true);
    let successCount = 0;
    let failedCount = 0;

    for (const id of ids) {
      try {
        if (action === 'approve') {
          await firstValueFrom(this.returnService.approve(id));
        } else {
          await firstValueFrom(this.returnService.reject(id, 'Bulk rejected by administrator'));
        }
        successCount++;
      } catch {
        failedCount++;
      }
    }

    this.isBulkUpdating.set(false);
    this.clearSelection();
    this.loadReturns();
    this.navCounts.refresh();

    if (successCount > 0 && failedCount === 0) {
      this.toast.success(`Successfully ${action === 'approve' ? 'approved' : 'rejected'} ${successCount} return request(s).`);
    } else if (successCount > 0 && failedCount > 0) {
      this.toast.success(`Updated ${successCount} return(s); ${failedCount} could not be updated.`);
    } else if (failedCount > 0) {
      this.toast.error(`Unable to update ${failedCount} return request(s).`);
    }
  }
}
