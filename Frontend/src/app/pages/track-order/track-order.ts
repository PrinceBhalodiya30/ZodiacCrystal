import { AuthService } from '../../services/auth.service';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { OrderService } from '../../services/order.service';
import { ToastService } from '../../services/toast.service';
import { Order } from '../../models/order';
import { Spinner } from '../../components/spinner/spinner';

interface TrackingStep {
  title: string;
  detail: string;
  at: string | null;
  state: 'completed' | 'current' | 'upcoming';
}

const STEP_ORDER = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];

// In-site package tracking. The courier and tracking number are demo data
// entered by the admin, so the steps come from our own order status - and
// update live when the admin changes it.
@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [Breadcrumbs, Spinner, RouterLink, DatePipe],
  templateUrl: './track-order.html',
  styleUrl: './track-order.css'
})
export class TrackOrder implements OnInit {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);
  private toast = inject(ToastService);

  readonly orderId = Number(this.route.snapshot.paramMap.get('id'));
  // Guest order link (/order/:id/track): back link instead of My Account breadcrumbs.
  readonly isGuestView = !inject(AuthService).isLoggedIn();

  order = signal<Order | null>(null);
  isLoading = signal(true);
  errorMessage = signal('');

  isCancelled = computed(() => this.order()?.status === 'Cancelled');

  steps = computed<TrackingStep[]>(() => {
    const o = this.order();
    if (!o) {
      return [];
    }

    const currentIndex = STEP_ORDER.indexOf(o.status);
    const delivered = o.status === 'Delivered';
    const raw = [
      { title: 'Order placed', detail: 'We have received your order.', at: o.orderDate },
      { title: 'Confirmed', detail: 'Your crystals are being packed.', at: o.confirmedAt ?? null },
      { title: 'Shipped', detail: `Handed over to ${o.courierName ?? 'the courier'}.`, at: o.shippedAt ?? null },
      { title: 'Delivered', detail: 'Your package has been delivered.', at: o.deliveredAt ?? null }
    ];

    return raw.map((step, index) => ({
      ...step,
      at: index <= currentIndex ? step.at : null,
      state: index < currentIndex || delivered ? 'completed' : index === currentIndex ? 'current' : 'upcoming'
    }));
  });

  constructor() {
    // An admin changed this order - refresh quietly.
    inject(NotificationService).orderUpdated
      .pipe(takeUntilDestroyed())
      .subscribe(orderId => {
        if (orderId === this.orderId) {
          this.load(true);
        }
      });
  }

  ngOnInit(): void {
    this.load();
  }

  // silent: refresh in place (live updates) without swapping in the spinner.
  load(silent = false): void {
    if (!silent) {
      this.isLoading.set(true);
    }

    this.orderService.getOrder(this.orderId).subscribe({
      next: order => {
        this.order.set(order);
        this.errorMessage.set('');
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Order not found.');
        this.isLoading.set(false);
      }
    });
  }

  async copyTrackingNumber(trackingNumber: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      this.toast.success('Tracking number copied.');
    } catch {
      this.toast.error('Could not copy the tracking number.');
    }
  }
}
