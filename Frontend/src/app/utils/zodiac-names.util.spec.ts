import { describe, it, expect } from 'vitest';
import {
  formatZodiacDual,
  formatZodiacCompact,
  getRashiWithDevanagari,
  getRashiSimple,
  getVedicZodiacInfo
} from './zodiac-names.util';

describe('zodiac-names.util', () => {
  it('formats dual name correctly for Aries', () => {
    expect(formatZodiacDual('Aries')).toBe('Aries · Mesha (मेष)');
  });

  it('formats dual name correctly for Capricorn', () => {
    expect(formatZodiacDual('Capricorn')).toBe('Capricorn · Makara (मकर)');
  });

  it('formats compact name correctly for admin/dropdowns', () => {
    expect(formatZodiacCompact('Aries')).toBe('Aries (Mesha)');
    expect(formatZodiacCompact('Scorpio')).toBe('Scorpio (Vrishchika)');
  });

  it('extracts rashi with devanagari', () => {
    expect(getRashiWithDevanagari('Leo')).toBe('Simha (सिंह)');
    expect(getRashiWithDevanagari('Pisces')).toBe('Meena (मीन)');
  });

  it('extracts simple rashi', () => {
    expect(getRashiSimple('Gemini')).toBe('Mithuna');
  });

  it('handles unknown or empty names gracefully', () => {
    expect(formatZodiacDual('')).toBe('');
    expect(formatZodiacDual(null)).toBe('');
    expect(formatZodiacDual('UnknownSign')).toBe('UnknownSign');
  });

  it('returns full info object', () => {
    const info = getVedicZodiacInfo('Taurus');
    expect(info).not.toBeNull();
    expect(info?.rashi).toBe('Vrishabha');
    expect(info?.element).toBe('Prithvi (Earth)');
    expect(info?.graha).toBe('Shukra (Venus)');
  });

  it('respects custom rashiName when provided', () => {
    expect(formatZodiacDual('Aries', 'Mesha Custom (मेष)')).toBe('Aries · Mesha Custom (मेष)');
    expect(formatZodiacCompact('Aries', 'Mesha Custom')).toBe('Aries (Mesha Custom)');
    expect(getRashiWithDevanagari('Aries', 'Mesha Custom (मेष)')).toBe('Mesha Custom (मेष)');
    expect(getRashiSimple('Aries', 'Mesha Custom (मेष)')).toBe('Mesha');
  });
});
