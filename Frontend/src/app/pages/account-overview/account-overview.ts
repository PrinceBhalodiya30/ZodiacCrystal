import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { AddressService } from '../../services/address.service';
import { WishlistService } from '../../services/wishlist.service';
import { OrderSummary } from '../../models/order';

const PROGRESS_STEPS = [
  { status: 'Pending', label: 'Placed' },
  { status: 'Confirmed', label: 'Confirmed' },
  { status: 'Shipped', label: 'Shipped' },
  { status: 'Delivered', label: 'Delivered' }
];

const RECENT_LIMIT = 3;

// My Account > Overview (/profile): greeting, quick stats, where the latest
// order is, and the few before it.
import { InrPipe } from '../../pipes/inr.pipe';
@Component({
  selector: 'app-account-overview',
  standalone: true,
  imports: [InrPipe, RouterLink, DatePipe],
  templateUrl: './account-overview.html',
  styleUrl: './account-overview.css'
})
export class AccountOverview implements OnInit {
  authService = inject(AuthService);
  wishlistService = inject(WishlistService);
  private orderService = inject(OrderService);
  private addressService = inject(AddressService);

  orders = signal<OrderSummary[]>([]);
  isLoadingOrders = signal(true);
  ordersError = signal(false);
  addressCount = signal<number | null>(null);

  firstName = computed(() => this.authService.currentUser()?.name?.trim().split(/\s+/)[0] ?? '');

  latestOrder = computed(() => this.orders()[0] ?? null);
  recentOrders = computed(() => this.orders().slice(1, RECENT_LIMIT + 1));

  // Cancelled orders don't count toward what the customer has spent.
  totalSpent = computed(() =>
    this.orders()
      .filter(o => o.status !== 'Cancelled' && o.paymentStatus !== 'Refunded')
      .reduce((sum, o) => sum + o.totalAmount, 0)
  );

  ngOnInit(): void {
    if (this.authService.isAdmin()) {
      this.isLoadingOrders.set(false);
      return;
    }

    this.loadOrders();

    this.addressService.getAddresses().subscribe({
      next: addresses => this.addressCount.set(addresses.length),
      error: () => this.addressCount.set(null)
    });
  }

  loadOrders(): void {
    this.isLoadingOrders.set(true);
    this.ordersError.set(false);

    this.orderService.getMyOrders().subscribe({
      next: orders => {
        // Newest first, whatever order the API returns them in.
        this.orders.set([...orders].sort((a, b) => b.orderDate.localeCompare(a.orderDate)));
        this.isLoadingOrders.set(false);
      },
      error: () => {
        this.ordersError.set(true);
        this.isLoadingOrders.set(false);
      }
    });
  }

  greeting(): string {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  }

  // Placed → Confirmed → Shipped → Delivered, marking how far this order has got.
  progressFor(order: OrderSummary): { label: string; state: 'done' | 'current' | 'upcoming' }[] {
    const reached = PROGRESS_STEPS.findIndex(s => s.status === order.status);
    return PROGRESS_STEPS.map((step, index) => ({
      label: step.label,
      state: index < reached ? 'done' : index === reached ? (order.status === 'Delivered' ? 'done' : 'current') : 'upcoming'
    }));
  }

  // "Rose Quartz" or "Rose Quartz + 2 more"; falls back to the order number.
  orderTitle(order: OrderSummary): string {
    const names = order.productNames ?? [];
    if (names.length === 0) {
      return `Order #${order.orderId}`;
    }
    return names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`;
  }

  statusMessage(order: OrderSummary): string {
    switch (order.status) {
      case 'Pending':
        return "We've received your order and will confirm it shortly.";
      case 'Confirmed':
        return 'Your order is confirmed and being packed.';
      case 'Shipped':
        return 'Your order is on its way.';
      case 'Delivered':
        return 'Delivered - we hope you love your crystals.';
      case 'Cancelled':
        return order.paymentStatus === 'Refunded'
          ? 'This order was cancelled and your payment refunded.'
          : 'This order was cancelled.';
      default:
        return '';
    }
  }
}
