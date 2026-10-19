import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { GuestSessionService } from '../../services/guest-session.service';

// "Find my order" for guests who lost their order email: order number + email
// -> a fresh private link is emailed (the page never reveals whether they matched).
@Component({
  selector: 'app-find-order',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './find-order.html',
  styleUrl: './find-order.css'
})
export class FindOrder {
  private guestSession = inject(GuestSessionService);

  orderId = inject(ActivatedRoute).snapshot.queryParamMap.get('orderId') ?? '';
  email = '';
  isSending = signal(false);
  sentMessage = signal('');
  errorMessage = signal('');

  submit(): void {
    const id = Number(String(this.orderId).replace('#', '').trim());
    if (!id || !this.email.trim()) {
      this.errorMessage.set('Enter your order number and the email you used at checkout.');
      return;
    }
    this.isSending.set(true);
    this.errorMessage.set('');
    this.guestSession.findOrder(id, this.email.trim()).subscribe({
      next: response => {
        this.isSending.set(false);
        this.sentMessage.set(response.message);
      },
      error: (error: HttpErrorResponse) => {
        this.isSending.set(false);
        this.errorMessage.set(error.error?.message || 'Something went wrong. Please try again.');
      }
    });
  }
}
