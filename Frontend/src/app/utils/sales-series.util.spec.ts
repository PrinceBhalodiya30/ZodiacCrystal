import { buildSalesSeries, daysInRange, granularityFor, percentChange, previousRange, toDateKey } from './sales-series.util';

describe('sales-series util', () => {
  it('formats local dates without shifting to UTC', () => {
    // 1:00 AM local - toISOString() would report the previous day in IST.
    expect(toDateKey(new Date(2026, 8, 28, 1, 0))).toBe('2026-09-28');
  });

  it('counts days inclusively and finds the previous same-length range', () => {
    expect(daysInRange('2026-09-01', '2026-09-30')).toBe(30);
    expect(previousRange('2026-09-01', '2026-09-30')).toEqual({ from: '2026-08-02', to: '2026-08-31' });
    expect(previousRange('2026-09-28', '2026-09-28')).toEqual({ from: '2026-09-27', to: '2026-09-27' });
  });

  it('picks day / week / month buckets by range length', () => {
    expect(granularityFor('2026-09-01', '2026-09-30')).toBe('day');
    expect(granularityFor('2026-06-01', '2026-09-30')).toBe('week');
    expect(granularityFor('2025-09-01', '2026-09-30')).toBe('month');
  });

  it('fills days with no sales with zero', () => {
    const series = buildSalesSeries(
      [
        { date: '2026-09-01T00:00:00', revenue: 500, orderCount: 1 },
        { date: '2026-09-03T00:00:00', revenue: 1200, orderCount: 2 }
      ],
      '2026-09-01',
      '2026-09-04',
      'day'
    );
    expect(series.map(b => b.revenue)).toEqual([500, 0, 1200, 0]);
    expect(series.map(b => b.orders)).toEqual([1, 0, 2, 0]);
  });

  it('sums days into weekly and monthly buckets', () => {
    const daily = [
      { date: '2026-09-01T00:00:00', revenue: 100, orderCount: 1 },
      { date: '2026-09-07T00:00:00', revenue: 200, orderCount: 1 },
      { date: '2026-09-08T00:00:00', revenue: 300, orderCount: 2 },
      { date: '2026-10-02T00:00:00', revenue: 50, orderCount: 1 }
    ];
    const weekly = buildSalesSeries(daily, '2026-09-01', '2026-09-14', 'week');
    expect(weekly.map(b => b.revenue)).toEqual([300, 300]);

    const monthly = buildSalesSeries(daily, '2026-09-01', '2026-10-31', 'month');
    expect(monthly.map(b => b.revenue)).toEqual([600, 50]);
    expect(monthly.map(b => b.orders)).toEqual([4, 1]);
  });

  it('reports % change, or null with nothing to compare', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(100, 0)).toBeNull();
  });
});
