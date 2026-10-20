import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
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

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [Spinner, DatePipe, FormsModule, AdminNav, Pager],
  templateUrl: './users.html',
  styleUrls: ['../admin-shared.css', './users.css']
})
export class AdminUsers implements OnInit {
  private userService = inject(UserService);

  isExporting = signal(false);
  private authService = inject(AuthService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  users = signal<AdminUser[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  updatingUserId = signal<number | null>(null);

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
    this.onSearchInput.cancel();
    this.searchTerm.set(term);
    this.page.set(1);
    this.loadUsers();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadUsers();
  }

  clearFilters(): void {
    this.onSearchInput.cancel();
    this.searchTerm.set('');
    this.roleFilter.set('');
    this.statusFilter.set('');
    this.onFilterChange();
  }

  onPageChange(page: number): void {
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
}
