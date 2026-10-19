import { API_BASE_URL } from './api-config';

// Google Maps browser key, served by the backend from appsettings.json (GoogleMaps:BrowserKey).
// An empty key, or a failed request, means the free OpenStreetMap map is used instead.
let mapsKey: Promise<string> | undefined;

export function getGoogleMapsKey(): Promise<string> {
  return mapsKey ??= fetch(`${API_BASE_URL}/config/maps`)
    .then(r => (r.ok ? r.json() : { googleMapsKey: '' }))
    .then((d: { googleMapsKey?: string }) => d.googleMapsKey ?? '')
    .catch(() => {
      mapsKey = undefined; // Ask again next time the map opens.
      return '';
    });
}
