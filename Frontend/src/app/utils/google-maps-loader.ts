// Shared by every map on the page (checkout picker, admin order map) so the
// Maps JavaScript API script is only ever added once.

export const google = () => (window as any).google;

// Set once Google fails (bad key, daily limit, blocked script); maps then stay on OpenStreetMap.
let googleFailed = false;
let googleLoad: Promise<any> | undefined;
let onGoogleFailure: (() => void) | undefined;

export function isGoogleFailed(): boolean {
  return googleFailed;
}

export function markGoogleFailed(): void {
  googleFailed = true;
}

// Loads the Maps JavaScript API once per page. region=IN makes Google draw India's official borders.
export function loadGoogle(key: string, onFailure: () => void): Promise<any> {
  onGoogleFailure = onFailure;
  return googleLoad ??= new Promise((resolve, reject) => {
    const w = window as any;
    w.__zodiacMapsReady = () => resolve(w.google);
    // Google calls this when it rejects the key, including when the demo key's daily limit is used up.
    w.gm_authFailure = () => onGoogleFailure?.();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      '&v=weekly&loading=async&region=IN&language=en&callback=__zodiacMapsReady';
    script.async = true;
    script.onerror = () => {
      googleLoad = undefined;
      reject(new Error('Google Maps failed to load'));
    };
    document.head.appendChild(script);
  });
}
