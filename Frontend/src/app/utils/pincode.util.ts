export interface PincodeDeliveryInfo {
  pincode: string;
  location: string;
  deliveryDate: string;
  estimatedDays: string;
  shippingType: string;
  codAvailable: boolean;
  deliverable: boolean;
}

const PINCODE_STORAGE_KEY = 'zodiac_delivery_pincode';

interface PincodeLocationInfo {
  location: string;
  daysToAdd: number;
}

const CITY_PREFIX_MAP: Record<string, PincodeLocationInfo> = {
  // 4-digit prefixes - Gujarat (Local / Intra-State origin)
  '3950': { location: 'Surat, Gujarat', daysToAdd: 2 },
  '3800': { location: 'Ahmedabad, Gujarat', daysToAdd: 2 },
  '3900': { location: 'Vadodara, Gujarat', daysToAdd: 2 },
  '3600': { location: 'Rajkot, Gujarat', daysToAdd: 2 },

  // Delhi NCR (Tier-1 Northern Hub)
  '1220': { location: 'Gurugram, NCR', daysToAdd: 3 },
  '1210': { location: 'Faridabad, NCR', daysToAdd: 3 },
  '2013': { location: 'Noida, NCR', daysToAdd: 3 },
  '2010': { location: 'Ghaziabad, NCR', daysToAdd: 3 },

  // 3-digit prefixes - Gujarat
  '395': { location: 'Surat, Gujarat', daysToAdd: 2 },
  '380': { location: 'Ahmedabad, Gujarat', daysToAdd: 2 },
  '382': { location: 'Ahmedabad / Gandhinagar, Gujarat', daysToAdd: 2 },
  '390': { location: 'Vadodara, Gujarat', daysToAdd: 2 },
  '360': { location: 'Rajkot, Gujarat', daysToAdd: 2 },

  // Western & Nearby Metros (Fast 2-3 day transit)
  '400': { location: 'Mumbai, Maharashtra', daysToAdd: 3 },
  '411': { location: 'Pune, Maharashtra', daysToAdd: 3 },
  '302': { location: 'Jaipur, Rajasthan', daysToAdd: 3 },
  '452': { location: 'Indore, Madhya Pradesh', daysToAdd: 3 },
  '160': { location: 'Chandigarh', daysToAdd: 4 },

  // Southern & Eastern Metros (3-4 day transit)
  '560': { location: 'Bengaluru, Karnataka', daysToAdd: 4 },
  '500': { location: 'Hyderabad, Telangana', daysToAdd: 4 },
  '600': { location: 'Chennai, Tamil Nadu', daysToAdd: 4 },
  '700': { location: 'Kolkata, West Bengal', daysToAdd: 4 },
  '226': { location: 'Lucknow, Uttar Pradesh', daysToAdd: 4 },
  '682': { location: 'Kochi, Kerala', daysToAdd: 5 },

  // 2-digit major cities
  '11': { location: 'New Delhi, Delhi NCR', daysToAdd: 3 }
};

interface RegionRange {
  min: number;
  max: number;
  location: string;
  daysToAdd: number;
}

const REGIONAL_RANGES: RegionRange[] = [
  { min: 12, max: 13, location: 'Haryana', daysToAdd: 4 },
  { min: 14, max: 16, location: 'Punjab', daysToAdd: 4 },
  { min: 17, max: 17, location: 'Himachal Pradesh', daysToAdd: 6 },
  { min: 18, max: 19, location: 'Jammu & Kashmir', daysToAdd: 7 },
  { min: 20, max: 28, location: 'Uttar Pradesh & Uttarakhand', daysToAdd: 5 },
  { min: 30, max: 34, location: 'Rajasthan', daysToAdd: 3 },
  { min: 36, max: 39, location: 'Gujarat', daysToAdd: 2 },
  { min: 40, max: 44, location: 'Maharashtra & Goa', daysToAdd: 3 },
  { min: 45, max: 49, location: 'Madhya Pradesh & Chhattisgarh', daysToAdd: 4 },
  { min: 50, max: 53, location: 'Andhra Pradesh & Telangana', daysToAdd: 4 },
  { min: 56, max: 59, location: 'Karnataka', daysToAdd: 4 },
  { min: 60, max: 64, location: 'Tamil Nadu', daysToAdd: 5 },
  { min: 67, max: 69, location: 'Kerala', daysToAdd: 5 },
  { min: 70, max: 74, location: 'West Bengal & Sikkim', daysToAdd: 5 },
  { min: 75, max: 77, location: 'Odisha', daysToAdd: 6 },
  { min: 78, max: 79, location: 'North East India', daysToAdd: 7 },
  { min: 80, max: 85, location: 'Bihar & Jharkhand', daysToAdd: 6 }
];

function getRegionalLocation(prefix2: string): PincodeLocationInfo {
  const p2 = Number.parseInt(prefix2, 10);
  const match = REGIONAL_RANGES.find(r => p2 >= r.min && p2 <= r.max);
  return match ?? { location: 'All India Coverage', daysToAdd: 5 };
}

function resolvePincodeLocation(cleanPin: string): PincodeLocationInfo {
  const p4 = cleanPin.slice(0, 4);
  if (CITY_PREFIX_MAP[p4]) return CITY_PREFIX_MAP[p4];

  const p3 = cleanPin.slice(0, 3);
  if (CITY_PREFIX_MAP[p3]) return CITY_PREFIX_MAP[p3];

  const p2 = cleanPin.slice(0, 2);
  if (CITY_PREFIX_MAP[p2]) return CITY_PREFIX_MAP[p2];

  return getRegionalLocation(p2);
}

/**
 * Checks an Indian postal pincode and returns simulated delivery estimate,
 * city/state coverage, and COD availability for e-commerce product pages.
 */
export function checkDeliveryPincode(pincode: string): PincodeDeliveryInfo | null {
  const cleanPin = (pincode || '').trim();
  if (!/^\d{6}$/.test(cleanPin)) {
    return null;
  }

  const { location, daysToAdd } = resolvePincodeLocation(cleanPin);

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysToAdd);

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  };
  const deliveryDate = targetDate.toLocaleDateString('en-US', options);

  const estimatedDays = daysToAdd <= 2
    ? '1–2 business days'
    : `${daysToAdd - 1}–${daysToAdd} business days`;

  return {
    pincode: cleanPin,
    location,
    deliveryDate,
    estimatedDays,
    shippingType: daysToAdd <= 4 ? 'Free Express Shipping' : 'Standard Insured Delivery',
    codAvailable: true,
    deliverable: true
  };
}

export function getSavedPincode(): string {
  try {
    return localStorage.getItem(PINCODE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function savePincode(pincode: string): void {
  try {
    localStorage.setItem(PINCODE_STORAGE_KEY, pincode);
  } catch {
    // Ignore storage failure
  }
}
