import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, catchError, forkJoin, merge, of } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { AdminNav } from '../admin-nav/admin-nav';
import { Spinner } from '../../components/spinner/spinner';
import { ReportService } from '../../services/report.service';
import {
  CategorySales,
  CouponPerformance,
  DailySales,
  ReportSummary,
  TopProduct,
  UnsoldProducts,
  ZodiacSales
} from '../../models/report';
import { QuizService, ConsultationInsights } from '../../services/quiz.service';
import { ToastService } from '../../services/toast.service';
import { blobErrorMessage, downloadBlob } from '../../utils/download.util';
import { AreaChart, AreaChartPoint } from '../../components/charts/area-chart/area-chart';
import { ReportKpis } from './report-kpis/report-kpis';
import {
  buildSalesSeries,
  granularityFor,
  previousRange,
  rangeForPreset,
  toDateKey
} from '../../utils/sales-series.util';
import { InrPipe, formatInr } from '../../pipes/inr.pipe';
import { ReportOperations } from './report-operations/report-operations';

type DatePreset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';
type RankMetric = 'revenue' | 'units';

const TOP_PRODUCTS_SHOWN = 10;
// Fetch more than we show so "top by units" can be ranked from the same data.
const TOP_PRODUCTS_FETCHED = 50;

// The donut shows this many categories; the rest are grouped into "Other".
const DONUT_SLICES = 6;
const DONUT_COLORS = ['#2f4a3a', '#d19a1e', '#2f8f83', '#c8553d', '#3a6ea5', '#829289'];
const DONUT_OTHER_COLOR = '#bbb7af';

export type Movement = { kind: 'up' | 'down'; places: number } | { kind: 'same' } | { kind: 'new' };

export interface LeaderboardRow {
  rank: number;
  productId: number;
  name: string;
  units: number;
  revenue: number;
  movement: Movement | null;
}

export interface DonutSlice {
  label: string;
  value: number;
  valueText: string;
  percent: number;
  color: string;
  // stroke-dasharray / offset on a circle with circumference 100.
  dash: string;
  offset: number;
}

const GRANULARITY_LABEL = { day: 'per day', week: 'per week', month: 'per month' } as const;

import { VedicZodiacPipe } from '../../pipes/vedic-zodiac.pipe';
import { ZodiacIcon } from '../../components/zodiac-icon/zodiac-icon';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [InrPipe, Spinner, DecimalPipe, FormsModule, AdminNav, AreaChart, ReportKpis, ReportOperations, VedicZodiacPipe, ZodiacIcon],
  templateUrl: './reports.html',
  styleUrls: ['../admin-shared.css', './reports.css']
})
export class AdminReports implements OnInit {
  private reportService = inject(ReportService);
  private quizService = inject(QuizService);
  private toast = inject(ToastService);

  isExporting = signal(false);
  isExportingConsultation = signal(false);

  preset = signal<DatePreset>('last30');
  customFrom = '';
  customTo = '';
  readonly todayKey = toDateKey(new Date());

  private loadSubscription?: Subscription;
  private insightsSubscription?: Subscription;

  // Loaded separately from the main report: null = that panel failed, [] = no data.
  zodiacSales = signal<ZodiacSales[] | null>([]);
  couponPerformance = signal<CouponPerformance[] | null>([]);
  unsoldProducts = signal<UnsoldProducts | null>({ totalCount: 0, items: [] });
  consultationInsights = signal<ConsultationInsights | null>(null);
  insightsLoading = signal(true);

  isLoading = signal(true);
  errorMessage = signal('');

  summary = signal<ReportSummary | null>(null);
  previousSummary = signal<ReportSummary | null>(null);
  // Bumped on every reload (including live ones) so the Operations section follows.
  refreshTick = signal(0);
  topProducts = signal<TopProduct[]>([]);
  categorySales = signal<CategorySales[]>([]);
  dailySales = signal<DailySales[]>([]);
  previousDailySales = signal<DailySales[]>([]);
  previousTopProducts = signal<TopProduct[] | null>(null);

  // The range the loaded data covers, and the same-length range before it.
  loadedRange = signal<{ from: string; to: string } | null>(null);
  rankMetric = signal<RankMetric>('revenue');

  granularity = computed(() => {
    const range = this.loadedRange();
    return range ? granularityFor(range.from, range.to) : 'day';
  });

  granularityLabel = computed(() => GRANULARITY_LABEL[this.granularity()]);

  private currentSeries = computed(() => {
    const range = this.loadedRange();
    return range ? buildSalesSeries(this.dailySales(), range.from, range.to, this.granularity()) : [];
  });

  private previousSeries = computed(() => {
    const range = this.loadedRange();
    if (!range) {
      return [];
    }
    const prev = previousRange(range.from, range.to);
    return buildSalesSeries(this.previousDailySales(), prev.from, prev.to, this.granularity());
  });

  // Previous period on the same buckets, drawn dashed behind the chart (null
  // when the bucket counts differ, e.g. a month with a different length).
  previousChartValues = computed<number[] | null>(() => {
    const previous = this.previousSeries();
    return previous.length === this.currentSeries().length && previous.some(b => b.revenue > 0)
      ? previous.map(b => b.revenue)
      : null;
  });

  // One point per day/week/month; the tooltip adds the order count and average.
  salesChartData = computed<AreaChartPoint[]>(() => {
    const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    return this.currentSeries().map(bucket => ({
      label: bucket.label,
      value: bucket.revenue,
      details: bucket.orders
        ? [`${bucket.orders} order${bucket.orders === 1 ? '' : 's'}`, `Avg ${money(bucket.revenue / bucket.orders)}`]
        : ['No orders']
    }));
  });

  constructor() {
    // New orders, cancellations, refunds and other admins' changes (pushed over
    // SignalR) - refresh quietly so the figures always match the records.
    const notifications = inject(NotificationService);
    merge(notifications.adminOrderPlaced, notifications.adminDataChanged)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.loadReports(true));
  }

  ngOnInit(): void {
    this.loadReports();
  }

  onPresetChange(preset: DatePreset): void {
    if (preset === 'custom') {
      // Start the pickers on the range currently shown, so the figures on
      // screen always match the dates in the boxes until Apply is pressed.
      const shown = this.loadedRange();
      if (!this.customFrom || !this.customTo) {
        this.customFrom = shown?.from ?? this.todayKey;
        this.customTo = shown?.to ?? this.todayKey;
      }
      this.preset.set(preset);
      return;
    }

    this.preset.set(preset);
    this.loadReports();
  }

  get customRangeInvalid(): boolean {
    return !!this.customFrom && !!this.customTo && this.customFrom > this.customTo;
  }

  applyCustomRange(): void {
    if (!this.customFrom || !this.customTo || this.customRangeInvalid) {
      return;
    }

    this.loadReports();
  }

  // Export button names the period it downloads, e.g. "Export (Last 30 Days)".
  // A method, not computed(), because the custom dates are plain fields.
  exportPeriodLabel(): string {
    const labels: Record<DatePreset, string> = {
      today: 'Today', last7: 'Last 7 Days', last30: 'Last 30 Days', thisMonth: 'This Month',
      lastMonth: 'Last Month', thisYear: 'This Year', custom: 'Custom Range'
    };
    const preset = this.preset();
    if (preset === 'custom' && this.customFrom && this.customTo) {
      return `${this.customFrom} to ${this.customTo}`;
    }
    return labels[preset];
  }

  private resolveRange(): { from?: string; to?: string } {
    const preset = this.preset();
    if (preset === 'custom') {
      return { from: this.customFrom || undefined, to: this.customTo || undefined };
    }
    return rangeForPreset(preset);
  }

  // silent: refresh in place (live updates) without swapping in the spinner.
  loadReports(silent = false): void {
    // A live refresh re-runs what's on screen, not unapplied custom dates.
    const shown = this.loadedRange();
    const { from, to } = silent && shown ? shown : this.resolveRange();
    const range = from && to && from <= to ? { from, to } : null;
    const previous = range ? previousRange(range.from, range.to) : null;

    if (!silent) {
      this.isLoading.set(true);
    }
    this.errorMessage.set('');

    // Clicking presets quickly must not let a slower, older request win.
    this.loadInsights(from, to);

    this.loadSubscription?.unsubscribe();
    this.loadSubscription = forkJoin({
      summary: this.reportService.getSummary(from, to),
      previousSummary: previous
        ? this.reportService.getSummary(previous.from, previous.to).pipe(catchError(() => of(null)))
        : of<ReportSummary | null>(null),
      topProducts: this.reportService.getTopProducts(from, to, TOP_PRODUCTS_FETCHED),
      categorySales: this.reportService.getCategorySales(from, to),
      dailySales: this.reportService.getDailySales(from, to),
      previousDailySales: previous
        ? this.reportService.getDailySales(previous.from, previous.to)
        : of<DailySales[]>([]),
      previousTopProducts: previous
        ? this.reportService.getTopProducts(previous.from, previous.to, TOP_PRODUCTS_FETCHED)
        : of<TopProduct[] | null>(null)
    }).subscribe({
      next: result => {
        this.summary.set(result.summary);
        this.previousSummary.set(result.previousSummary);
        this.refreshTick.update(n => n + 1);
        this.topProducts.set(result.topProducts);
        this.categorySales.set(result.categorySales);
        this.dailySales.set(result.dailySales);
        this.previousDailySales.set(result.previousDailySales);
        this.previousTopProducts.set(result.previousTopProducts);
        this.loadedRange.set(range);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load reports.');
        this.isLoading.set(false);
      }
    });
  }

  private loadInsights(from?: string, to?: string): void {
    this.insightsLoading.set(true);
    this.insightsSubscription?.unsubscribe();
    this.consultationInsights.set(this.quizService.getInsights(from, to));
    this.insightsSubscription = forkJoin({
      zodiac: this.reportService.getZodiacSales(from, to).pipe(catchError(() => of(null))),
      coupons: this.reportService.getCouponPerformance(from, to).pipe(catchError(() => of(null))),
      unsold: this.reportService.getUnsoldProducts(from, to).pipe(catchError(() => of(null)))
    }).subscribe(result => {
      this.zodiacSales.set(result.zodiac);
      this.couponPerformance.set(result.coupons);
      this.unsoldProducts.set(result.unsold);
      this.insightsLoading.set(false);
    });
  }

  // Signs sorted by the Revenue / Units toggle; bar widths relative to the best sign.
  zodiacRows = computed(() => {
    const rows = this.zodiacSales();
    if (!rows) {
      return null;
    }
    const metric = this.rankMetric();
    const valueOf = (z: ZodiacSales) => (metric === 'revenue' ? z.revenue : z.quantitySold);
    const max = Math.max(0, ...rows.map(valueOf));
    return [...rows]
      .sort((a, b) => valueOf(b) - valueOf(a) || a.zodiacName.localeCompare(b.zodiacName))
      .map(z => ({ ...z, width: max > 0 ? (valueOf(z) / max) * 100 : 0 }));
  });

  zodiacHasSales = computed(() => (this.zodiacSales() ?? []).some(z => z.quantitySold > 0));

  couponTotals = computed(() =>
    (this.couponPerformance() ?? []).reduce(
      (acc, c) => ({ orders: acc.orders + c.orderCount, discount: acc.discount + c.discountGiven, sales: acc.sales + c.sales }),
      { orders: 0, discount: 0, sales: 0 }
    )
  );

  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    // Export exactly what is on screen: the loaded range (not unapplied custom
    // dates) and the current Revenue/Units ranking.
    const range = this.loadedRange();
    this.isExporting.set(true);

    this.reportService.exportReportsCsv(range?.from, range?.to, this.rankMetric()).subscribe({
      next: blob => {
        this.isExporting.set(false);
        const fileName = range
          ? `sales-report_${range.from}_to_${range.to}.csv`
          : 'sales-report-export.csv';
        downloadBlob(blob, fileName);
      },
      error: (err: unknown) => {
        this.isExporting.set(false);
        blobErrorMessage(err, 'Unable to export the report.').then(message => this.toast.error(message));
      }
    });
  }

  exportConsultationCsv(): void {
    if (this.isExportingConsultation()) {
      return;
    }
    this.isExportingConsultation.set(true);
    try {
      const range = this.loadedRange();
      const blob = this.quizService.exportCsvBlob(range?.from, range?.to);
      const fileName = range
        ? `consultation-insights_${range.from}_to_${range.to}.csv`
        : 'consultation-insights-export.csv';
      downloadBlob(blob, fileName);
      this.toast.success('Consultation report exported as CSV.');
    } catch {
      this.toast.error('Unable to export consultation report.');
    } finally {
      this.isExportingConsultation.set(false);
    }
  }

  previousPeriodLabel(): string {
    const range = this.loadedRange();
    if (!range) {
      return 'previous period';
    }
    const prev = previousRange(range.from, range.to);
    const fmt = (key: string) =>
      new Date(key + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return prev.from === prev.to ? fmt(prev.from) : `${fmt(prev.from)} – ${fmt(prev.to)}`;
  }

  setRankMetric(metric: RankMetric): void {
    this.rankMetric.set(metric);
  }

  private sortByMetric<T extends { revenue: number; quantitySold: number }>(rows: T[]): T[] {
    const metric = this.rankMetric();
    return [...rows].sort((a, b) =>
      metric === 'revenue'
        ? b.revenue - a.revenue || b.quantitySold - a.quantitySold
        : b.quantitySold - a.quantitySold || b.revenue - a.revenue
    );
  }

  // Top products, each with how its rank moved against the previous period.
  leaderboard = computed<LeaderboardRow[]>(() => {
    const previous = this.previousTopProducts();
    const previousRank = new Map<number, number>();
    const compare = this.hasPreviousPeriod();
    if (compare) {
      this.sortByMetric(previous!).forEach((p, i) => previousRank.set(p.productId, i + 1));
    }

    return this.sortByMetric(this.topProducts())
      .slice(0, TOP_PRODUCTS_SHOWN)
      .map((p, i) => {
        const rank = i + 1;
        let movement: Movement | null = null;
        if (compare) {
          const before = previousRank.get(p.productId);
          movement = before == null ? { kind: 'new' }
            : before === rank ? { kind: 'same' }
            : { kind: before > rank ? 'up' : 'down', places: Math.abs(before - rank) };
        }
        return { rank, productId: p.productId, name: p.productName, units: p.quantitySold, revenue: p.revenue, movement };
      });
  });

  // Only compare ranks when the previous period actually had sales; otherwise
  // every row would just say "New".
  hasPreviousPeriod = computed(() => (this.previousTopProducts()?.length ?? 0) > 0);

  // Category share of sales as donut slices; small categories are grouped into "Other".
  donutSlices = computed<DonutSlice[]>(() => {
    const metric = this.rankMetric();
    const valueOf = (c: CategorySales) => (metric === 'revenue' ? c.revenue : c.quantitySold);
    const sorted = this.sortByMetric(this.categorySales()).filter(c => valueOf(c) > 0);
    const total = sorted.reduce((sum, c) => sum + valueOf(c), 0);
    if (total === 0) {
      return [];
    }

    const shown = sorted.length > DONUT_SLICES + 1 ? sorted.slice(0, DONUT_SLICES) : sorted;
    const rows = shown.map((c, i) => ({ label: c.categoryName, value: valueOf(c), color: DONUT_COLORS[i % DONUT_COLORS.length] }));
    if (shown.length < sorted.length) {
      const rest = sorted.slice(shown.length).reduce((sum, c) => sum + valueOf(c), 0);
      rows.push({ label: `Other (${sorted.length - shown.length})`, value: rest, color: DONUT_OTHER_COLOR });
    }

    let start = 0;
    return rows.map(r => {
      const percent = (r.value / total) * 100;
      // A small gap between slices, unless one category is the whole ring.
      const length = rows.length > 1 ? Math.max(percent - 0.6, 0.1) : 100;
      const slice: DonutSlice = {
        ...r,
        valueText: metric === 'revenue' ? formatInr(r.value, 0) : `${r.value.toLocaleString('en-IN')} units`,
        percent,
        dash: `${length} ${100 - length}`,
        offset: 25 - start
      };
      start += percent;
      return slice;
    });
  });

  donutTotalText = computed(() => {
    const total = this.donutSlices().reduce((sum, s) => sum + s.value, 0);
    return this.rankMetric() === 'revenue' ? formatInr(total, 0) : total.toLocaleString('en-IN');
  });
}
