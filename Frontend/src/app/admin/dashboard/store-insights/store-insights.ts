import { Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { ReportService } from '../../../services/report.service';
import { ZodiacService } from '../../../services/zodiac.service';
import { OrderInsights, ReportSummary, TopProduct, ZodiacSales } from '../../../models/report';
import { Zodiac } from '../../../models/zodiac';
import { RankedBarItem, RankedBars } from '../../../components/charts/ranked-bars/ranked-bars';
import { ZodiacIcon } from '../../../components/zodiac-icon/zodiac-icon';
import { InrPipe, formatInr } from '../../../pipes/inr.pipe';
import { toDateKey } from '../../../utils/sales-series.util';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' }
];

// Same order and colours as the status badges elsewhere in admin.
const STATUS_ORDER = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

interface StatusSegment {
  status: string;
  count: number;
  percent: number;
}

interface ZodiacTile {
  zodiacId: number;
  name: string;
  revenue: number;
  units: number;
  // 0-1, relative to the best-selling sign - drives the tile tint.
  intensity: number;
}

// Dashboard section below the daily panels: how the store has done over a
// chosen range - order outcomes and why customers cancel, best sellers,
// sales by zodiac sign, and how customers pay.
import { VedicZodiacPipe } from '../../../pipes/vedic-zodiac.pipe';

@Component({
  selector: 'app-store-insights',
  standalone: true,
  imports: [RouterLink, RankedBars, ZodiacIcon, InrPipe, VedicZodiacPipe],
  templateUrl: './store-insights.html',
  styleUrl: './store-insights.css'
})
export class StoreInsights implements OnChanges {
  private readonly reportService = inject(ReportService);
  private readonly zodiacService = inject(ZodiacService);

  // Changes whenever the dashboard reloads (including live SignalR refreshes).
  @Input() refresh = 0;

  readonly ranges = RANGES;
  readonly rangeDays = signal(30);

  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  private readonly insights = signal<OrderInsights | null>(null);
  private readonly summary = signal<ReportSummary | null>(null);
  private readonly topProducts = signal<TopProduct[]>([]);
  private readonly zodiacSales = signal<ZodiacSales[]>([]);
  private readonly zodiacSigns = signal<Zodiac[]>([]);

  readonly totalOrders = computed(() => (this.insights()?.statusCounts ?? []).reduce((sum, s) => sum + s.count, 0));

  readonly statusSegments = computed<StatusSegment[]>(() => {
    const counts = this.insights()?.statusCounts ?? [];
    const total = this.totalOrders();
    return STATUS_ORDER.map(status => {
      const count = counts.find(c => c.status === status)?.count ?? 0;
      return { status, count, percent: total ? (count / total) * 100 : 0 };
    });
  });

  readonly cancelRate = computed(() => {
    const total = this.totalOrders();
    const cancelled = this.statusSegments().find(s => s.status === 'Cancelled')?.count ?? 0;
    return total ? Math.round((cancelled / total) * 100) : 0;
  });

  readonly cancellationReasons = computed(() => {
    const reasons = this.insights()?.cancellationReasons ?? [];
    const max = Math.max(...reasons.map(r => r.count), 1);
    return reasons.slice(0, 4).map(r => ({ ...r, scale: r.count / max }));
  });

  readonly topProductBars = computed<RankedBarItem[]>(() =>
    this.topProducts().map(p => ({
      id: p.productId,
      label: p.productName,
      value: p.revenue,
      valueText: formatInr(p.revenue),
      detail: `${p.quantitySold} sold`
    }))
  );

  // All 12 signs, including ones with no sales yet.
  readonly zodiacTiles = computed<ZodiacTile[]>(() => {
    const sales = this.zodiacSales();
    const max = Math.max(...sales.map(s => s.revenue), 0);
    return this.zodiacSigns().map(sign => {
      const sale = sales.find(s => s.zodiacId === sign.zodiacId);
      const revenue = sale?.revenue ?? 0;
      return {
        zodiacId: sign.zodiacId,
        name: sign.name,
        revenue,
        units: sale?.quantitySold ?? 0,
        intensity: max > 0 ? revenue / max : 0
      };
    });
  });

  readonly topZodiac = computed(() => {
    const best = [...this.zodiacTiles()].sort((a, b) => b.revenue - a.revenue)[0];
    return best && best.revenue > 0 ? best : null;
  });

  readonly payments = computed(() => {
    const methods = this.insights()?.paymentMethods ?? [];
    const card = methods.find(m => m.method === 'Card') ?? { method: 'Card', orders: 0, revenue: 0 };
    const cod = methods.find(m => m.method === 'COD') ?? { method: 'COD', orders: 0, revenue: 0 };
    const totalOrders = card.orders + cod.orders;
    return {
      card,
      cod,
      cardPercent: totalOrders ? Math.round((card.orders / totalOrders) * 100) : 0,
      hasOrders: totalOrders > 0
    };
  });

  readonly money = computed(() => {
    const s = this.summary();
    return s
      ? { collected: s.collectedRevenue, codPending: s.pendingCodRevenue, refunded: s.refundedAmount }
      : null;
  });

  ngOnChanges(): void {
    this.load(this.insights() !== null);
  }

  setRange(days: number): void {
    if (days !== this.rangeDays()) {
      this.rangeDays.set(days);
      this.load(false);
    }
  }

  statusLink(status: string): Record<string, string> {
    return { status };
  }

  // silent: refresh in place without the skeleton (live updates).
  private load(silent: boolean): void {
    if (!silent) {
      this.isLoading.set(true);
    }

    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (this.rangeDays() - 1));
    const from = toDateKey(start);
    const to = toDateKey(today);

    const safe = <T>(source: Observable<T>): Observable<T | null> => source.pipe(catchError(() => of(null)));

    forkJoin({
      insights: safe(this.reportService.getOrderInsights(from, to)),
      summary: safe(this.reportService.getSummary(from, to)),
      top: safe(this.reportService.getTopProducts(from, to, 5)),
      zodiac: safe(this.reportService.getZodiacSales(from, to)),
      // The sign list doesn't change with the range; fetch it once.
      signs: this.zodiacSigns().length ? of(this.zodiacSigns()) : safe(this.zodiacService.getZodiacSigns())
    }).subscribe(r => {
      this.insights.set(r.insights);
      this.summary.set(r.summary);
      this.topProducts.set(r.top ?? []);
      this.zodiacSales.set(r.zodiac ?? []);
      this.zodiacSigns.set(r.signs ?? []);
      this.hasError.set(Object.values(r).includes(null));
      this.isLoading.set(false);
    });
  }
}
