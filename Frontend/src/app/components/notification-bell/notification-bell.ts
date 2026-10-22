import { Component, DestroyRef, ElementRef, HostListener, Input, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { AppNotification } from '../../models/notification';
import { ToastService } from '../../services/toast.service';

export type NotificationKind =
  | 'placed'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'stock'
  | 'restock'
  | 'price'
  | 'return'
  | 'welcome'
  | 'coupon'
  | 'general';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.css'
})
export class NotificationBell {
  @Input() align: 'left' | 'right' = 'right';

  service = inject(NotificationService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private toast = inject(ToastService);

  isOpen = signal(false);
  isRinging = signal(false);

  // Snapshot of "now" for the relative times; refreshed whenever the dropdown
  // opens (and every minute while it stays open), not on every change detection.
  private now = signal(Date.now());
  private nowTimer: ReturnType<typeof setInterval> | null = null;
  private ringTimer: ReturnType<typeof setTimeout> | null = null;

  badgeText = computed(() => {
    const count = this.service.unreadCount();
    return count > 9 ? '9+' : String(count);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.close();
      if (this.ringTimer) {
        clearTimeout(this.ringTimer);
      }
    });

    let lastSeen = this.service.liveArrivals();

    effect(() => {
      const arrivals = this.service.liveArrivals();
      if (arrivals > lastSeen) {
        untracked(() => this.ring());
      }
      lastSeen = arrivals;
    });
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.now.set(Date.now());
      this.nowTimer = setInterval(() => this.now.set(Date.now()), 60_000);
      this.isOpen.set(true);
    }
  }

  close(): void {
    this.isOpen.set(false);
    if (this.nowTimer) {
      clearInterval(this.nowTimer);
      this.nowTimer = null;
    }
  }

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (this.isOpen() && !this.elementRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  open(notification: AppNotification): void {
    if (!notification.isRead) {
      this.service.markAsRead(notification.notificationId);
    }

    this.close();

    if (notification.type === 'LowStock') {
      this.router.navigate(['/admin/stock'], { queryParams: { lowStock: 1 } });
    } else if (notification.type === 'Coupon') {
      this.copyCouponCode(notification.couponCode);
      this.router.navigate(['/cart']);
    } else if (notification.type === 'Welcome') {
      this.router.navigate(['/zodiac']);
    } else if (notification.type === 'TicketUpdated') {
      this.router.navigate(['/support']);
    } else if (notification.type === 'SupportTicket') {
      this.router.navigate(['/admin/support']);
    } else if (notification.productId) {
      this.router.navigate(['/products', notification.productId]);
    } else if (notification.orderId) {
      this.router.navigate(['/orders', notification.orderId]);
    }
  }

  markAllAsRead(): void {
    this.service.markAllAsRead();
  }

  // Status-change notifications carry the new status in their message
  // ("Amethyst Bracelet is now Shipped." / "... + 2 more items are now
  // Shipped."), which picks the matching icon.
  kindOf(notification: AppNotification): NotificationKind {
    if (notification.type === 'OrderPlaced') {
      return 'placed';
    }

    if (notification.type === 'LowStock') {
      return 'stock';
    }

    if (notification.type === 'ReturnUpdated') {
      return 'return';
    }

    if (notification.type === 'TicketUpdated' || notification.type === 'SupportTicket') {
      return 'welcome';
    }

    if (notification.type === 'Welcome') {
      return 'welcome';
    }

    if (notification.type === 'Coupon') {
      return 'coupon';
    }

    if (notification.type === 'BackInStock') {
      return 'restock';
    }

    if (notification.type === 'PriceDrop') {
      return 'price';
    }

    const status = /(?:is|are) now (\w+)/i.exec(notification.message)?.[1]?.toLowerCase();

    switch (status) {
      case 'confirmed':
      case 'shipped':
      case 'delivered':
      case 'cancelled':
        return status;
      default:
        return 'general';
    }
  }

  timeAgo(createdAt: string): string {
    const seconds = Math.max(0, Math.floor((this.now() - new Date(createdAt).getTime()) / 1000));

    if (seconds < 60) return 'Just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;

    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;

    return new Date(createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private copyCouponCode(code: string | null | undefined): void {
    if (!code) {
      return;
    }
    navigator.clipboard?.writeText(code).then(
      () => this.toast.success(`Code ${code} copied - paste it at checkout.`),
      () => this.toast.success(`Use code ${code} at checkout.`)
    ) ?? this.toast.success(`Use code ${code} at checkout.`);
  }

  private ring(): void {
    this.isRinging.set(false);
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
    }
    // Re-applying the class on the next frame restarts the animation even if
    // two notifications arrive back to back.
    requestAnimationFrame(() => {
      this.isRinging.set(true);
      this.ringTimer = setTimeout(() => this.isRinging.set(false), 1000);
    });
  }
}
