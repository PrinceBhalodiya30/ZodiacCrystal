import { Component, Input, computed, signal } from '@angular/core';
import { ReportSummary } from '../../../models/report';
import { CountUpDirective } from '../../../directives/count-up.directive';
import { percentChange } from '../../../utils/sales-series.util';
import { InrPipe } from '../../../pipes/inr.pipe';

type SummaryKey = 'totalRevenue' | 'totalOrders' | 'averageOrderValue' | 'cancelledOrders';

interface KpiCard {
  key: SummaryKey;
  label: string;
  value: number;
  currency: boolean;
  icon: 'revenue' | 'orders' | 'average' | 'cancelled';
  tone: 'lavender' | 'peach' | 'mint' | 'blush';
  context: string;
  change: { text: string; good: boolean; bad: boolean } | null;
}

// Reports headline: four KPI cards (same look as the dashboard) with change vs
// the previous period, then one Payments card showing where the money is.
@Component({
  selector: 'app-report-kpis',
  standalone: true,
  imports: [CountUpDirective, InrPipe],
  templateUrl: './report-kpis.html',
  styleUrl: './report-kpis.css'
})
export class ReportKpis {
  private current = signal<ReportSummary | null>(null);
  private before = signal<ReportSummary | null>(null);

  @Input({ required: true }) set summary(value: ReportSummary) {
    this.current.set(value);
  }

  @Input() set previousSummary(value: ReportSummary | null) {
    this.before.set(value);
  }

  // e.g. "1 Sept – 30 Sept", shown on hover of each change chip.
  @Input() previousLabel = 'previous period';

  cards = computed<KpiCard[]>(() => {
    const s = this.current();
    if (!s) {
      return [];
    }
    return [
      { key: 'totalRevenue', label: 'Total revenue', value: s.totalRevenue, currency: true, icon: 'revenue', tone: 'lavender', context: 'Excludes cancelled & refunded', change: this.change('totalRevenue') },
      { key: 'totalOrders', label: 'Orders', value: s.totalOrders, currency: false, icon: 'orders', tone: 'peach', context: `${s.deliveredOrders} delivered`, change: this.change('totalOrders') },
      { key: 'averageOrderValue', label: 'Avg. order value', value: s.averageOrderValue, currency: true, icon: 'average', tone: 'mint', context: 'Per counted order', change: this.change('averageOrderValue') },
      { key: 'cancelledOrders', label: 'Cancelled', value: s.cancelledOrders, currency: false, icon: 'cancelled', tone: 'blush', context: s.totalOrders ? `${Math.round((s.cancelledOrders / s.totalOrders) * 100)}% of orders` : 'No orders', change: this.change('cancelledOrders') }
    ];
  });

  // Where the money stands: collected, still to collect (COD), refunded.
  money = computed(() => {
    const s = this.current();
    if (!s) {
      return null;
    }
    const total = s.collectedRevenue + s.pendingCodRevenue + s.refundedAmount;
    const share = (v: number) => (total > 0 ? (v / total) * 100 : 0);
    return {
      collected: s.collectedRevenue,
      pending: s.pendingCodRevenue,
      refunded: s.refundedAmount,
      collectedPct: share(s.collectedRevenue),
      pendingPct: share(s.pendingCodRevenue),
      refundedPct: share(s.refundedAmount),
      hasAny: total > 0
    };
  });

  // Fewer cancellations is the good direction.
  private change(key: SummaryKey): KpiCard['change'] {
    const now = this.current();
    const before = this.before();
    if (!now || !before) {
      return null;
    }
    const change = percentChange(now[key], before[key]);
    if (change === null) {
      return null;
    }
    const up = change > 0.05;
    const down = change < -0.05;
    const lowerIsBetter = key === 'cancelledOrders';
    return {
      text: `${up ? '▲' : down ? '▼' : '•'} ${Math.abs(change).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`,
      good: lowerIsBetter ? down : up,
      bad: lowerIsBetter ? up : down
    };
  }
}
