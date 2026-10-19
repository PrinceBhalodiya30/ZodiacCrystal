import { ColumnChart } from '../../components/charts/column-chart/column-chart';
import { DailySales } from '../../models/report';
import {
  buildSalesSeries,
  daysInRange,
  granularityFor,
  previousRange,
  rangeForPreset
} from '../../utils/sales-series.util';

// Every Reports date option, end to end: preset -> date range -> buckets -> chart.
describe('Reports date presets', () => {
  const today = new Date(2026, 8, 28, 1, 30); // 28 Sep 2026, 1:30 AM local (the old UTC bug window)

  it('resolves each preset to the right inclusive range', () => {
    expect(rangeForPreset('today', today)).toEqual({ from: '2026-09-28', to: '2026-09-28' });
    expect(rangeForPreset('last7', today)).toEqual({ from: '2026-09-22', to: '2026-09-28' });
    expect(rangeForPreset('last30', today)).toEqual({ from: '2026-08-30', to: '2026-09-28' });
    expect(rangeForPreset('thisMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-28' });
  });

  it('handles month and year boundaries', () => {
    expect(rangeForPreset('last7', new Date(2026, 0, 3))).toEqual({ from: '2025-12-28', to: '2026-01-03' });
    expect(rangeForPreset('thisMonth', new Date(2026, 9, 1))).toEqual({ from: '2026-10-01', to: '2026-10-01' });
    // 30 days ending 1 March: Feb has 29 days in a leap year, 28 otherwise.
    expect(rangeForPreset('last30', new Date(2028, 2, 1))).toEqual({ from: '2028-02-01', to: '2028-03-01' });
    expect(rangeForPreset('last30', new Date(2027, 2, 1))).toEqual({ from: '2027-01-31', to: '2027-03-01' });
  });

  it('gives the expected number of chart bars per preset', () => {
    const bars = (range: { from: string; to: string }) =>
      buildSalesSeries([], range.from, range.to, granularityFor(range.from, range.to)).length;

    expect(bars(rangeForPreset('today', today))).toBe(1);
    expect(bars(rangeForPreset('last7', today))).toBe(7);
    expect(bars(rangeForPreset('last30', today))).toBe(30);
    expect(bars(rangeForPreset('thisMonth', today))).toBe(28);
    // Custom: 3 months -> weekly, 2 years -> monthly
    expect(granularityFor('2026-07-01', '2026-09-28')).toBe('week');
    expect(bars({ from: '2026-07-01', to: '2026-09-28' })).toBe(13);
    expect(bars({ from: '2024-10-01', to: '2026-09-28' })).toBe(24);
  });

  it('compares each preset with a previous period of the same length', () => {
    for (const preset of ['today', 'last7', 'last30', 'thisMonth'] as const) {
      const range = rangeForPreset(preset, today);
      const prev = previousRange(range.from, range.to);
      expect(daysInRange(prev.from, prev.to)).toBe(daysInRange(range.from, range.to));
    }
  });

  it('puts every sale in the right bar for a 30-day range', () => {
    const range = rangeForPreset('last30', today);
    const daily: DailySales[] = [
      { date: '2026-08-30T00:00:00', revenue: 400, orderCount: 1 }, // first day of range
      { date: '2026-09-15T00:00:00', revenue: 1240, orderCount: 2 },
      { date: '2026-09-28T00:00:00', revenue: 650, orderCount: 1 } // today
    ];
    const series = buildSalesSeries(daily, range.from, range.to, 'day');
    expect(series[0].revenue).toBe(400);
    expect(series[16].revenue).toBe(1240);
    expect(series[29].revenue).toBe(650);
    expect(series.reduce((sum, b) => sum + b.revenue, 0)).toBe(2290);
  });
});

describe('ColumnChart', () => {
  function render(values: number[]): ColumnChart {
    const chart = new ColumnChart();
    chart.valuePrefix = '₹';
    chart.data = values.map((value, i) => ({ label: `D${i + 1}`, value }));
    chart.ngOnChanges();
    return chart;
  }

  it('draws a single bar for "Today"', () => {
    const chart = render([650]);
    expect(chart.columns.length).toBe(1);
    expect(chart.columns[0].height).toBeGreaterThan(0);
    expect(chart.columns[0].width).toBeLessThanOrEqual(42); // not a giant block
  });

  it('keeps the tallest bar inside the plot with a tight axis', () => {
    const chart = render([0, 1240, 300, 0, 800]);
    const tallest = Math.max(...chart.columns.map(c => c.height));
    expect(tallest).toBeLessThanOrEqual(chart.plotBottom - chart.plotTop);
    expect(chart.gridlines.at(-1)!.label).toBe('₹1.6K'); // not ₹2K
    expect(chart.columns[0].height).toBe(0); // no-sales day: no bar
    expect(chart.columns[3].height).toBe(0);
  });

  it('shows the empty message when the range has no sales', () => {
    const chart = render(new Array(30).fill(0));
    expect(chart.hasValues).toBe(false);
  });

  it('labels at most 8 dates along the bottom for 30 days', () => {
    const chart = render(new Array(30).fill(100));
    expect(chart.xLabelIndexes.size).toBeLessThanOrEqual(8);
    expect(chart.xLabelIndexes.has(0)).toBe(true);
  });
});
