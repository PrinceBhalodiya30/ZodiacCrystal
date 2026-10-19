import { INDIA_STATE_CITIES, INDIA_STATES } from '../data/india-locations.data';

// Maps and India Post often use old or administrative names ("Bangalore Urban District",
// "Gurgaon") where our dropdown has the current city name.
const CITY_ALIASES: Record<string, string> = {
  bangalore: 'bengaluru', gurgaon: 'gurugram', bombay: 'mumbai', calcutta: 'kolkata',
  madras: 'chennai', mysore: 'mysuru', poona: 'pune', baroda: 'vadodara',
  trivandrum: 'thiruvananthapuram', cochin: 'kochi', ernakulam: 'kochi', vizag: 'visakhapatnam',
  pondicherry: 'puducherry', allahabad: 'prayagraj', mangalore: 'mangaluru',
  belgaum: 'belagavi', hubli: 'hubballi', gulbarga: 'kalaburagi', benares: 'varanasi',
  ahmadabad: 'ahmedabad', vadodra: 'vadodara'
};

// Old state names India Post and maps still use, mapped to the current ones in our dropdown.
const STATE_ALIASES: Record<string, string> = {
  damananddiu: 'Dadra and Nagar Haveli and Daman and Diu',
  dadraandnagarhaveli: 'Dadra and Nagar Haveli and Daman and Diu',
  orissa: 'Odisha',
  uttaranchal: 'Uttarakhand',
  pondicherry: 'Puducherry'
};

export const normalize = (s: string): string => {
  const n = s
    .toLowerCase()
    // "Daman & Diu" and "Daman and Diu" are the same name.
    .replace(/&/g, ' and ')
    .replace(/\b(district|taluka|tehsil|tahsil|municipal corporation|corporation|city|urban|rural|subdivision|division|metropolitan region)\b/g, '')
    .replace(/[^a-z]/g, '');
  return CITY_ALIASES[n] ?? n;
};

// Our dropdown's state name for a state as another service spells it.
export function matchState(state: string): string {
  const n = normalize(state);
  if (!n) return '';
  if (STATE_ALIASES[n]) return STATE_ALIASES[n];
  // Exact first, then containment (e.g. "National Capital Territory of Delhi" -> "Delhi").
  return INDIA_STATES.find(s => normalize(s) === n)
    ?? INDIA_STATES.find(s => n.includes(normalize(s)) || normalize(s).includes(n))
    ?? state;
}

// The first candidate that is a city in our dropdown for that state.
export function matchCity(state: string, candidates: string[]): string | null {
  const cities = INDIA_STATE_CITIES[state] ?? [];
  for (const candidate of candidates) {
    const n = normalize(candidate);
    const hit = cities.find(c => normalize(c) === n);
    if (hit) return hit;
  }
  return null;
}

export const INDIA_POST = 'https://api.postalpincode.in';
export const VALID_PIN = /^[1-9][0-9]{5}$/;

export interface IndiaPostResponse {
  Status: string;
  PostOffice: {
    Name: string; District: string; Division: string; Block: string; State: string;
    Pincode: string; DeliveryStatus: string;
  }[] | null;
}

export interface PinPlace {
  state: string;
  city: string;
  // Every name India Post gives this post office's area (normalized), for checking a typed city.
  names: string[];
}

// Places India Post lists for a PIN (empty for an unknown PIN); null while the service is down.
const pinCache = new Map<string, Promise<PinPlace[] | null>>();

export function lookupPinPlaces(pin: string): Promise<PinPlace[] | null> {
  pin = pin.trim();
  if (!VALID_PIN.test(pin)) return Promise.resolve([]);
  let result = pinCache.get(pin);
  if (!result) {
    result = fetch(`${INDIA_POST}/pincode/${pin}`)
      .then(r => r.json() as Promise<IndiaPostResponse[]>)
      .then(([data]) => (data?.PostOffice ?? []).map(office => {
        const state = matchState(office.State);
        const candidates = [office.District, office.Block, office.Division].filter(Boolean);
        // Prefer a city from our dropdown; otherwise the district, shown under "Other".
        return {
          state,
          city: matchCity(state, candidates) ?? office.District,
          names: [office.Name, ...candidates].map(normalize).filter(Boolean)
        };
      }))
      .catch(() => {
        pinCache.delete(pin); // Don't remember an outage.
        return null;
      });
    pinCache.set(pin, result);
  }
  return result;
}

export const sameState = (a: string, b: string): boolean => normalize(matchState(a)) === normalize(matchState(b));

// Whether a city belongs to a PIN's area: its district, block, division or post office
// name. Partial matches count ("Morbi H.O" is Morbi) for names of 4+ letters, so a town
// typed under "Other" or a newer district India Post files under an older one still passes.
export function cityMatchesPlace(city: string, place: PinPlace): boolean {
  const c = normalize(city);
  if (!c) return false;
  return place.names.some(n => n === c || (c.length >= 4 && n.length >= 4 && (n.includes(c) || c.includes(n))));
}
