import { Component, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReturnService } from '../../services/return.service';
import { ToastService } from '../../services/toast.service';
import { Order } from '../../models/order';
import { RETURN_REASONS, ReturnReason } from '../../models/return-request';

// Order details: lets the customer request a return while the backend says one
// is allowed (order.canRequestReturn), and shows the request's progress after.
@Component({
  selector: 'app-return-request-panel',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './return-request-panel.html',
  styleUrl: './return-request-panel.css'
})
export class ReturnRequestPanel {
  private returnService = inject(ReturnService);
  private toast = inject(ToastService);

  order = input.required<Order>();
  returnRequested = output<void>();

  readonly reasons = RETURN_REASONS;

  isFormOpen = signal(false);
  isSubmitting = signal(false);
  errorMessage = signal('');
  reason: ReturnReason | '' = '';
  details = '';

  statusText(status: string): string {
    switch (status) {
      case 'Requested': return 'We\'ve received your return request and will review it soon.';
      case 'Approved': return 'Your return is approved. Please send the items back with your order number - we\'ll refund you once they arrive.';
      case 'Rejected': return 'Your return request was not approved.';
      case 'Refunded': return 'Your return is complete and your refund has been issued.';
      default: return '';
    }
  }

  submit(): void {
    if (!this.reason) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.returnService
      .requestReturn({ orderId: this.order().orderId, reason: this.reason, details: this.details.trim() || undefined })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isFormOpen.set(false);
          this.toast.success('Return requested. We\'ll email you with updates.');
          this.returnRequested.emit();
        },
        error: error => {
          this.isSubmitting.set(false);
          this.errorMessage.set(error.error?.message || 'Unable to request a return right now. Please try again.');
        }
      });
  }
}
