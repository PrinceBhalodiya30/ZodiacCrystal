import { describe, it, expect } from 'vitest';
import { getZodiacSignByBirthday } from './zodiac-finder.util';

describe('getZodiacSignByBirthday (Vedic / Indian Calendar)', () => {
  it('correctly identifies Mesha (Aries): Apr 14 – May 14', () => {
    expect(getZodiacSignByBirthday(4, 14).signName).toBe('Aries');
    expect(getZodiacSignByBirthday(4, 14).rashiName).toBe('Mesha (मेष)');
    expect(getZodiacSignByBirthday(5, 14).signName).toBe('Aries');
  });

  it('correctly identifies Vrishabha (Taurus): May 15 – Jun 14', () => {
    expect(getZodiacSignByBirthday(5, 15).signName).toBe('Taurus');
    expect(getZodiacSignByBirthday(5, 15).rashiName).toBe('Vrishabha (वृषभ)');
    expect(getZodiacSignByBirthday(6, 14).signName).toBe('Taurus');
  });

  it('correctly identifies Mithuna (Gemini): Jun 15 – Jul 15', () => {
    expect(getZodiacSignByBirthday(6, 15).signName).toBe('Gemini');
    expect(getZodiacSignByBirthday(6, 15).rashiName).toBe('Mithuna (मिथुन)');
    expect(getZodiacSignByBirthday(7, 15).signName).toBe('Gemini');
  });

  it('correctly identifies Karka (Cancer): Jul 16 – Aug 16', () => {
    expect(getZodiacSignByBirthday(7, 16).signName).toBe('Cancer');
    expect(getZodiacSignByBirthday(7, 16).rashiName).toBe('Karka (कर्क)');
    expect(getZodiacSignByBirthday(8, 16).signName).toBe('Cancer');
  });

  it('correctly identifies Simha (Leo): Aug 17 – Sep 16', () => {
    expect(getZodiacSignByBirthday(8, 17).signName).toBe('Leo');
    expect(getZodiacSignByBirthday(8, 17).rashiName).toBe('Simha (सिंह)');
    expect(getZodiacSignByBirthday(9, 16).signName).toBe('Leo');
  });

  it('correctly identifies Kanya (Virgo): Sep 17 – Oct 16', () => {
    expect(getZodiacSignByBirthday(9, 17).signName).toBe('Virgo');
    expect(getZodiacSignByBirthday(9, 17).rashiName).toBe('Kanya (कन्या)');
    expect(getZodiacSignByBirthday(10, 16).signName).toBe('Virgo');
  });

  it('correctly identifies Tula (Libra): Oct 17 – Nov 15', () => {
    expect(getZodiacSignByBirthday(10, 17).signName).toBe('Libra');
    expect(getZodiacSignByBirthday(10, 17).rashiName).toBe('Tula (तुला)');
    expect(getZodiacSignByBirthday(11, 15).signName).toBe('Libra');
  });

  it('correctly identifies Vrishchika (Scorpio): Nov 16 – Dec 15', () => {
    expect(getZodiacSignByBirthday(11, 16).signName).toBe('Scorpio');
    expect(getZodiacSignByBirthday(11, 16).rashiName).toBe('Vrishchika (वृश्चिक)');
    expect(getZodiacSignByBirthday(12, 15).signName).toBe('Scorpio');
  });

  it('correctly identifies Dhanu (Sagittarius): Dec 16 – Jan 13', () => {
    expect(getZodiacSignByBirthday(12, 16).signName).toBe('Sagittarius');
    expect(getZodiacSignByBirthday(12, 31).signName).toBe('Sagittarius');
    expect(getZodiacSignByBirthday(1, 1).signName).toBe('Sagittarius');
    expect(getZodiacSignByBirthday(1, 13).signName).toBe('Sagittarius');
  });

  it('correctly identifies Makara (Capricorn): Jan 14 (Makar Sankranti) – Feb 12', () => {
    expect(getZodiacSignByBirthday(1, 14).signName).toBe('Capricorn');
    expect(getZodiacSignByBirthday(1, 14).rashiName).toBe('Makara (मकर)');
    expect(getZodiacSignByBirthday(2, 12).signName).toBe('Capricorn');
  });

  it('correctly identifies Kumbha (Aquarius): Feb 13 – Mar 13', () => {
    expect(getZodiacSignByBirthday(2, 13).signName).toBe('Aquarius');
    expect(getZodiacSignByBirthday(2, 13).rashiName).toBe('Kumbha (कुंभ)');
    expect(getZodiacSignByBirthday(3, 13).signName).toBe('Aquarius');
  });

  it('correctly identifies Meena (Pisces): Mar 14 – Apr 13', () => {
    expect(getZodiacSignByBirthday(3, 14).signName).toBe('Pisces');
    expect(getZodiacSignByBirthday(3, 14).rashiName).toBe('Meena (मीन)');
    expect(getZodiacSignByBirthday(4, 13).signName).toBe('Pisces');
  });

  it('throws for out-of-range dates', () => {
    expect(() => getZodiacSignByBirthday(0, 10)).toThrow();
    expect(() => getZodiacSignByBirthday(13, 10)).toThrow();
    expect(() => getZodiacSignByBirthday(5, 32)).toThrow();
  });
});
