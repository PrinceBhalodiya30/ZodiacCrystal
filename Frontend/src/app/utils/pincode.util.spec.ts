import { describe, expect, it } from 'vitest';
import { checkDeliveryPincode } from './pincode.util';

describe('checkDeliveryPincode', () => {
  it('returns null for invalid formats', () => {
    expect(checkDeliveryPincode('')).toBeNull();
    expect(checkDeliveryPincode('123')).toBeNull();
    expect(checkDeliveryPincode('abcdef')).toBeNull();
    expect(checkDeliveryPincode('1234567')).toBeNull();
  });

  it('correctly maps Ahmedabad pincode (380015)', () => {
    const res = checkDeliveryPincode('380015');
    expect(res).not.toBeNull();
    expect(res?.location).toContain('Ahmedabad');
    expect(res?.deliverable).toBe(true);
    expect(res?.codAvailable).toBe(true);
    expect(res?.shippingType).toBe('Free Express Shipping');
  });

  it('correctly maps New Delhi pincode (110001)', () => {
    const res = checkDeliveryPincode('110001');
    expect(res).not.toBeNull();
    expect(res?.location).toContain('New Delhi');
    expect(res?.deliverable).toBe(true);
  });

  it('correctly maps Mumbai pincode (400001)', () => {
    const res = checkDeliveryPincode('400001');
    expect(res).not.toBeNull();
    expect(res?.location).toContain('Mumbai');
    expect(res?.deliverable).toBe(true);
  });

  it('correctly maps Bengaluru pincode (560001)', () => {
    const res = checkDeliveryPincode('560001');
    expect(res).not.toBeNull();
    expect(res?.location).toContain('Bengaluru');
    expect(res?.deliverable).toBe(true);
  });

  it('handles any valid 6-digit Indian pincode gracefully', () => {
    const res = checkDeliveryPincode('751001');
    expect(res).not.toBeNull();
    expect(res?.location).toContain('Odisha');
    expect(res?.deliveryDate).toBeTruthy();
  });

  it('provides a realistic delivery timeline matching Indian e-commerce standards', () => {
    const res = checkDeliveryPincode('380015');
    expect(res).not.toBeNull();
    // Delivery date should be formatted with weekday name (e.g. Thursday, Oct 29)
    expect(res?.deliveryDate).toMatch(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s[A-Z][a-z]{2}\s\d{1,2}$/);
  });
});
