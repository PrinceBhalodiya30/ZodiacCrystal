import { DailySales } from '../models/report';

export type SeriesGranularity = 'day' | 'week' | 'month';

export interface SalesBucket {
  label: string;
  revenue: number;
  orders: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' in the browser's local time (toISOString would shift IST dates back a day). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Inclusive number of calendar days in a range. */
export function daysInRange(from: string, to: string): number {
  return Math.round((fromDateKey(to).getTime() - fromDateKey(from).getTime()) / DAY_MS) + 1;
}

/** The same-length range immediately before this one (for "vs previous period"). */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const length = daysInRange(from, to);
  const prevTo = addDays(fromDateKey(from), -1);
  return { from: toDateKey(addDays(prevTo, -(length - 1))), to: toDateKey(prevTo) };
}

/** Daily up to a month, weekly up to ~6 months, monthly beyond. */
export function granularityFor(from: string, to: string): SeriesGranularity {
  const days = daysInRange(from, to);
  return days <= 31 ? 'day' : days <= 183 ? 'week' : 'month';
}

const dayLabel = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Turns the API's per-day rows (which skip days with no sales) into a
 * continuous series: every day/week/month in the range is present, with 0
 * where nothing sold, so quiet days show as dips instead of being skipped.
 */
export function buildSalesSeries(daily: DailySales[], from: string, to: string, granularity: SeriesGranularity): SalesBucket[] {
  const byDay = new Map<string, DailySales>();
  for (const row of daily) {
    byDay.set(row.date.slice(0, 10), row);
  }

  const start = fromDateKey(from);
  const end = fromDateKey(to);
  const buckets: SalesBucket[] = [];

  const sumDays = (bucketStart: Date, bucketEnd: Date): { revenue: number; orders: number } => {
    let revenue = 0;
    let orders = 0;
    for (let d = new Date(bucketStart); d <= bucketEnd; d = addDays(d, 1)) {
      const row = byDay.get(toDateKey(d));
      if (row) {
        revenue += row.revenue;
        orders += row.orderCount;
      }
    }
    return { revenue, orders };
  };

  if (granularity === 'day') {
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      buckets.push({ label: dayLabel(d), ...sumDays(d, d) });
    }
  } else if (granularity === 'week') {
    // 7-day blocks counted from the range start, so this and the previous
    // period line up bucket for bucket.
    for (let d = new Date(start); d <= end; d = addDays(d, 7)) {
      const blockEnd = addDays(d, 6) > end ? end : addDays(d, 6);
      buckets.push({ label: `${dayLabel(d)} – ${dayLabel(blockEnd)}`, ...sumDays(d, blockEnd) });
    }
  } else {
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const monthStart = d < start ? start : d;
      const monthEndRaw = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const monthEnd = monthEndRaw > end ? end : monthEndRaw;
      buckets.push({
        label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        ...sumDays(monthStart, monthEnd)
      });
    }
  }

  return buckets;
}

/** % change vs the previous period, or null when there's nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export type DatePreset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'thisYear';

/** Inclusive from/to for a report preset, relative to `today` (local time). */
export function rangeForPreset(preset: DatePreset, today: Date = new Date()): { from: string; to: string } {
  const to = toDateKey(today);
  switch (preset) {
    case 'today':
      return { from: to, to };
    case 'last7':
      return { from: toDateKey(addDays(today, -6)), to };
    case 'last30':
      return { from: toDateKey(addDays(today, -29)), to };
    case 'thisMonth':
      return { from: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    case 'lastMonth':
      return {
        from: toDateKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        // Day 0 of this month = the last day of last month.
        to: toDateKey(new Date(today.getFullYear(), today.getMonth(), 0))
      };
    case 'thisYear':
      return { from: toDateKey(new Date(today.getFullYear(), 0, 1)), to };
  }
}
