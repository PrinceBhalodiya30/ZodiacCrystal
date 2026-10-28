import { getMoonPhaseAndTransit } from './lunar-transit.util';

describe('lunarTransitUtil', () => {
  it('computes valid moon transit data for current date', () => {
    const data = getMoonPhaseAndTransit(new Date());

    expect(data).toBeTruthy();
    expect(data.phaseName).toBeTruthy();
    expect(data.phaseIcon).toMatch(/[🌑🌒🌓🌔🌕🌖🌗🌘]/);
    expect(data.illuminationPct).toBeGreaterThanOrEqual(0);
    expect(data.illuminationPct).toBeLessThanOrEqual(100);

    expect(data.sign).toBeTruthy();
    expect(data.sign.name).toBeTruthy();
    expect(data.sign.symbol).toBeTruthy();
    expect(data.sign.rashi).toBeTruthy();

    expect(data.crystal).toBeTruthy();
    expect(data.crystal.name).toBeTruthy();
    expect(data.crystal.benefit).toBeTruthy();
    expect(data.crystal.searchTerm).toBeTruthy();

    expect(data.tickerText).toContain('· Best Crystal Today:');
  });

  it('generates consistent dateKey format YYYY-MM-DD', () => {
    const testDate = new Date(2026, 9, 28, 12, 0, 0); // Oct 28, 2026
    const data = getMoonPhaseAndTransit(testDate);
    expect(data.dateKey).toBe('2026-10-28');
  });

  it('determines moon sign and crystal alignment for known anchor date', () => {
    // Oct 28, 2026: Moon is in Gemini
    const testDate = new Date('2026-10-28T12:00:00Z');
    const data = getMoonPhaseAndTransit(testDate);

    expect(['Gemini', 'Taurus', 'Cancer']).toContain(data.sign.name);
    expect(data.crystal.name).toBeTruthy();
    expect(data.crystal.benefit).toBeTruthy();
  });

  it('includes proper ticker structure matching expected user banner', () => {
    const data = getMoonPhaseAndTransit(new Date('2026-05-15T12:00:00Z'));
    expect(data.tickerText).toContain(data.phaseName);
    expect(data.tickerText).toContain(data.sign.name);
    expect(data.tickerText).toContain(data.crystal.name);
    expect(data.tickerText).toContain(data.crystal.benefit);
  });
});

