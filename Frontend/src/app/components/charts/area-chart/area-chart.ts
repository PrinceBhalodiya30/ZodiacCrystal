import { AfterViewInit, ChangeDetectorRef, Component, DestroyRef, ElementRef, Input, OnChanges } from '@angular/core';

export interface AreaChartPoint {
  label: string;
  value: number;
  // Extra tooltip lines, e.g. "3 orders".
  details?: string[];
}

interface PlottedPoint extends AreaChartPoint {
  x: number;
  y: number;
  previous: number | null;
  previousY: number | null;
}

const DEFAULT_WIDTH = 640;
const MIN_WIDTH = 320;
const HEIGHT = 240;
const PAD_TOP = 14;
const PAD_RIGHT = 12;
const PAD_BOTTOM = 28;
const PAD_LEFT = 52;
const GRIDLINES = 4;
const MAX_X_LABELS = 8;
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

let nextGradientId = 0;

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

// Smooth line through the points. Control points sit level with each point,
// so the curve never overshoots above a peak or below zero.
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) {
    return '';
  }
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const mid = (b.x - a.x) / 2;
    d += ` C${a.x + mid},${a.y} ${b.x - mid},${b.y} ${b.x},${b.y}`;
  }
  return d;
}

// Soft area chart: a smooth line with a fading fill, an optional dashed line
// for the previous period, and a hover guide with a tooltip. Drawn at the
// container's real width so text keeps its true size.
@Component({
  selector: 'app-area-chart',
  standalone: true,
  templateUrl: './area-chart.html',
  styleUrl: './area-chart.css'
})
export class AreaChart implements OnChanges, AfterViewInit {
  @Input() data: AreaChartPoint[] = [];
  // Same length as data, oldest first; drawn dashed behind the main line.
  @Input() previous: number[] | null = null;
  @Input() previousLabel = 'Previous period';
  @Input() valuePrefix = '';
  @Input() emptyMessage = 'No data for this range.';

  readonly gradientId = `area-fill-${nextGradientId++}`;

  width = DEFAULT_WIDTH;
  readonly height = HEIGHT;
  readonly plotLeft = PAD_LEFT;
  readonly plotTop = PAD_TOP;
  readonly plotBottom = HEIGHT - PAD_BOTTOM;
  get plotRight(): number {
    return this.width - PAD_RIGHT;
  }

  points: PlottedPoint[] = [];
  gridlines: { y: number; label: string }[] = [];
  xLabelIndexes = new Set<number>();
  linePath = '';
  areaPath = '';
  previousPath = '';
  hoverIndex: number | null = null;
  hasValues = false;
  slotWidth = 0;

  // Constructor-injected so the chart also works as `new AreaChart()` in tests.
  constructor(
    private host?: ElementRef<HTMLElement>,
    private cdr?: ChangeDetectorRef,
    private destroyRef?: DestroyRef
  ) {}

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
    const previous = this.previous && this.previous.length === this.data.length ? this.previous : null;
    this.hasValues = this.data.some(d => d.value > 0) || (previous?.some(v => v > 0) ?? false);

    if (this.data.length === 0) {
      this.points = [];
      this.gridlines = [];
      this.linePath = this.areaPath = this.previousPath = '';
      return;
    }

    const top = Math.max(...this.data.map(d => d.value), ...(previous ?? []), 0);
    const step = niceStep(top / GRIDLINES);
    const max = step * GRIDLINES;
    const plotWidth = this.plotRight - this.plotLeft;
    const plotHeight = this.plotBottom - this.plotTop;
    const n = this.data.length;
    this.slotWidth = n > 1 ? plotWidth / (n - 1) : plotWidth;
    const xAt = (i: number) => (n > 1 ? this.plotLeft + this.slotWidth * i : this.plotLeft + plotWidth / 2);
    const yAt = (v: number) => this.plotBottom - (v / max) * plotHeight;

    this.points = this.data.map((d, i) => ({
      ...d,
      x: xAt(i),
      y: yAt(d.value),
      previous: previous ? previous[i] : null,
      previousY: previous ? yAt(previous[i]) : null
    }));

    this.linePath = smoothPath(this.points);
    const first = this.points[0];
    const last = this.points[this.points.length - 1];
    this.areaPath = `${this.linePath} L${last.x},${this.plotBottom} L${first.x},${this.plotBottom} Z`;
    this.previousPath = previous ? smoothPath(this.points.map(p => ({ x: p.x, y: p.previousY! }))) : '';

    this.gridlines = Array.from({ length: GRIDLINES + 1 }, (_, i) => ({
      y: this.plotBottom - (i / GRIDLINES) * plotHeight,
      label: `${this.valuePrefix}${compact(step * i)}`
    }));

    const stride = Math.max(1, Math.ceil(n / MAX_X_LABELS));
    this.xLabelIndexes = new Set(this.points.map((_, i) => i).filter(i => i % stride === 0));
  }

  // Hover zone for each point: halfway to its neighbours.
  hitX(index: number): number {
    return Math.max(this.plotLeft, this.points[index].x - this.slotWidth / 2);
  }

  hitWidth(index: number): number {
    const start = this.hitX(index);
    const end = Math.min(this.plotRight, this.points[index].x + this.slotWidth / 2);
    return Math.max(end - start, 1);
  }

  setHover(index: number | null): void {
    this.hoverIndex = index;
  }

  get hovered(): PlottedPoint | null {
    return this.hoverIndex === null ? null : this.points[this.hoverIndex];
  }

  get tooltipAlign(): 'start' | 'middle' | 'end' {
    const p = this.hovered;
    if (!p) {
      return 'middle';
    }
    const ratio = p.x / this.width;
    return ratio < 0.2 ? 'start' : ratio > 0.8 ? 'end' : 'middle';
  }

  formatValue(value: number): string {
    return `${this.valuePrefix}${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
}
