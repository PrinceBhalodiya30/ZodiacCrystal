import type * as L from 'leaflet';

export interface PickedAddress {
  line: string;
  city: string;
  state: string;
  postalCode: string;
  lat: number;
  lng: number;
}

export interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address: Record<string, string | undefined>;
  placeId?: string;
}

export interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

export interface OverpassWay {
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

export type IndiaGeometry =
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] };

export const NOMINATIM = 'https://nominatim.openstreetmap.org';
export const PHOTON = 'https://photon.komoot.io/api';
export const BUILDING_ZOOM = 17;
export const BUILDING_STYLE: L.PathOptions = { color: '#7b3fe4', weight: 1, fillOpacity: 0.08 };
export const SELECTED_BUILDING_STYLE: L.PathOptions = { color: '#7b3fe4', weight: 3, fillOpacity: 0.35 };
export const OVERPASS = 'https://overpass-api.de/api/interpreter';
export const DEFAULT_CENTER: [number, number] = [22.5, 79];
export const INDIA_BOUNDS: [[number, number], [number, number]] = [[6, 68], [37.5, 97.5]];

export function buildLine(result: NominatimResult): string {
  const a = result.address;
  const drop = new Set([a['postcode'], a['country']].filter((x): x is string => !!x).map(x => x.trim().toLowerCase()));
  const seen = new Set<string>();
  return result.display_name
    .split(',')
    .map(p => p.trim())
    .filter(p => {
      const k = p.toLowerCase();
      if (!p || drop.has(k) || /^[1-9]\d{5}$/.test(p) || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(', ');
}

export function buildingLabel(t: Record<string, string> | undefined): string | null {
  if (!t) return null;
  const name = t['name:en'] ?? t['name'] ?? t['addr:housename'];
  return [t['addr:housenumber'], name].filter(Boolean).join(' ') || null;
}

export function fromPhoton(f: PhotonFeature): NominatimResult {
  const p = f.properties;
  const [lon, lat] = f.geometry.coordinates;
  const seen = new Set<string>();
  const display_name = [
    p['name'], [p['housenumber'], p['street']].filter(Boolean).join(' '),
    p['locality'], p['district'], p['city'], p['county'], p['state'], p['postcode'], p['country']
  ]
    .filter((x): x is string => {
      if (!x || seen.has(x.toLowerCase())) return false;
      seen.add(x.toLowerCase());
      return true;
    })
    .join(', ');
  return {
    lat: String(lat),
    lon: String(lon),
    display_name,
    name: p['name'],
    address: {
      road: p['street'], suburb: p['locality'] ?? p['district'], city: p['city'], county: p['county'],
      state: p['state'], postcode: p['postcode'], country: p['country']
    }
  };
}

export function fromGoogle(formatted: string, parts: { name: string; types: string[] }[], name?: string): NominatimResult {
  const get = (type: string) => parts.find(p => p.types.includes(type))?.name;
  let display_name = formatted.replace(/\b[1-9]\d{5}\b/, '').replaceAll(' ,', ',').trim();
  if (name && !display_name.toLowerCase().includes(name.toLowerCase())) display_name = `${name}, ${display_name}`;
  return {
    lat: '',
    lon: '',
    display_name,
    name,
    address: {
      road: get('route'),
      neighbourhood: get('sublocality_level_2'),
      suburb: get('sublocality_level_1') ?? get('sublocality'),
      city: get('locality'),
      state_district: get('administrative_area_level_3'),
      county: get('administrative_area_level_2'),
      state: get('administrative_area_level_1'),
      postcode: get('postal_code'),
      country: get('country')
    }
  };
}

