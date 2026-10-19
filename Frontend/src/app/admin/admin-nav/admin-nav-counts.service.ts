import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { OrderService } from '../../services/order.service';
import { ReturnService } from '../../services/return.service';
import { ProductService } from '../../services/product.service';
import { SupportService } from '../../services/support.service';
import { NotificationService } from '../../services/notification.service';

// Sidebar badge counts. Kept in a root service so the numbers survive the nav
// being re-created on every admin page (no flicker back to empty).
@Injectable({ providedIn: 'root' })
export class AdminNavCountsService {
  private orderService = inject(OrderService);
  private returnService = inject(ReturnService);
  private productService = inject(ProductService);
  private supportService = inject(SupportService);

  private document = inject(DOCUMENT);

  pendingOrders = signal(0);
  requestedReturns = signal(0);
  // Products at or below the low-stock threshold (includes out of stock) -
  // the same rule as the Stock page's "Low stock only" filter and the dashboard.
  lowStock = signal(0);
  // Support tickets waiting on the store (status Open).
  openTickets = signal(0);

  // New orders that arrived while this tab wasn't being looked at; shown in
  // the tab title as "(2) New orders" until the admin comes back to the tab.
  private unseenOrders = 0;
  private baseTitle = this.document.title;
  private audioContext: AudioContext | null = null;

  constructor() {
    // Live: a customer placed an order (SignalR) - bump the badges everywhere.
    inject(NotificationService).adminOrderPlaced.subscribe(() => {
      this.refreshSoon();
      this.playChime();

      if (this.document.visibilityState !== 'visible') {
        if (this.unseenOrders === 0) {
          this.baseTitle = this.document.title;
        }
        this.unseenOrders += 1;
        this.document.title = `(${this.unseenOrders}) New ${this.unseenOrders === 1 ? 'order' : 'orders'} · ${this.baseTitle}`;
      }
    });

    // Live: a customer cancelled / requested a return, or another admin acted.
    inject(NotificationService).adminDataChanged.subscribe(() => this.refreshSoon());

    // Live: stock moved (an order, a restock, a stock edit) - keeps the Stock
    // badge current. This arrives as its own message, not an admin change.
    inject(NotificationService).stockChanged.subscribe(() => this.refreshSoon());

    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible' && this.unseenOrders > 0) {
        this.unseenOrders = 0;
        this.document.title = this.baseTitle;
      }
    });
  }

  // A short two-note chime made in code (no audio file). Browsers only allow
  // sound after the admin has interacted with the page, so failures are ignored.
  private playChime(): void {
    try {
      this.audioContext ??= new AudioContext();
      const ctx = this.audioContext;
      [880, 1320].forEach((frequency, i) => {
        const start = ctx.currentTime + i * 0.15;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.32);
      });
    } catch {
      // No sound available - the toast and badge still show the new order.
    }
  }

  // One order fires several live messages at once (order placed, stock changed,
  // ...); wait a moment and reload the badges once instead of 3 times.
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private refreshSoon(): void {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refresh(), 300);
  }

  refresh(): void {
    // Badges are a convenience: on failure just keep the last known numbers.
    this.orderService.getAllOrdersAdminPaged(1, 1, undefined, 'Pending').subscribe({
      next: result => this.pendingOrders.set(result.totalCount),
      error: () => {}
    });

    this.returnService.getReturnsAdmin('Requested').subscribe({
      next: returns => this.requestedReturns.set(returns.length),
      error: () => {}
    });

    this.supportService.getCountsAdmin().subscribe({
      next: counts => this.openTickets.set(counts.open),
      error: () => {}
    });

    this.productService.getProductsPaged(1, 1, undefined, null, false, null, null, null, false, null, true).subscribe({
      next: result => this.lowStock.set(result.totalCount),
      error: () => {}
    });
  }
}
