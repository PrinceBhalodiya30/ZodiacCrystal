import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NewsletterService } from '../../services/newsletter.service';
import { NewsletterStats, NewsletterStatusFilter, NewsletterSubscriber } from '../../models/newsletter-subscriber';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { AdminNav } from '../admin-nav/admin-nav';
import { Spinner } from '../../components/spinner/spinner';
import { Pager } from '../../components/pager/pager';
import { debounced } from '../../utils/debounce.util';
import { blobErrorMessage, downloadBlob } from '../../utils/download.util';
import { ToastService } from '../../services/toast.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../services/notification.service';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-newsletter-subscribers',
  standalone: true,
  imports: [Spinner, DatePipe, FormsModule, AdminNav, Pager],
  templateUrl: './newsletter-subscribers.html',
  styleUrls: ['../admin-shared.css', './newsletter-subscribers.css']
})
export class AdminNewsletterSubscribers implements OnInit {
  private newsletterService = inject(NewsletterService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  isExporting = signal(false);

  subscribers = signal<NewsletterSubscriber[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  page = signal(1);
  totalPages = signal(1);
  totalCount = signal(0);
  searchTerm = signal('');
  // Active by default - that's the list you can actually email.
  statusFilter = signal<NewsletterStatusFilter>('active');
  hasFilters = computed(() => !!this.searchTerm().trim() || this.statusFilter() !== 'active');

  // Export button names the list it will download, e.g. "Export Active (12)".
  exportLabel = computed(() => ({ active: 'Active', unsubscribed: 'Unsubscribed', all: 'All' })[this.statusFilter()]);

  stats = signal<NewsletterStats | null>(null);
  removingId = signal<number | null>(null);

  private loadSubscription?: Subscription;
  // Typing searches once the admin pauses, instead of on every keystroke.
  onSearchInput = debounced((term: string) => this.onSearchChange(term));

  constructor() {
    // Someone just subscribed (SignalR) - reload the list.
    inject(NotificationService).adminDataChanged
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        if (event.kind === 'subscriber') {
          this.loadSubscribers();
          this.loadStats();
        }
      });
  }

  ngOnInit(): void {
    this.loadSubscribers();
    this.loadStats();
  }

  loadStats(): void {
    this.newsletterService.getStatsAdmin().subscribe({
      next: stats => this.stats.set(stats),
      // Stats are a bonus - the list still works without them.
      error: () => this.stats.set(null)
    });
  }

  clearFilters(): void {
    this.onSearchInput.cancel();
    this.searchTerm.set('');
    this.onStatusChange('active');
  }

  onStatusChange(status: NewsletterStatusFilter): void {
    this.statusFilter.set(status);
    this.page.set(1);
    this.loadSubscribers();
  }

  async removeSubscriber(subscriber: NewsletterSubscriber): Promise<void> {
    const confirmed = await this.confirmDialog.confirm(
      `Remove ${subscriber.email} from the newsletter? They'll be marked as unsubscribed and left out of future exports.`,
      { confirmLabel: 'Remove', danger: true }
    );
    if (!confirmed) {
      return;
    }

    this.removingId.set(subscriber.newsletterSubscriberId);
    this.newsletterService.unsubscribeAdmin(subscriber.newsletterSubscriberId).subscribe({
      next: () => {
        this.removingId.set(null);
        this.toast.success(`${subscriber.email} removed from the newsletter.`);
        this.loadSubscribers();
        this.loadStats();
      },
      error: () => {
        this.removingId.set(null);
        this.toast.error('Unable to remove this subscriber.');
      }
    });
  }

  onSearchChange(term: string): void {
    this.onSearchInput.cancel();
    this.searchTerm.set(term);
    this.page.set(1);
    this.loadSubscribers();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadSubscribers();
  }

  loadSubscribers(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    // A newer load (next page, new search) replaces any request still in flight.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.newsletterService
      .getSubscribersAdminPaged(this.page(), PAGE_SIZE, this.searchTerm().trim() || undefined, this.statusFilter())
      .subscribe({
        next: result => {
          // Removing the last row on the last page leaves it empty; step back a page.
          if (result.items.length === 0 && this.page() > 1) {
            this.page.set(Math.max(1, result.totalPages));
            this.loadSubscribers();
            return;
          }
          this.subscribers.set(result.items);
          this.totalPages.set(result.totalPages || 1);
          this.totalCount.set(result.totalCount);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load newsletter subscribers.');
          this.isLoading.set(false);
        }
      });
  }

  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);

    this.newsletterService.exportSubscribersCsv(this.searchTerm().trim() || undefined, this.statusFilter()).subscribe({
      next: blob => {
        this.isExporting.set(false);
        // File name says which list it is, matching the filter on screen.
        downloadBlob(blob, `newsletter-subscribers-${this.statusFilter()}.csv`);
      },
      error: (err: unknown) => {
        this.isExporting.set(false);
        blobErrorMessage(err, 'Unable to export subscribers.').then(message => this.toast.error(message));
      }
    });
  }
}
