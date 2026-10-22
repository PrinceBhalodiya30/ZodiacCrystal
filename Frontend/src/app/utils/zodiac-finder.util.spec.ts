import { describe, it, expect } from 'vitest';
import { getZodiacSignByBirthday } from './zodiac-finder.util';

describe('getZodiacSignByBirthday', () => {
  it('correctly identifies Aries', () => {
    expect(getZodiacSignByBirthday(3, 21).signName).toBe('Aries');
    expect(getZodiacSignByBirthday(4, 19).signName).toBe('Aries');
  });

  it('correctly identifies Taurus', () => {
    expect(getZodiacSignByBirthday(4, 20).signName).toBe('Taurus');
    expect(getZodiacSignByBirthday(5, 20).signName).toBe('Taurus');
  });

  it('correctly identifies Gemini', () => {
    expect(getZodiacSignByBirthday(5, 21).signName).toBe('Gemini');
    expect(getZodiacSignByBirthday(6, 20).signName).toBe('Gemini');
  });

  it('correctly identifies Cancer', () => {
    expect(getZodiacSignByBirthday(6, 21).signName).toBe('Cancer');
    expect(getZodiacSignByBirthday(7, 22).signName).toBe('Cancer');
  });

  it('correctly identifies Leo', () => {
    expect(getZodiacSignByBirthday(7, 23).signName).toBe('Leo');
    expect(getZodiacSignByBirthday(8, 22).signName).toBe('Leo');
  });

  it('correctly identifies Virgo', () => {
    expect(getZodiacSignByBirthday(8, 23).signName).toBe('Virgo');
    expect(getZodiacSignByBirthday(9, 22).signName).toBe('Virgo');
  });

  it('correctly identifies Libra', () => {
    expect(getZodiacSignByBirthday(9, 23).signName).toBe('Libra');
    expect(getZodiacSignByBirthday(10, 22).signName).toBe('Libra');
  });

  it('correctly identifies Scorpio', () => {
    expect(getZodiacSignByBirthday(10, 23).signName).toBe('Scorpio');
    expect(getZodiacSignByBirthday(11, 21).signName).toBe('Scorpio');
  });

  it('correctly identifies Sagittarius', () => {
    expect(getZodiacSignByBirthday(11, 22).signName).toBe('Sagittarius');
    expect(getZodiacSignByBirthday(12, 21).signName).toBe('Sagittarius');
  });

  it('correctly identifies Capricorn (across year boundary)', () => {
    expect(getZodiacSignByBirthday(12, 22).signName).toBe('Capricorn');
    expect(getZodiacSignByBirthday(12, 31).signName).toBe('Capricorn');
    expect(getZodiacSignByBirthday(1, 1).signName).toBe('Capricorn');
    expect(getZodiacSignByBirthday(1, 19).signName).toBe('Capricorn');
  });

  it('correctly identifies Aquarius', () => {
    expect(getZodiacSignByBirthday(1, 20).signName).toBe('Aquarius');
    expect(getZodiacSignByBirthday(2, 18).signName).toBe('Aquarius');
  });

  it('correctly identifies Pisces', () => {
    expect(getZodiacSignByBirthday(2, 19).signName).toBe('Pisces');
    expect(getZodiacSignByBirthday(3, 20).signName).toBe('Pisces');
  });

  it('throws for out-of-range dates', () => {
    expect(() => getZodiacSignByBirthday(0, 10)).toThrow();
    expect(() => getZodiacSignByBirthday(13, 10)).toThrow();
    expect(() => getZodiacSignByBirthday(5, 32)).toThrow();
  });
});
