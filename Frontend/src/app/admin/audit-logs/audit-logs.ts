import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogFilters, AuditLogService } from '../../services/audit-log.service';
import { AuditLog } from '../../models/audit-log';
import { AdminNav } from '../admin-nav/admin-nav';
import { Spinner } from '../../components/spinner/spinner';
import { Pager } from '../../components/pager/pager';
import { debounced } from '../../utils/debounce.util';
import { blobErrorMessage, downloadBlob } from '../../utils/download.util';
import { ToastService } from '../../services/toast.service';
import { rangeForPreset, toDateKey } from '../../utils/sales-series.util';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../services/notification.service';

type DatePreset = 'all' | 'today' | 'last7' | 'last30' | 'custom';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-audit-logs',
  standalone: true,
  imports: [Spinner, DatePipe, FormsModule, AdminNav, Pager],
  templateUrl: './audit-logs.html',
  styleUrls: ['../admin-shared.css', './audit-logs.css']
})
export class AdminAuditLogs implements OnInit {
  private auditLogService = inject(AuditLogService);
  private toast = inject(ToastService);

  isExporting = signal(false);

  logs = signal<AuditLog[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  page = signal(1);
  totalPages = signal(1);
  // Rows matching the current filters - shown on the Export button.
  totalCount = signal(0);
  searchTerm = signal('');
  actionFilter = signal('');
  datePreset = signal<DatePreset>('all');
  customFrom = '';
  customTo = '';
  readonly todayKey = toDateKey(new Date());

  // Action names that have actually been logged (for the dropdown).
  actions = signal<string[]>([]);

  hasActiveFilters = computed(() => !!this.searchTerm().trim() || !!this.actionFilter() || this.datePreset() !== 'all');

  private loadSubscription?: Subscription;
  // Typing searches once the admin pauses, instead of on every keystroke.
  onSearchInput = debounced((term: string) => this.onSearchChange(term));

  constructor() {
    // Order and return changes are usually logged - reload to show new entries.
    inject(NotificationService).adminDataChanged
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        if (event.kind === 'order' || event.kind === 'return') {
          this.loadLogs();
        }
      });
  }

  ngOnInit(): void {
    this.loadLogs();
    // The dropdown just stays at "All actions" if this fails.
    this.auditLogService.getActions().subscribe({ next: actions => this.actions.set(actions), error: () => {} });
  }

  actionLabel(action: string): string {
    switch (action) {
      case 'OrderStatusChanged':
        return 'Order status changed';
      case 'CouponCreated':
        return 'Coupon created';
      case 'CouponUpdated':
        return 'Coupon updated';
      case 'CouponDeleted':
        return 'Coupon deleted';
      case 'UserActivated':
        return 'User activated';
      case 'UserDeactivated':
        return 'User deactivated';
      case 'ReviewDeleted':
        return 'Review deleted';
      default:
        // Any other logged action, e.g. "ReturnRefunded" -> "Return refunded".
        return action.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/ (\w)/g, (_, c: string) => ' ' + c.toLowerCase());
    }
  }

  onSearchChange(term: string): void {
    this.onSearchInput.cancel();
    this.searchTerm.set(term);
    this.page.set(1);
    this.loadLogs();
  }

  onActionChange(action: string): void {
    this.actionFilter.set(action);
    this.page.set(1);
    this.loadLogs();
  }

  onDatePresetChange(preset: DatePreset): void {
    this.datePreset.set(preset);
    if (preset === 'custom') {
      // Start the pickers on today; changing either date reloads.
      this.customFrom = this.customFrom || this.todayKey;
      this.customTo = this.customTo || this.todayKey;
    }
    this.page.set(1);
    this.loadLogs();
  }

  onCustomDateChange(): void {
    if (this.customFrom && this.customTo && this.customFrom <= this.customTo) {
      this.page.set(1);
      this.loadLogs();
    }
  }

  clearFilters(): void {
    this.onSearchInput.cancel();
    this.searchTerm.set('');
    this.actionFilter.set('');
    this.datePreset.set('all');
    this.customFrom = '';
    this.customTo = '';
    this.page.set(1);
    this.loadLogs();
  }

  // The admin's local days as exact instants (CreatedAt is stored in UTC).
  private filters(): AuditLogFilters {
    const filters: AuditLogFilters = {
      search: this.searchTerm().trim() || undefined,
      action: this.actionFilter() || undefined
    };

    const preset = this.datePreset();
    const range =
      preset === 'all' ? null
      : preset === 'custom' ? (this.customFrom && this.customTo && this.customFrom <= this.customTo ? { from: this.customFrom, to: this.customTo } : null)
      : rangeForPreset(preset);

    if (range) {
      const start = new Date(range.from + 'T00:00:00');
      const end = new Date(range.to + 'T00:00:00');
      end.setDate(end.getDate() + 1);
      filters.from = start.toISOString();
      filters.to = end.toISOString();
    }
    return filters;
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadLogs();
  }

  loadLogs(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    // A newer load (next page, new search) replaces any request still in flight.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.auditLogService.getPaged(this.page(), PAGE_SIZE, this.filters()).subscribe({
      next: result => {
        // Removing the last row on the last page leaves it empty; step back a page.
        if (result.items.length === 0 && this.page() > 1) {
          this.page.set(Math.max(1, result.totalPages));
          this.loadLogs();
          return;
        }
        this.logs.set(result.items);
        this.totalPages.set(result.totalPages || 1);
        this.totalCount.set(result.totalCount);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load audit logs.');
        this.isLoading.set(false);
      }
    });
  }

  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);

    this.auditLogService.exportCsv(this.filters()).subscribe({
      next: blob => {
        this.isExporting.set(false);
        downloadBlob(blob, 'audit-logs-export.csv');
      },
      error: (err: unknown) => {
        this.isExporting.set(false);
        blobErrorMessage(err, 'Unable to export audit logs.').then(message => this.toast.error(message));
      }
    });
  }
}
