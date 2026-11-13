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

  it.each([
    { pincode: '110001', city: 'New Delhi' },
    { pincode: '400001', city: 'Mumbai' },
    { pincode: '560001', city: 'Bengaluru' }
  ])('correctly maps $city pincode ($pincode)', ({ pincode, city }) => {
    const res = checkDeliveryPincode(pincode);
    expect(res).not.toBeNull();
    expect(res?.location).toContain(city);
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
