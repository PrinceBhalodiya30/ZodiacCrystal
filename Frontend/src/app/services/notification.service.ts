import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { AppNotification, NotificationsResponse } from '../models/notification';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { API_BASE_URL } from './api-config';

export interface AdminOrderPlacedEvent {
  orderId: number;
  totalAmount: number;
  customerName: string | null;
  orderDate: string;
}

// Admin-only: an order, return, review, sign-up or subscriber changed (customer cancel, return request,
// another admin's action). Screens just reload what they show.
export interface AdminDataChangedEvent {
  kind: 'order' | 'return' | 'review' | 'user' | 'subscriber' | 'ticket';
  id: number;
  action: string;
}

export interface StockLevel {
  productId: number;
  stockQuantity: number;
}

const HUB_URL = `${API_BASE_URL.replace(/\/api\/?$/, '')}/hubs/notifications`;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  notifications = signal<AppNotification[]>([]);
  unreadCount = signal(0);

  // Bumped only when a notification arrives live over SignalR (not on the
  // initial load), so the bell can ring for genuinely new ones.
  liveArrivals = signal(0);

  // Admin-only: fires when any customer places an order, so admin screens
  // (dashboard, orders list) can refresh without a page reload.
  readonly adminOrderPlaced = new Subject<AdminOrderPlacedEvent>();
  readonly adminDataChanged = new Subject<AdminDataChangedEvent>();

  // Customer: one of their orders changed (status or return), by order id.
  readonly orderUpdated = new Subject<number>();
  // The store replied to / resolved one of this customer's support tickets.
  readonly ticketUpdated = new Subject<void>();

  // Anyone logged in: new stock levels after orders, cancellations or restocks.
  readonly stockChanged = new Subject<StockLevel[]>();

  private hubConnection: signalR.HubConnection | null = null;

  constructor() {
    // Connects/disconnects automatically as the user logs in/out, and
    // reconnects (with a fresh token) if a different user logs in without a
    // full page reload.
    effect(() => {
      const isLoggedIn = this.authService.isLoggedIn();

      if (isLoggedIn) {
        this.loadInitial();
        this.connect();
      } else {
        this.disconnect();
        this.notifications.set([]);
        this.unreadCount.set(0);
      }
    });
  }

  markAsRead(notificationId: number): void {
    this.http.put(`${API_BASE_URL}/Notifications/${notificationId}/read`, {}).subscribe(() => {
      this.notifications.update(items =>
        items.map(n => (n.notificationId === notificationId ? { ...n, isRead: true } : n))
      );
      this.unreadCount.update(count => Math.max(0, count - 1));
    });
  }

  markAllAsRead(): void {
    this.http.put(`${API_BASE_URL}/Notifications/read-all`, {}).subscribe(() => {
      this.notifications.update(items => items.map(n => ({ ...n, isRead: true })));
      this.unreadCount.set(0);
    });
  }

  private loadInitial(): void {
    this.http.get<NotificationsResponse>(`${API_BASE_URL}/Notifications`).subscribe(response => {
      this.notifications.set(response.items);
      this.unreadCount.set(response.unreadCount);
    });
  }

  private connect(): void {
    if (this.hubConnection) {
      return;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => this.authService.getToken() ?? '' })
      // Info-level logs print the connect URL, which carries ?access_token=...; keep tokens out of the console.
      .configureLogging(signalR.LogLevel.Warning)
      // Keep retrying (capped at 30s apart) instead of the default 4 attempts,
      // so a tab left open while the API restarts reconnects on its own.
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: ctx => Math.min(30000, 2000 * (ctx.previousRetryCount + 1))
      })
      .build();

    const connection = this.hubConnection;
    // Closed for good, or the first start failed (e.g. the API was down):
    // start a fresh connection shortly, unless this one was replaced/stopped
    // on purpose (logout) in the meantime.
    const retryLater = () => {
      if (this.hubConnection !== connection) {
        return;
      }
      this.hubConnection = null;
      setTimeout(() => {
        if (this.authService.isLoggedIn() && !this.authService.isSessionExpired()) {
          this.connect();
        }
      }, 5000);
    };
    connection.onclose(retryLater);

    this.hubConnection.on('ReceiveNotification', (notification: AppNotification) => {
      this.notifications.update(items => [notification, ...items]);
      this.unreadCount.update(count => count + 1);
      this.liveArrivals.update(n => n + 1);
      this.toastService.info(notification.title);

      if (notification.orderId && (notification.type === 'OrderStatusChanged' || notification.type === 'ReturnUpdated')) {
        this.orderUpdated.next(notification.orderId);
      }

      if (notification.type === 'TicketUpdated') {
        this.ticketUpdated.next();
      }
    });

    // A coupon was announced to all customers - update the bell badge without popping an intrusive toast
    this.hubConnection.on('CouponAnnounced', () => {
      this.loadInitial();
      this.liveArrivals.update(n => n + 1);
    });

    this.hubConnection.on('AdminDataChanged', (event: AdminDataChangedEvent) => this.adminDataChanged.next(event));
    this.hubConnection.on('StockChanged', (levels: StockLevel[]) => this.stockChanged.next(levels));

    this.hubConnection.on('AdminOrderPlaced', (event: AdminOrderPlacedEvent) => {
      this.toastService.success(`New order #${event.orderId}${event.customerName ? ` from ${event.customerName}` : ''}`);
      this.adminOrderPlaced.next(event);
    });

    connection.start().catch(error => {
      // The server rejected the token (expired, or no longer valid): retrying
      // with the same one can only fail, so end the session like a REST 401 does.
      if (error instanceof signalR.HttpError && error.statusCode === 401) {
        if (this.hubConnection === connection) {
          this.hubConnection = null;
        }
        this.authService.logout();
        this.authService.sessionExpired.next();
        return;
      }
      retryLater();
    });
  }

  private disconnect(): void {
    const connection = this.hubConnection;
    // Cleared first so the retry in connect() sees a deliberate stop.
    this.hubConnection = null;
    connection?.stop();
  }
}
