import { describe, expect, it } from 'vitest';
import { validateAddressQuality } from './address-autocomplete.util';

describe('validateAddressQuality', () => {
  it('rejects empty or whitespace-only inputs', () => {
    expect(validateAddressQuality('').valid).toBe(false);
    expect(validateAddressQuality('   ').valid).toBe(false);
  });

  it.each([
    { input: 'Road 1', expectedMessage: 'too short' },
    { input: 'aaaaaaaaa street', expectedMessage: 'repeated characters' },
    { input: 'Somewhere', expectedMessage: 'building/house number' }
  ])('rejects invalid address "$input" with message containing "$expectedMessage"', ({ input, expectedMessage }) => {
    const res = validateAddressQuality(input);
    expect(res.valid).toBe(false);
    expect(res.message).toContain(expectedMessage);
  });

  it.each(['asdfghjk', 'test', 'testing', 'qwerty'])('rejects common dummy string "%s"', (dummy) => {
    expect(validateAddressQuality(dummy).valid).toBe(false);
  });

  it('rejects when address simply repeats the city name', () => {
    const res = validateAddressQuality('Mumbai', 'Mumbai');
    expect(res.valid).toBe(false);
    expect(res.message).toContain('cannot just be the city name');
  });

  it('accepts legitimate Indian addresses', () => {
    expect(validateAddressQuality('Flat 402, Lotus Heights, MG Road').valid).toBe(true);
    expect(validateAddressQuality('Shop 12, Oberoi Mall, Goregaon').valid).toBe(true);
    expect(validateAddressQuality('House #14, Sector 15, Gandhinagar').valid).toBe(true);
    expect(validateAddressQuality('Adajan Gam, Hazira Road, Surat').valid).toBe(true);
  });
});

