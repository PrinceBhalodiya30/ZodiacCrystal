import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SupportService } from '../../services/support.service';
import { NotificationService } from '../../services/notification.service';
import { SupportTicket } from '../../models/support-ticket';
import { Spinner } from '../../components/spinner/spinner';

// My Account > Support: the customer's Help Center conversations.
@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [DatePipe, RouterLink, Spinner],
  templateUrl: './support-tickets.html',
  styleUrl: './support-tickets.css'
})
export class SupportTickets implements OnInit {
  private supportService = inject(SupportService);

  tickets = signal<SupportTicket[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  constructor() {
    // The store replied or resolved one - refresh the list in place.
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
    this.errorMessage.set('');
    this.supportService.getMyTickets().subscribe({
      next: tickets => {
        this.tickets.set(tickets);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load your support requests.');
        this.isLoading.set(false);
      }
    });
  }
}
