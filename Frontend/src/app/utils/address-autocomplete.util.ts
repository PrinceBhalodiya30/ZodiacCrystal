import { matchCity, matchState, normalize } from './india-address.util';

export interface AddressSuggestion {
  id: string;
  primaryText: string;
  secondaryText: string;
  fullLine: string;
  city: string;
  state: string;
  postalCode: string;
  lat: number;
  lng: number;
}

export interface AddressQualityResult {
  valid: boolean;
  message?: string;
}

const GIBBERISH_WORDS = new Set([
  'test', 'testing', 'asdf', 'asdfgh', 'asdfghjk', 'qwerty', 'zxcvbn',
  'sample', 'fake', 'dummy', 'none', 'na', 'n/a', 'null', 'temp', 'xyz', 'xxx',
  'address', 'my address', 'home', 'house', 'road', 'street', 'city'
]);

/**
 * Validates shipping address line quality to protect against gibberish,
 * single-word entries, or simply repeating the city name.
 */
export function validateAddressQuality(line: string, city = ''): AddressQualityResult {
  const trimmed = line.trim();
  if (!trimmed) {
    return { valid: false, message: 'Address is required.' };
  }

  // Disallow simply re-typing only the city name
  if (city && normalize(trimmed) === normalize(city)) {
    return {
      valid: false,
      message: `Address cannot just be the city name (${city}). Please add your flat/house and street.`
    };
  }

  // Minimum length check
  if (trimmed.length < 8) {
    return {
      valid: false,
      message: 'Address is too short. Please provide building, street, and area details.'
    };
  }

  // Repeated character mash (e.g., "aaaaaa", "111111")
  if (/(.)\1{4,}/i.test(trimmed)) {
    return {
      valid: false,
      message: 'Address contains repeated characters. Please enter a valid delivery address.'
    };
  }

  // Common placeholder / dummy entries
  const lower = trimmed.toLowerCase();
  if (GIBBERISH_WORDS.has(lower)) {
    return {
      valid: false,
      message: 'Please enter a genuine street and building address for courier delivery.'
    };
  }

  // Word count check: genuine street addresses have at least 2 distinct words
  const words = trimmed.split(/[\s,.-]+/).filter(w => w.length > 0);
  if (words.length < 2) {
    return {
      valid: false,
      message: 'Please include both your building/house number and street or locality.'
    };
  }

  return { valid: true };
}

/**
 * Fetches real-time relevant address suggestions from the free, open Photon API.
 * Uses center-of-India biasing (lat: 20.59, lon: 78.96) for accurate local results.
 */
export async function fetchAddressSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lat=20.5937&lon=78.9629&lang=en`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];

    const data = await res.json();
    const features: any[] = data?.features ?? [];

    const suggestions: AddressSuggestion[] = [];
    const seen = new Set<string>();

    for (const f of features) {
      const p = f.properties ?? {};
      const coords = f.geometry?.coordinates ?? [0, 0];
      const lng = coords[0];
      const lat = coords[1];

      // Prefer Indian locations
      if (p.countrycode && p.countrycode.toLowerCase() !== 'in') {
        continue;
      }

      const name = p.name ? p.name.trim() : '';
      const street = p.street ? p.street.trim() : '';
      const houseNumber = p.housenumber ? p.housenumber.trim() : '';
      const locality = p.locality ? p.locality.trim() : (p.district ? p.district.trim() : '');
      const rawCity = p.city ? p.city.trim() : (p.county ? p.county.trim() : '');
      const rawState = p.state ? p.state.trim() : '';
      const postalCode = p.postcode && /^[1-9][0-9]{5}$/.test(p.postcode.trim()) ? p.postcode.trim() : '';

      // Primary text: Venue/building/house or street name
      const primaryText = name || [houseNumber, street].filter(Boolean).join(' ') || locality || rawCity;
      if (!primaryText) continue;

      // Secondary subtitle
      const secondaryParts = [
        street && street !== primaryText ? street : '',
        locality && locality !== primaryText ? locality : '',
        rawCity,
        rawState,
        postalCode
      ].filter(Boolean);

      const secondaryText = secondaryParts.join(', ');

      // Deduplicate results
      const dedupeKey = `${primaryText}|${secondaryText}`.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      // Formatted line for the textarea
      const lineParts = [
        name,
        [houseNumber, street].filter(Boolean).join(' '),
        locality
      ].filter(Boolean);

      const uniqueLineParts = Array.from(new Set(lineParts));
      const fullLine = uniqueLineParts.join(', ') || primaryText;

      // Resolve city & state with our India locations database
      const state = matchState(rawState);
      const city = state ? (matchCity(state, [rawCity, locality]) ?? rawCity) : rawCity;

      suggestions.push({
        id: String(p.osm_id || `${lat},${lng}`),
        primaryText,
        secondaryText,
        fullLine,
        city,
        state,
        postalCode,
        lat,
        lng
      });
    }

    return suggestions;
  } catch (err: any) {
    if (err?.name === 'AbortError') return [];
    return [];
  }
}

