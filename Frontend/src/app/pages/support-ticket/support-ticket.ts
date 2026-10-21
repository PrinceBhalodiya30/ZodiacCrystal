import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SupportService } from '../../services/support.service';
import { NotificationService } from '../../services/notification.service';
import { ToastService } from '../../services/toast.service';
import { SUPPORT_MAX_PHOTOS, SUPPORT_REPLY_WITHIN_HOURS, SupportTicket } from '../../models/support-ticket';
import { Spinner } from '../../components/spinner/spinner';
import { TicketThread } from '../../components/ticket-thread/ticket-thread';
import { InrPipe } from '../../pipes/inr.pipe';
import { SITE_NAME } from '../../services/page-title.service';

// One support conversation: thread, reply box, "my problem is solved" and rating.
@Component({
  selector: 'app-support-ticket',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, Spinner, TicketThread, InrPipe],
  templateUrl: './support-ticket.html',
  styleUrl: './support-ticket.css'
})
export class SupportTicketPage implements OnInit {
  readonly siteName = SITE_NAME;
  private supportService = inject(SupportService);
  private toast = inject(ToastService);
  private ticketId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  readonly maxPhotos = SUPPORT_MAX_PHOTOS;
  readonly replyWithinHours = SUPPORT_REPLY_WITHIN_HOURS;

  ticket = signal<SupportTicket | null>(null);
  isLoading = signal(true);
  errorMessage = signal('');

  reply = '';
  files = signal<File[]>([]);
  isSending = signal(false);

  rating = signal(0);
  ratingComment = '';
  isRating = signal(false);

  constructor() {
    inject(NotificationService).ticketUpdated
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load(true));
  }

  ngOnInit(): void {
    this.load();
  }

  load(silent = false): void {
    if (!silent) {
      this.isLoading.set(true);
    }
    this.supportService.getTicket(this.ticketId).subscribe({
      next: ticket => {
        this.ticket.set(ticket);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(error.status === 404 ? 'Support request not found.' : 'Unable to load this request.');
        this.isLoading.set(false);
      }
    });
  }

  isActive(ticket: SupportTicket): boolean {
    return ticket.status === 'Open' || ticket.status === 'AwaitingCustomer';
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const combined = [...this.files(), ...Array.from(input.files ?? [])];
    input.value = '';
    if (combined.length > this.maxPhotos) {
      this.toast.error(`You can attach up to ${this.maxPhotos} photos.`);
    }
    this.files.set(combined.slice(0, this.maxPhotos));
  }

  removeFile(index: number): void {
    this.files.update(files => files.filter((_, i) => i !== index));
  }

  send(): void {
    const message = this.reply.trim();
    if (!message || this.isSending()) {
      return;
    }
    this.isSending.set(true);
    this.supportService.reply(this.ticketId, message, this.files()).subscribe({
      next: ticket => {
        this.ticket.set(ticket);
        this.reply = '';
        this.files.set([]);
        this.isSending.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isSending.set(false);
        this.toast.error(error.error?.message || 'Unable to send your message.');
      }
    });
  }

  markResolved(): void {
    this.supportService.markResolved(this.ticketId).subscribe({
      next: ticket => {
        this.ticket.set(ticket);
        this.toast.success('Glad we could help!');
      },
      error: (error: HttpErrorResponse) => this.toast.error(error.error?.message || 'Unable to update this request.')
    });
  }

  submitRating(): void {
    if (!this.rating() || this.isRating()) {
      return;
    }
    this.isRating.set(true);
    this.supportService.rate(this.ticketId, this.rating(), this.ratingComment.trim() || undefined).subscribe({
      next: ticket => {
        this.ticket.set(ticket);
        this.isRating.set(false);
        this.toast.success('Thanks for your feedback!');
      },
      error: (error: HttpErrorResponse) => {
        this.isRating.set(false);
        this.toast.error(error.error?.message || 'Unable to save your rating.');
      }
    });
  }
}
