import { describe, expect, it } from 'vitest';
import { validateAddressQuality } from './address-autocomplete.util';

describe('validateAddressQuality', () => {
  it('rejects empty or whitespace-only inputs', () => {
    expect(validateAddressQuality('').valid).toBe(false);
    expect(validateAddressQuality('   ').valid).toBe(false);
  });

  it('rejects inputs that are too short to be a valid street address', () => {
    const res = validateAddressQuality('Road 1');
    expect(res.valid).toBe(false);
    expect(res.message).toContain('too short');
  });

  it('rejects character-mash and repeated letters', () => {
    const res = validateAddressQuality('aaaaaaaaa street');
    expect(res.valid).toBe(false);
    expect(res.message).toContain('repeated characters');
  });

  it('rejects common test and dummy strings', () => {
    expect(validateAddressQuality('asdfghjk').valid).toBe(false);
    expect(validateAddressQuality('test').valid).toBe(false);
    expect(validateAddressQuality('testing').valid).toBe(false);
    expect(validateAddressQuality('qwerty').valid).toBe(false);
  });

  it('rejects single-word addresses', () => {
    const res = validateAddressQuality('Somewhere');
    expect(res.valid).toBe(false);
    expect(res.message).toContain('building/house number');
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

