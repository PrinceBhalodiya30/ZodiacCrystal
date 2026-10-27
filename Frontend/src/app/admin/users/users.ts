import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { AdminUser } from '../../models/user';
import { AdminNav } from '../admin-nav/admin-nav';
import { Spinner } from '../../components/spinner/spinner';
import { Pager } from '../../components/pager/pager';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { debounced } from '../../utils/debounce.util';
import { blobErrorMessage, downloadBlob } from '../../utils/download.util';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../services/notification.service';

import { Customer360Drawer } from '../shared/customer-360-drawer/customer-360-drawer';
import { OrderDetailDrawer } from '../orders/order-detail-drawer/order-detail-drawer';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [Spinner, DatePipe, FormsModule, AdminNav, Pager, Customer360Drawer, OrderDetailDrawer],
  templateUrl: './users.html',
  styleUrls: ['../admin-shared.css', './users.css']
})
export class AdminUsers implements OnInit {
  private userService = inject(UserService);
  private router = inject(Router);

  isExporting = signal(false);
  selectedCustomerEmail = signal<string | null>(null);
  selectedOrderId = signal<number | null>(null);
  previousCustomerEmailForOrder = signal<string | null>(null);
  private authService = inject(AuthService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  users = signal<AdminUser[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  updatingUserId = signal<number | null>(null);

  // Multi-select & Bulk toolbar state
  selectedIds = signal<Set<number>>(new Set());
  selectedCount = computed(() => this.selectedIds().size);
  pageAllSelected = computed(() => {
    const selectable = this.users().filter(u => u.userId !== this.currentUserId);
    return selectable.length > 0 && selectable.every(u => this.selectedIds().has(u.userId));
  });
  bulkAction = signal<'activate' | 'deactivate' | 'delete'>('activate');
  isBulkUpdating = signal(false);

  page = signal(1);
  totalPages = signal(1);
  // Rows matching the current filters - shown on the Export button.
  totalCount = signal(0);
  searchTerm = signal('');
  roleFilter = signal<'' | 'Admin' | 'User' | 'Guest'>('');
  statusFilter = signal<'' | 'active' | 'inactive'>('');
  hasFilters = computed(() => !!this.searchTerm().trim() || !!this.roleFilter() || !!this.statusFilter());

  // A logged-in admin can't deactivate their own account (also enforced server-side).
  get currentUserId(): number | undefined {
    return this.authService.currentUser()?.userId;
  }

  private loadSubscription?: Subscription;
  // Typing searches once the admin pauses, instead of on every keystroke.
  onSearchInput = debounced((term: string) => this.onSearchChange(term));

  constructor() {
    // A customer just registered (SignalR) - reload the list.
    inject(NotificationService).adminDataChanged
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        if (event.kind === 'user') {
          this.loadUsers();
        }
      });
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  onSearchChange(term: string): void {
    this.clearSelection();
    this.onSearchInput.cancel();
    this.searchTerm.set(term);
    this.page.set(1);
    this.loadUsers();
  }

  onFilterChange(): void {
    this.clearSelection();
    this.page.set(1);
    this.loadUsers();
  }

  clearFilters(): void {
    this.clearSelection();
    this.onSearchInput.cancel();
    this.searchTerm.set('');
    this.roleFilter.set('');
    this.statusFilter.set('');
    this.onFilterChange();
  }

  onPageChange(page: number): void {
    this.clearSelection();
    this.page.set(page);
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    // A newer load (next page, new search) replaces any request still in flight.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.userService.getUsersAdminPaged(this.page(), PAGE_SIZE, this.searchTerm().trim() || undefined, this.roleFilter(), this.statusFilter()).subscribe({
      next: result => {
        // Removing the last row on the last page leaves it empty; step back a page.
        if (result.items.length === 0 && this.page() > 1) {
          this.page.set(Math.max(1, result.totalPages));
          this.loadUsers();
          return;
        }
        this.users.set(result.items);
        this.totalPages.set(result.totalPages || 1);
        this.totalCount.set(result.totalCount);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load users.');
        this.isLoading.set(false);
      }
    });
  }

  async toggleStatus(user: AdminUser): Promise<void> {
    const newStatus = !user.isActive;

    const confirmed = await this.confirmDialog.confirm(
      newStatus
        ? `Activate "${user.name}"? They will regain access to their account.`
        : `Deactivate "${user.name}"? They will be logged out and unable to sign in.`,
      { confirmLabel: newStatus ? 'Activate' : 'Deactivate', danger: !newStatus }
    );

    if (!confirmed) {
      return;
    }

    this.updatingUserId.set(user.userId);

    this.userService.updateUserStatus(user.userId, newStatus).subscribe({
      next: () => {
        this.updatingUserId.set(null);
        this.users.update(users =>
          users.map(u => (u.userId === user.userId ? { ...u, isActive: newStatus } : u))
        );
        this.toast.success(`"${user.name}" ${newStatus ? 'activated' : 'deactivated'}.`);
      },
      error: (error: HttpErrorResponse) => {
        this.updatingUserId.set(null);
        const message = error.error?.message || `Unable to update "${user.name}".`;
        this.toast.error(message);
      }
    });
  }

  async deleteUser(user: AdminUser): Promise<void> {
    const confirmed = await this.confirmDialog.confirm(
      `Are you sure you want to delete "${user.name}" (${user.email})? If this user has order history, ` +
      `their account will be deactivated and retained to preserve business records. This action cannot be easily undone.`,
      { confirmLabel: 'Delete', danger: true }
    );

    if (!confirmed) {
      return;
    }

    this.updatingUserId.set(user.userId);

    this.userService.deleteUser(user.userId).subscribe({
      next: () => {
        this.updatingUserId.set(null);
        this.toast.success(`"${user.name}" deleted.`);
        this.loadUsers();
      },
      error: (error: HttpErrorResponse) => {
        this.updatingUserId.set(null);
        const message = error.error?.message || `Unable to delete "${user.name}".`;
        this.toast.error(message);
      }
    });
  }

  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);

    this.userService.exportUsersCsv(this.searchTerm().trim() || undefined, this.roleFilter(), this.statusFilter()).subscribe({
      next: blob => {
        this.isExporting.set(false);
        downloadBlob(blob, 'users-export.csv');
      },
      error: (err: unknown) => {
        this.isExporting.set(false);
        blobErrorMessage(err, 'Unable to export users.').then(message => this.toast.error(message));
      }
    });
  }

  toggleSelectUser(userId: number): void {
    if (userId === this.currentUserId) return;
    this.selectedIds.update(current => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  toggleSelectAllPage(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      const pageIds = this.users()
        .filter(u => u.userId !== this.currentUserId)
        .map(u => u.userId);
      this.selectedIds.update(current => {
        const next = new Set(current);
        for (const id of pageIds) next.add(id);
        return next;
      });
    } else {
      const pageIds = new Set(this.users().map(u => u.userId));
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
    const ids = Array.from(this.selectedIds()).filter(id => id !== this.currentUserId);
    if (ids.length === 0 || this.isBulkUpdating()) return;

    const action = this.bulkAction();
    const count = ids.length;

    if (action === 'delete') {
      const confirmed = await this.confirmDialog.confirm(
        `Are you sure you want to delete ${count} selected user(s)? If any have order history, their accounts will be deactivated and retained to preserve business records.`,
        { confirmLabel: 'Delete Users', cancelLabel: 'Cancel', danger: true }
      );
      if (!confirmed) return;
    } else if (action === 'deactivate') {
      const confirmed = await this.confirmDialog.confirm(
        `Are you sure you want to deactivate ${count} selected user(s)? They will be logged out and unable to sign in.`,
        { confirmLabel: 'Deactivate Users', cancelLabel: 'Cancel', danger: true }
      );
      if (!confirmed) return;
    }

    this.isBulkUpdating.set(true);
    let successCount = 0;
    let failedCount = 0;

    for (const id of ids) {
      try {
        if (action === 'delete') {
          await firstValueFrom(this.userService.deleteUser(id));
        } else {
          await firstValueFrom(this.userService.updateUserStatus(id, action === 'activate'));
        }
        successCount++;
      } catch {
        failedCount++;
      }
    }

    this.isBulkUpdating.set(false);
    this.clearSelection();
    this.loadUsers();

    const actionVerb = action === 'delete' ? 'deleted' : action === 'activate' ? 'activated' : 'deactivated';
    if (successCount > 0 && failedCount === 0) {
      this.toast.success(`Successfully ${actionVerb} ${successCount} user(s).`);
    } else if (successCount > 0 && failedCount > 0) {
      this.toast.success(`Updated ${successCount} user(s); ${failedCount} could not be updated.`);
    } else if (failedCount > 0) {
      this.toast.error(`Unable to update ${failedCount} user(s).`);
    }
  }

  onViewOrder(orderId: number): void {
    const currentEmail = this.selectedCustomerEmail();
    this.previousCustomerEmailForOrder.set(currentEmail);
    this.selectedCustomerEmail.set(null); // Cleanly transition to order drawer without stacking
    this.selectedOrderId.set(orderId);
  }

  closeOrderDrawer(): void {
    this.selectedOrderId.set(null);
    this.previousCustomerEmailForOrder.set(null);
  }

  returnToCustomer360(customerEmail: string): void {
    this.selectedOrderId.set(null);
    this.previousCustomerEmailForOrder.set(null);
    this.selectedCustomerEmail.set(customerEmail);
  }
}
