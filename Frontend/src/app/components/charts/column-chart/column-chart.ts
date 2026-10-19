import { AfterViewInit, ChangeDetectorRef, Component, DestroyRef, ElementRef, Input, OnChanges } from '@angular/core';

export interface ColumnChartPoint {
  label: string;
  value: number;
  // Extra tooltip lines, e.g. "3 orders".
  details?: string[];
}

interface PlottedColumn extends ColumnChartPoint {
  x: number;
  y: number;
  width: number;
  height: number;
  center: number;
}

// Drawn at the container's real width (min 320) so text stays its true size
// and a wide panel gets wider bars, not a taller chart.
const DEFAULT_WIDTH = 640;
const MIN_WIDTH = 320;
const HEIGHT = 260;
const PAD_TOP = 12;
const PAD_RIGHT = 8;
const PAD_BOTTOM = 28;
const PAD_LEFT = 52;
const GRIDLINES = 4;
const MAX_X_LABELS = 8;
const MAX_BAR_WIDTH = 42;

// Axis top sits just above the tallest bar (₹1,240 -> ₹1,600, not ₹2,000).
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceStep(raw: number): number {
  if (raw <= 0) {
    return 1;
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  return (NICE_STEPS.find(s => s >= raw / magnitude) ?? 10) * magnitude;
}

// ₹950, ₹1.5K, ₹2.4L - short labels for the value axis.
function compact(value: number): string {
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (value >= 1_00_00_000) return `${trim(value / 1_00_00_000)}Cr`;
  if (value >= 1_00_000) return `${trim(value / 1_00_000)}L`;
  if (value >= 1_000) return `${trim(value / 1_000)}K`;
  return `${Math.round(value)}`;
}

// Simple vertical column chart: one bar per period, value axis on the left,
// hover (or keyboard focus) a bar to see its exact value.
@Component({
  selector: 'app-column-chart',
  standalone: true,
  templateUrl: './column-chart.html',
  styleUrl: './column-chart.css'
})
export class ColumnChart implements OnChanges, AfterViewInit {
  // Constructor-injected (not inject()) so the chart can also be built with
  // `new ColumnChart()` in plain unit tests, where it just keeps its default width.
  constructor(
    private host?: ElementRef<HTMLElement>,
    private cdr?: ChangeDetectorRef,
    private destroyRef?: DestroyRef
  ) {}

  @Input() data: ColumnChartPoint[] = [];
  @Input() valuePrefix = '';
  @Input() emptyMessage = 'No data for this range.';

  width = DEFAULT_WIDTH;
  readonly height = HEIGHT;
  readonly plotLeft = PAD_LEFT;
  get plotRight(): number {
    return this.width - PAD_RIGHT;
  }
  readonly plotTop = PAD_TOP;
  readonly plotBottom = HEIGHT - PAD_BOTTOM;

  columns: PlottedColumn[] = [];
  gridlines: { y: number; label: string }[] = [];
  xLabelIndexes = new Set<number>();
  hoverIndex: number | null = null;
  hasValues = false;

  ngAfterViewInit(): void {
    if (!this.host || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(entries => {
      const next = Math.max(MIN_WIDTH, Math.round(entries[0].contentRect.width));
      if (next !== this.width) {
        this.width = next;
        this.layout();
        this.cdr?.detectChanges();
      }
    });
    observer.observe(this.host.nativeElement);
    this.destroyRef?.onDestroy(() => observer.disconnect());
  }

  ngOnChanges(): void {
    this.hoverIndex = null;
    this.layout();
  }

  private layout(): void {
    this.hasValues = this.data.some(d => d.value > 0);

    if (this.data.length === 0) {
      this.columns = [];
      this.gridlines = [];
      return;
    }

    const step = niceStep(Math.max(...this.data.map(d => d.value), 0) / GRIDLINES);
    const max = step * GRIDLINES;
    const plotWidth = this.plotRight - this.plotLeft;
    const plotHeight = this.plotBottom - this.plotTop;
    const slot = plotWidth / this.data.length;
    const barWidth = Math.min(slot * 0.7, MAX_BAR_WIDTH);

    this.columns = this.data.map((d, i) => {
      // Tiny non-zero days still get a visible 2px sliver.
      const height = d.value > 0 ? Math.max((d.value / max) * plotHeight, 2) : 0;
      const center = this.plotLeft + slot * i + slot / 2;
      return { ...d, x: center - barWidth / 2, y: this.plotBottom - height, width: barWidth, height, center };
    });

    this.gridlines = Array.from({ length: GRIDLINES + 1 }, (_, i) => ({
      y: this.plotBottom - (i / GRIDLINES) * plotHeight,
      label: `${this.valuePrefix}${compact(step * i)}`
    }));

    const stride = Math.max(1, Math.ceil(this.data.length / MAX_X_LABELS));
    this.xLabelIndexes = new Set(this.columns.map((_, i) => i).filter(i => i % stride === 0));
  }

  setHover(index: number | null): void {
    this.hoverIndex = index;
  }

  get hovered(): PlottedColumn | null {
    return this.hoverIndex === null ? null : this.columns[this.hoverIndex];
  }

  // Tooltip grows inwards near the chart edges.
  get tooltipAlign(): 'start' | 'middle' | 'end' {
    const c = this.hovered;
    if (!c) {
      return 'middle';
    }
    const ratio = c.center / this.width;
    return ratio < 0.2 ? 'start' : ratio > 0.8 ? 'end' : 'middle';
  }

  formatValue(value: number): string {
    return `${this.valuePrefix}${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
}
