import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';
import { UserService } from '../../services/user.service';
import { ReturnService } from '../../services/return.service';
import { ReportService } from '../../services/report.service';
import { ToastService } from '../../services/toast.service';
import { OrderDetailDrawer } from '../orders/order-detail-drawer/order-detail-drawer';
import { buildSalesSeries, previousRange, toDateKey } from '../../utils/sales-series.util';
import { AreaChart, AreaChartPoint } from '../../components/charts/area-chart/area-chart';
import { AuthService } from '../../services/auth.service';
import { DailySales } from '../../models/report';
import { NotificationService } from '../../services/notification.service';
import { Product } from '../../models/product';
import { AdminOrder } from '../../models/order';
import { getStockStatus, getStockLabel } from '../../utils/stock-status.util';
import { AdminNav } from '../admin-nav/admin-nav';
import { CountUpDirective } from '../../directives/count-up.directive';
import { InrPipe } from '../../pipes/inr.pipe';
import { StoreInsights } from './store-insights/store-insights';

const LOW_STOCK_DISPLAY_LIMIT = 8;
const RECENT_ORDERS_LIMIT = 8;

// One "needs attention" card at the top of the dashboard; links to the list it counts.
export interface ActionCard {
  key: string;
  count: number;
  label: string;
  cta: string;
  link: string;
  queryParams?: Record<string, string>;
  tone: 'brand' | 'info' | 'warning' | 'danger';
  // Extra line under the label, e.g. "oldest waiting 2 days".
  note?: string;
}

const DEFAULT_RESTOCK_QUANTITY = 10;
const NEW_ORDER_HIGHLIGHT_MS = 8000;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [InrPipe, RouterLink, DatePipe, FormsModule, AdminNav, CountUpDirective, OrderDetailDrawer, AreaChart, StoreInsights],
  templateUrl: './dashboard.html',
  styleUrls: ['../admin-shared.css', './dashboard.css']
})
export class Dashboard implements OnInit {
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private userService = inject(UserService);
  private returnService = inject(ReturnService);
  private reportService = inject(ReportService);
  private toast = inject(ToastService);
  private authService = inject(AuthService);

  dayPart(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  }

  greeting(): string {
    const part = this.dayPart();
    const name = this.authService.currentUser()?.name;
    return name ? `Good ${part}, ${name}` : `Good ${part}`;
  }

  readonly todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  constructor() {
    // A customer just placed an order (pushed over SignalR) - refresh quietly.
    inject(NotificationService).adminOrderPlaced
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        this.markNew(event.orderId);
        this.load(true);
      });

    // Cancellations, return requests and other admins' changes.
    inject(NotificationService).adminDataChanged
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load(true));


    // Restocks and stock edits change the low-stock list.
    inject(NotificationService).stockChanged
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load(true));
  }

  // Orders that just arrived live; their Recent orders rows are highlighted briefly.
  newOrderIds = signal<ReadonlySet<number>>(new Set());

  private markNew(orderId: number): void {
    this.newOrderIds.update(ids => new Set(ids).add(orderId));
    setTimeout(() => {
      this.newOrderIds.update(ids => {
        const next = new Set(ids);
        next.delete(orderId);
        return next;
      });
    }, NEW_ORDER_HIGHLIGHT_MS);
  }

  // Placeholder rows for the loading skeleton.
  readonly skeletonRows = [1, 2, 3, 4, 5];

  isLoading = signal(true);
  errorMessage = signal('');

  totalProducts = signal<number | null>(null);
  totalOrders = signal<number | null>(null);
  totalUsers = signal<number | null>(null);
  totalRevenue = signal<number | null>(null);

  // "Today" strip next to the heading; refreshed live with each new order.
  // Orders that count as sales (not cancelled/refunded), matching the revenue,
  // average and sales chart; cancelled ones are shown separately underneath.
  todayOrders = signal<number | null>(null);
  todayCancelled = signal(0);
  todayRevenue = signal<number | null>(null);
  yesterdayRevenue = signal<number | null>(null);
  todayAverage = signal<number | null>(null);

  // Sales overview: the last 7 days, from the same endpoint the Reports page uses.
  // null = failed to load (the panel says so instead of showing an empty chart).
  private weekSales = signal<DailySales[] | null>(null);
  private previousWeekSales = signal<DailySales[] | null>(null);
  private weekRange = signal<{ from: string; to: string } | null>(null);

  // The 7 days before, drawn dashed behind this week (null = not loaded).
  weekPrevious = computed<number[] | null>(() => {
    const sales = this.previousWeekSales();
    const range = this.weekRange();
    if (!sales || !range) {
      return null;
    }
    const prev = previousRange(range.from, range.to);
    return buildSalesSeries(sales, prev.from, prev.to, 'day').map(bucket => bucket.revenue);
  });

  weekChart = computed<AreaChartPoint[] | null>(() => {
    const sales = this.weekSales();
    const range = this.weekRange();
    if (!sales || !range) {
      return null;
    }
    return buildSalesSeries(sales, range.from, range.to, 'day').map(bucket => ({
      label: bucket.label,
      value: bucket.revenue,
      details: bucket.orders ? [`${bucket.orders} order${bucket.orders === 1 ? '' : 's'}`] : ['No orders']
    }));
  });

  weekRevenue = computed(() => (this.weekSales() ?? []).reduce((sum, d) => sum + d.revenue, 0));
  weekOrders = computed(() => (this.weekSales() ?? []).reduce((sum, d) => sum + d.orderCount, 0));

  // Revenue change vs yesterday, in whole percent; null when there's nothing to compare against.
  todayChangePercent = computed(() => {
    const today = this.todayRevenue();
    const yesterday = this.yesterdayRevenue();
    if (today === null || yesterday === null || yesterday === 0) {
      return null;
    }
    return Math.round(((today - yesterday) / yesterday) * 100);
  });

  // When the oldest still-Pending order was placed (null = none waiting).
  oldestPendingDate = signal<string | null>(null);

  // Recent order opened in the detail drawer.
  openOrderId = signal<number | null>(null);

  // Low-stock row with the inline "+ Add stock" box open.
  restockProductId = signal<number | null>(null);
  restockQuantity = DEFAULT_RESTOCK_QUANTITY;
  isRestocking = signal(false);

  lowStockProducts = signal<Product[]>([]);
  recentOrders = signal<AdminOrder[]>([]);

  // To-do counts (null until loaded, so a failed request doesn't read as "0 to do").
  pendingOrders = signal<number | null>(null);
  ordersToShip = signal<number | null>(null);
  returnsToReview = signal<number | null>(null);
  refundsDue = signal<number | null>(null);
  stockAlerts = signal<number | null>(null);
  overdueDeliveries = signal<number | null>(null);

  // Bumped on every (live) reload so Store insights refreshes with the rest.
  refreshTick = signal(0);

  actionCards = computed<ActionCard[]>(() => {
    const cards: (ActionCard | null)[] = [
      this.card('pending-orders', this.pendingOrders(), 'new order', 'new orders', 'to confirm', 'Confirm', '/admin/orders', { status: 'Pending' }, 'brand', this.waitingNote()),
      this.card('orders-to-ship', this.ordersToShip(), 'order', 'orders', 'to ship', 'Ship', '/admin/orders', { status: 'Confirmed' }, 'info'),
      this.card('overdue', this.overdueDeliveries(), 'shipment', 'shipments', 'overdue for delivery', 'Check', '/admin/orders', { status: 'Shipped' }, 'warning', 'shipped over a week ago'),
      this.card('returns', this.returnsToReview(), 'return', 'returns', 'to review', 'Review', '/admin/returns', { status: 'Requested' }, 'warning'),
      this.card('refunds', this.refundsDue(), 'refund', 'refunds', 'to issue', 'Refund', '/admin/returns', { status: 'Approved' }, 'warning'),
      this.card('stock', this.stockAlerts(), 'product', 'products', 'low or out of stock', 'Restock', '/admin/stock', { lowStock: '1' }, 'danger')
    ];
    return cards.filter((c): c is ActionCard => c !== null);
  });

  // True once everything has loaded and nothing needs doing.
  allClear = computed(() => this.actionCards().length > 0 && this.actionCards().every(c => c.count === 0));

  // Only the items that actually need action are listed.
  pendingCards = computed(() => this.actionCards().filter(c => c.count > 0));

  ngOnInit(): void {
    this.load();
  }

  // silent: refresh in place (live updates) without swapping in the spinner.
  // Every number comes from a count/summary endpoint, so the dashboard stays
  // fast however many orders, products or users there are.
  load(silent = false): void {
    if (!silent) {
      this.isLoading.set(true);
    }
    this.errorMessage.set('');

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const todayKey = toDateKey(today);
    const yesterdayKey = toDateKey(yesterday);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    const weekStartKey = toDateKey(weekStart);

    // A failed piece becomes null so the rest of the dashboard still shows.
    const safe = <T>(source: Observable<T>): Observable<T | null> => source.pipe(catchError(() => of(null)));
    const count = (status: string) =>
      this.orderService.getAllOrdersAdminPaged(1, 1, undefined, status).pipe(map(r => r.totalCount));

    forkJoin({
      allTime: safe(this.reportService.getSummary()),
      today: safe(this.reportService.getSummary(todayKey, todayKey)),
      yesterday: safe(this.reportService.getSummary(yesterdayKey, yesterdayKey)),
      week: safe(this.reportService.getDailySales(weekStartKey, todayKey)),
      previousWeek: safe(this.reportService.getDailySales(previousRange(weekStartKey, todayKey).from, previousRange(weekStartKey, todayKey).to)),
      recent: safe(this.orderService.getAllOrdersAdminPaged(1, RECENT_ORDERS_LIMIT)),
      // Newest first, so the oldest pending order is on the last page of size 1.
      pending: safe(
        count('Pending').pipe(
          switchMap(total =>
            total === 0
              ? of({ total, oldest: null as string | null })
              : this.orderService
                  .getAllOrdersAdminPaged(total, 1, undefined, 'Pending')
                  .pipe(map(r => ({ total, oldest: r.items[0]?.orderDate ?? null })))
          )
        )
      ),
      toShip: safe(count('Confirmed')),
      products: safe(this.productService.getProductsPaged(1, 1).pipe(map(r => r.totalCount))),
      lowStock: safe(
        this.productService.getProductsPaged(1, LOW_STOCK_DISPLAY_LIMIT, undefined, null, false, null, null, null, false, 'stock_asc', true)
      ),
      users: safe(this.userService.getUsersAdminPaged(1, 1).pipe(map(r => r.totalCount))),
      returns: safe(this.returnService.getReturnsAdmin()),
      insights: safe(this.reportService.getOrderInsights(todayKey, todayKey))
    }).subscribe(r => {
      if (r.allTime) {
        this.totalOrders.set(r.allTime.totalOrders);
        this.totalRevenue.set(r.allTime.totalRevenue);
      }
      if (r.today) {
        // The daily-sales row for today uses the same rule as the chart; fall back
        // to the summary (minus cancelled) if that request failed.
        const todaySales = r.week?.find(d => d.date.slice(0, 10) === todayKey);
        this.todayOrders.set(r.week ? (todaySales?.orderCount ?? 0) : r.today.totalOrders - r.today.cancelledOrders);
        this.todayCancelled.set(r.today.cancelledOrders);
        this.todayRevenue.set(r.today.totalRevenue);
        this.todayAverage.set(r.today.averageOrderValue);
      }
      this.yesterdayRevenue.set(r.yesterday?.totalRevenue ?? null);
      this.weekSales.set(r.week);
      this.previousWeekSales.set(r.previousWeek);
      this.weekRange.set({ from: weekStartKey, to: todayKey });
      if (r.recent) {
        this.recentOrders.set(r.recent.items);
      }
      if (r.pending) {
        this.pendingOrders.set(r.pending.total);
        this.oldestPendingDate.set(r.pending.oldest);
      }
      if (r.toShip !== null) {
        this.ordersToShip.set(r.toShip);
      }
      if (r.products !== null) {
        this.totalProducts.set(r.products);
      }
      if (r.lowStock) {
        this.stockAlerts.set(r.lowStock.totalCount);
        this.lowStockProducts.set(r.lowStock.items);
      }
      if (r.users !== null) {
        this.totalUsers.set(r.users);
      }
      if (r.returns) {
        this.returnsToReview.set(r.returns.filter(x => x.status === 'Requested').length);
        this.refundsDue.set(r.returns.filter(x => x.status === 'Approved').length);
      }

      if (r.insights) {
        this.overdueDeliveries.set(r.insights.overdueDeliveries);
      }
      this.refreshTick.update(n => n + 1);

      this.isLoading.set(false);
      if (Object.values(r).some(v => v === null)) {
        this.errorMessage.set('Some dashboard data could not be loaded.');
      }
    });
  }

  private waitingNote(): string | undefined {
    const oldest = this.oldestPendingDate();
    if (!oldest) {
      return undefined;
    }
    const hours = Math.floor((Date.now() - new Date(oldest).getTime()) / 3_600_000);
    if (hours < 1) {
      return 'oldest waiting under an hour';
    }
    if (hours < 24) {
      return `oldest waiting ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    const days = Math.floor(hours / 24);
    return `oldest waiting ${days} ${days === 1 ? 'day' : 'days'}`;
  }

  openOrder(order: AdminOrder): void {
    this.openOrderId.set(order.orderId);
  }

  closeOrder(): void {
    this.openOrderId.set(null);
  }

  startRestock(product: Product): void {
    this.restockProductId.set(product.productId);
    this.restockQuantity = DEFAULT_RESTOCK_QUANTITY;
  }

  cancelRestock(): void {
    this.restockProductId.set(null);
  }

  saveRestock(product: Product): void {
    const quantity = Math.floor(Number(this.restockQuantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 10000) {
      this.toast.error('Enter a quantity between 1 and 10,000.');
      return;
    }

    this.isRestocking.set(true);
    this.productService.addStock(product.productId, quantity).subscribe({
      next: result => {
        this.isRestocking.set(false);
        this.restockProductId.set(null);
        this.toast.success(`${product.name}: +${quantity} added (now ${result.stockQuantity} in stock)`);
        this.load(true);
      },
      error: (err: { error?: { message?: string } }) => {
        this.isRestocking.set(false);
        this.toast.error(err.error?.message ?? 'Could not add stock.');
      }
    });
  }

  private card(
    key: string,
    count: number | null,
    singular: string,
    plural: string,
    label: string,
    cta: string,
    link: string,
    queryParams: Record<string, string>,
    tone: ActionCard['tone'],
    note?: string
  ): ActionCard | null {
    if (count === null) {
      return null;
    }
    return { key, count, label: `${count === 1 ? singular : plural} ${label}`, cta, link, queryParams, tone, note: count > 0 ? note : undefined };
  }

  stockLabel(product: Product): string {
    return getStockLabel(product.stockQuantity);
  }

  isOutOfStock(product: Product): boolean {
    return getStockStatus(product.stockQuantity) === 'out-of-stock';
  }
}
