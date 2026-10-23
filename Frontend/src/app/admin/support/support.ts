import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, firstValueFrom } from 'rxjs';
import { AdminNav } from '../admin-nav/admin-nav';
import { AdminNavCountsService } from '../admin-nav/admin-nav-counts.service';
import { Spinner } from '../../components/spinner/spinner';
import { Pager } from '../../components/pager/pager';
import { TicketThread } from '../../components/ticket-thread/ticket-thread';
import { SupportService } from '../../services/support.service';
import { NotificationService } from '../../services/notification.service';
import { ToastService } from '../../services/toast.service';
import { SUPPORT_MAX_PHOTOS, SupportTicket, TICKET_CATEGORIES, TicketMessage, TicketStatus } from '../../models/support-ticket';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { InrPipe } from '../../pipes/inr.pipe';
import { debounced } from '../../utils/debounce.util';

const PAGE_SIZE = 20;

// Canned replies for the most common customer inquiries; inserted into the reply box to edit before sending.
const CANNED_REPLIES: { label: string; text: string }[] = [
  {
    label: 'Tracking Delay / In Transit',
    text: 'Thanks for reaching out! We checked with our courier partner, and your order is currently in transit. Occasional courier routing delays can take an extra 1-2 business days. You can track real-time milestones via the tracking link on your order page.'
  },
  {
    label: 'Damaged Item / Replacement',
    text: 'We are so sorry your crystal arrived damaged! Crystals are delicate gifts of nature. Please reply with a quick photo of the damaged piece and parcel packaging, and we will dispatch an immediate replacement or process a full refund right away.'
  },
  {
    label: 'Crystal Care & Cleansing Guide',
    text: 'Thank you for asking about crystal care! To cleanse your crystals without damaging them: use natural moonlight (especially Full Moon), incense smoke (sage/palo santo), or place them on a Selenite charging plate. Please avoid water for soft or iron-bearing minerals like Selenite, Malachite, and Pyrite.'
  },
  {
    label: 'Natural Stone Variation & Authenticity',
    text: 'Every natural crystal, geode, and mineral specimen is completely unique. Color saturation, internal inclusions, and size can vary naturally from studio photos. These natural variations are genuine signatures of authenticity from Mother Earth.'
  },
  {
    label: 'Start a Return',
    text: 'Sorry to hear that! Your order is within our 7-day return window. You can easily initiate a return directly from your Order Details page under your account, and our team will review and approve it immediately.'
  },
  {
    label: 'Refund Issued Notice',
    text: 'Your refund has been approved and processed. Depending on your bank or payment method, the credit should reflect on your statement within 5-7 business days.'
  }
];

@Component({
  selector: 'app-admin-support',
  standalone: true,
  imports: [AdminNav, Spinner, Pager, TicketThread, DatePipe, FormsModule, RouterLink, InrPipe],
  templateUrl: './support.html',
  styleUrls: ['../admin-shared.css', './support.css']
})
export class AdminSupport implements OnInit {
  private supportService = inject(SupportService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  private navCounts = inject(AdminNavCountsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly statuses: { value: string; label: string }[] = [
    { value: 'Active', label: 'Needs attention (open + awaiting)' },
    { value: 'Open', label: 'Open (waiting on us)' },
    { value: 'AwaitingCustomer', label: 'Awaiting customer' },
    { value: 'Resolved', label: 'Resolved' },
    { value: 'Closed', label: 'Closed' }
  ];
  readonly categories = TICKET_CATEGORIES;
  readonly cannedReplies = CANNED_REPLIES;
  readonly maxPhotos = SUPPORT_MAX_PHOTOS;
  private readonly defaultStatus = 'Active';

  tickets = signal<SupportTicket[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  statusFilter = signal(this.defaultStatus);
  categoryFilter = signal('');
  searchTerm = signal('');
  page = signal(1);
  totalPages = signal(1);
  totalCount = signal(0);
  hasFilters = computed(() => !!this.searchTerm().trim() || !!this.categoryFilter() || this.statusFilter() !== this.defaultStatus);
  onSearchInput = debounced((term: string) => this.onSearchChange(term));
  private loadSubscription?: Subscription;

  // Multi-select & Bulk toolbar state
  selectedIds = signal<Set<number>>(new Set());
  selectedCount = computed(() => this.selectedIds().size);
  pageAllSelected = computed(() => {
    const items = this.tickets();
    return items.length > 0 && items.every(t => this.selectedIds().has(t.supportTicketId));
  });
  bulkAction = signal<'Resolved' | 'Closed' | 'Open'>('Resolved');
  isBulkUpdating = signal(false);

  // Open conversation
  selected = signal<SupportTicket | null>(null);
  isLoadingTicket = signal(false);
  reply = '';
  isInternal = false;
  files = signal<File[]>([]);
  isSending = signal(false);

  constructor() {
    // New tickets, customer replies, or another admin's action.
    inject(NotificationService).adminDataChanged
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        if (event.kind === 'ticket') {
          this.loadTickets(true);
          const open = this.selected();
          if (open && open.supportTicketId === event.id && event.action !== 'read') {
            this.openTicket(open.supportTicketId, true);
          }
        }
      });
  }

  ngOnInit(): void {
    this.loadTickets();
    // ?ticket=12 (from the admin alert email or the bell) opens that ticket.
    const ticketId = Number(this.route.snapshot.queryParamMap.get('ticket'));
    if (ticketId) {
      this.openTicket(ticketId);
    }
  }

  onStatusFilterChange(status: string): void {
    this.clearSelection();
    this.statusFilter.set(status);
    this.page.set(1);
    this.loadTickets();
  }

  onCategoryFilterChange(category: string): void {
    this.clearSelection();
    this.categoryFilter.set(category);
    this.page.set(1);
    this.loadTickets();
  }

  onSearchChange(term: string): void {
    this.clearSelection();
    this.onSearchInput.cancel();
    this.searchTerm.set(term);
    this.page.set(1);
    this.loadTickets();
  }

  clearFilters(): void {
    this.clearSelection();
    this.closePanel();
    this.onSearchInput.cancel();
    this.searchTerm.set('');
    this.categoryFilter.set('');
    this.onStatusFilterChange(this.defaultStatus);
  }

  onPageChange(page: number): void {
    this.clearSelection();
    this.page.set(page);
    this.loadTickets();
  }

  loadTickets(silent = false): void {
    if (!silent) {
      this.isLoading.set(true);
    }
    this.errorMessage.set('');
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.supportService
      .getTicketsAdminPaged(this.page(), PAGE_SIZE, this.statusFilter() || undefined, this.categoryFilter() || undefined, this.searchTerm().trim() || undefined)
      .subscribe({
        next: result => {
          if (result.items.length === 0 && this.page() > 1) {
            this.page.set(Math.max(1, result.totalPages));
            this.loadTickets(silent);
            return;
          }
          this.tickets.set(result.items);
          this.totalPages.set(result.totalPages || 1);
          this.totalCount.set(result.totalCount);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load support tickets.');
          this.isLoading.set(false);
        }
      });
  }

  openTicket(id: number, silent = false): void {
    if (!silent) {
      this.isLoadingTicket.set(true);
      this.reply = '';
      this.isInternal = false;
      this.files.set([]);
    }
    this.router.navigate([], { queryParams: { ticket: id }, queryParamsHandling: 'merge', replaceUrl: true });
    this.supportService.getTicketAdmin(id).subscribe({
      next: ticket => {
        this.selected.set(ticket);
        this.isLoadingTicket.set(false);
        // Opening marks it read - drop the unread dot and badge right away.
        this.tickets.update(list => list.map(t => (t.supportTicketId === id ? { ...t, unread: false } : t)));
        this.navCounts.refresh();
      },
      error: () => {
        this.isLoadingTicket.set(false);
        this.toast.error('Unable to open this ticket.');
      }
    });
  }

  closePanel(): void {
    this.selected.set(null);
    this.router.navigate([], { queryParams: { ticket: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  useCanned(text: string): void {
    const name = this.selected()?.customerName.split(' ')[0];
    this.reply = `${name ? 'Hi ' + name + ',\n\n' : ''}${text}`;
    this.isInternal = false;
  }

  onSelectCanned(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    if (value) {
      this.useCanned(value);
      select.selectedIndex = 0; // Reset to placeholder so user can pick again if needed
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const combined = [...this.files(), ...Array.from(input.files ?? [])];
    input.value = '';
    this.files.set(combined.slice(0, this.maxPhotos));
  }

  removeFile(index: number): void {
    this.files.update(files => files.filter((_, i) => i !== index));
  }

  // resolve: send the reply and mark the ticket resolved in one step.
  send(resolve = false): void {
    const ticket = this.selected();
    const message = this.reply.trim();
    if (!ticket || !message || this.isSending()) {
      return;
    }
    this.isSending.set(true);
    this.supportService
      .replyAdmin(ticket.supportTicketId, message, {
        isInternal: this.isInternal,
        status: this.isInternal ? undefined : resolve ? 'Resolved' : 'AwaitingCustomer',
        files: this.files()
      })
      .subscribe({
        next: updated => {
          this.selected.set(updated);
          this.reply = '';
          this.files.set([]);
          this.isSending.set(false);
          this.toast.success(this.isInternal ? 'Note added.' : resolve ? 'Reply sent and ticket resolved.' : 'Reply sent to the customer.');
          this.isInternal = false;
          this.loadTickets(true);
          this.navCounts.refresh();
        },
        error: (error: HttpErrorResponse) => {
          this.isSending.set(false);
          this.toast.error(error.error?.message || 'Unable to send the reply.');
        }
      });
  }

  editMessage(messageId: number, body: string): void {
    const ticket = this.selected();
    if (!ticket) {
      return;
    }
    this.isSending.set(true);
    this.supportService.editMessageAdmin(ticket.supportTicketId, messageId, body).subscribe({
      next: updated => {
        this.selected.set(updated);
        this.isSending.set(false);
        this.toast.success('Message updated. The customer sees the new text (no new email is sent).');
      },
      error: (error: HttpErrorResponse) => {
        this.isSending.set(false);
        this.toast.error(error.error?.message || 'Unable to edit this message.');
        this.openTicket(ticket.supportTicketId, true);
      }
    });
  }

  async deleteMessage(message: TicketMessage): Promise<void> {
    const ticket = this.selected();
    if (!ticket) {
      return;
    }
    const confirmed = await this.confirmDialog.confirm(
      message.isInternal
        ? 'Delete this internal note?'
        : 'Delete this reply? The customer will see "This message was removed". Any email already sent can\'t be recalled.',
      { confirmLabel: 'Delete', danger: true }
    );
    if (!confirmed) {
      return;
    }
    this.isSending.set(true);
    this.supportService.deleteMessageAdmin(ticket.supportTicketId, message.ticketMessageId).subscribe({
      next: updated => {
        this.selected.set(updated);
        this.isSending.set(false);
        this.toast.success(message.isInternal ? 'Note deleted.' : 'Reply removed.');
        this.loadTickets(true);
      },
      error: (error: HttpErrorResponse) => {
        this.isSending.set(false);
        this.toast.error(error.error?.message || 'Unable to delete this message.');
        this.openTicket(ticket.supportTicketId, true);
      }
    });
  }

  setStatus(status: TicketStatus): void {
    const ticket = this.selected();
    if (!ticket) {
      return;
    }
    this.supportService.updateStatusAdmin(ticket.supportTicketId, status).subscribe({
      next: updated => {
        this.selected.set(updated);
        this.toast.success(`Ticket ${updated.reference} is now ${updated.statusLabel.toLowerCase()}.`);
        this.loadTickets(true);
        this.navCounts.refresh();
      },
      error: (error: HttpErrorResponse) => this.toast.error(error.error?.message || 'Unable to update the ticket.')
    });
  }

  toggleSelectTicket(ticketId: number): void {
    this.selectedIds.update(current => {
      const next = new Set(current);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  }

  toggleSelectAllPage(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      const pageIds = this.tickets().map(t => t.supportTicketId);
      this.selectedIds.update(current => {
        const next = new Set(current);
        for (const id of pageIds) next.add(id);
        return next;
      });
    } else {
      const pageIds = new Set(this.tickets().map(t => t.supportTicketId));
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
    if (action === 'Closed') {
      const confirmed = await this.confirmDialog.confirm(
        `Are you sure you want to close ${ids.length} selected ticket(s)?`,
        { confirmLabel: 'Close Tickets', cancelLabel: 'Keep Open', danger: true }
      );
      if (!confirmed) return;
    }

    this.isBulkUpdating.set(true);
    let successCount = 0;
    let failedCount = 0;

    for (const id of ids) {
      try {
        await firstValueFrom(this.supportService.updateStatusAdmin(id, action));
        successCount++;
      } catch {
        failedCount++;
      }
    }

    this.isBulkUpdating.set(false);
    this.clearSelection();
    this.loadTickets(true);
    this.navCounts.refresh();

    if (successCount > 0 && failedCount === 0) {
      this.toast.success(`Updated status to ${action} for ${successCount} ticket(s).`);
    } else if (successCount > 0 && failedCount > 0) {
      this.toast.success(`Updated ${successCount} ticket(s); ${failedCount} could not be updated.`);
    } else if (failedCount > 0) {
      this.toast.error(`Unable to update ${failedCount} ticket(s).`);
    }
  }
}
