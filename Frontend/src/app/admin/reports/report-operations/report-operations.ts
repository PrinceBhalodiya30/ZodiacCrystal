import { Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ReportService } from '../../../services/report.service';
import { ReasonCount, ReportOperations as Operations } from '../../../models/report';
import { RankedBarItem, RankedBars } from '../../../components/charts/ranked-bars/ranked-bars';
import { InrPipe, formatInr } from '../../../pipes/inr.pipe';

const STATES_SHOWN = 10;

// "48 min", "6.5 hrs", "2.3 days" - readable durations from hours.
export function formatDuration(hours: number | null): string {
  if (hours === null) {
    return '—';
  }
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))} min`;
  }
  if (hours < 48) {
    return `${hours.toFixed(hours < 10 ? 1 : 0)} hrs`;
  }
  return `${(hours / 24).toFixed(1)} days`;
}

// Reports page "Operations": how fast orders move, why they're cancelled or
// returned, who the customers are and where they are - for the page's range.
@Component({
  selector: 'app-report-operations',
  standalone: true,
  imports: [RankedBars, InrPipe],
  templateUrl: './report-operations.html',
  styleUrl: './report-operations.css'
})
export class ReportOperations implements OnChanges {
  private reportService = inject(ReportService);

  @Input({ required: true }) from!: string;
  @Input({ required: true }) to!: string;
  // Changes on every Reports reload, including live SignalR refreshes.
  @Input() refresh = 0;

  data = signal<Operations | null>(null);
  isLoading = signal(true);
  hasError = signal(false);
  private subscription?: Subscription;

  readonly formatDuration = formatDuration;

  fulfilmentSteps = computed(() => {
    const f = this.data()?.fulfilment;
    if (!f) {
      return [];
    }
    return [
      { label: 'Order → Confirmed', value: f.hoursToConfirm },
      { label: 'Confirmed → Shipped', value: f.hoursToShip },
      { label: 'Shipped → Delivered', value: f.hoursToDeliver }
    ];
  });

  cancelReasons = computed(() => this.withScale(this.data()?.cancellations.reasons ?? []));
  returnReasons = computed(() => this.withScale(this.data()?.returns.reasons ?? []));

  stateBars = computed<RankedBarItem[]>(() =>
    (this.data()?.states ?? []).slice(0, STATES_SHOWN).map(s => ({
      id: s.state,
      label: s.state,
      value: s.revenue,
      valueText: formatInr(s.revenue, 0),
      detail: `${s.orders} order${s.orders === 1 ? '' : 's'}`
    }))
  );

  moreStates = computed(() => Math.max(0, (this.data()?.states.length ?? 0) - STATES_SHOWN));

  newShare = computed(() => {
    const c = this.data()?.customers;
    return c && c.customers ? Math.round((c.newCustomers / c.customers) * 100) : 0;
  });

  ngOnChanges(): void {
    // Keep showing the old figures during a live refresh of the same range.
    const silent = this.data() !== null;
    if (!silent) {
      this.isLoading.set(true);
    }

    this.subscription?.unsubscribe();
    this.subscription = this.reportService.getOperations(this.from, this.to).subscribe({
      next: data => {
        this.data.set(data);
        this.hasError.set(false);
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  private withScale(reasons: ReasonCount[]) {
    const max = Math.max(...reasons.map(r => r.count), 1);
    return reasons.slice(0, 5).map(r => ({ ...r, scale: r.count / max }));
  }
}
