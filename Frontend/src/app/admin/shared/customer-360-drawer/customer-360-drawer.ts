import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { OrderService } from '../../../services/order.service';
import { ReturnService } from '../../../services/return.service';
import { SupportService } from '../../../services/support.service';
import { AdminOrder } from '../../../models/order';
import { ReturnRequest } from '../../../models/return-request';
import { SupportTicket } from '../../../models/support-ticket';
import { InrPipe } from '../../../pipes/inr.pipe';
import { Spinner } from '../../../components/spinner/spinner';

@Component({
  selector: 'app-customer-360-drawer',
  standalone: true,
  imports: [InrPipe, DatePipe, Spinner],
  templateUrl: './customer-360-drawer.html',
  styleUrls: ['../../admin-shared.css', './customer-360-drawer.css']
})
export class Customer360Drawer implements OnChanges {
  private orderService = inject(OrderService);
  private returnService = inject(ReturnService);
  private supportService = inject(SupportService);

  @Input({ required: true }) customerEmail!: string;
  @Input() customerName?: string;
  @Input() customerRole?: string;
  @Input() customerSince?: string;

  @Output() closed = new EventEmitter<void>();
  @Output() viewOrder = new EventEmitter<number>();

  isLoading = signal(true);
  orders = signal<AdminOrder[]>([]);
  returns = signal<ReturnRequest[]>([]);
  tickets = signal<SupportTicket[]>([]);
  activeTab = signal<'orders' | 'returns' | 'tickets'>('orders');

  totalSpend = computed(() => {
    return this.orders()
      .filter(o => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  });

  averageOrderValue = computed(() => {
    const validOrders = this.orders().filter(o => o.status !== 'Cancelled');
    return validOrders.length > 0 ? this.totalSpend() / validOrders.length : 0;
  });

  displayName = computed(() => {
    if (this.customerName && this.customerName.trim()) {
      return this.customerName;
    }
    const firstOrder = this.orders()[0];
    return firstOrder?.customerName || this.customerEmail.split('@')[0];
  });

  avatarInitials = computed(() => {
    const name = this.displayName();
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['customerEmail'] && this.customerEmail) {
      this.loadAll();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  openOrder(orderId: number): void {
    this.viewOrder.emit(orderId);
  }

  loadAll(): void {
    this.isLoading.set(true);

    const email = this.customerEmail.trim();

    // Fetch Orders
    this.orderService.getAllOrdersAdminPaged(1, 50, email).subscribe({
      next: res => {
        const matched = (res.items || []).filter(
          o => o.customerEmail?.toLowerCase() === email.toLowerCase()
        );
        this.orders.set(matched.length > 0 ? matched : res.items || []);
        this.checkLoadingComplete();
      },
      error: () => {
        this.orders.set([]);
        this.checkLoadingComplete();
      }
    });

    // Fetch Returns
    this.returnService.getReturnsAdminPaged(1, 20, undefined, email).subscribe({
      next: res => {
        const matched = (res.items || []).filter(
          r => r.customerEmail?.toLowerCase() === email.toLowerCase()
        );
        this.returns.set(matched.length > 0 ? matched : res.items || []);
        this.checkLoadingComplete();
      },
      error: () => {
        this.returns.set([]);
        this.checkLoadingComplete();
      }
    });

    // Fetch Support Tickets
    this.supportService.getTicketsAdminPaged(1, 20, undefined, undefined, email).subscribe({
      next: res => {
        const matched = (res.items || []).filter(
          t => t.customerEmail?.toLowerCase() === email.toLowerCase()
        );
        this.tickets.set(matched.length > 0 ? matched : res.items || []);
        this.checkLoadingComplete();
      },
      error: () => {
        this.tickets.set([]);
        this.checkLoadingComplete();
      }
    });
  }

  private completedRequests = 0;
  private checkLoadingComplete(): void {
    this.completedRequests++;
    if (this.completedRequests >= 3) {
      this.isLoading.set(false);
      this.completedRequests = 0;
    }
  }
}
