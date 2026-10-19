import { Component, ElementRef, ViewEncapsulation, OnDestroy, inject, input, output, signal, viewChild } from '@angular/core';
import { ControlContainer, FormsModule } from '@angular/forms';
import type * as L from 'leaflet';
import { INDIA_POST, IndiaPostResponse, VALID_PIN, matchCity, matchState, normalize } from '../../utils/india-address.util';
import { getGoogleMapsKey } from '../../services/maps-config';
import { google, isGoogleFailed, loadGoogle, markGoogleFailed } from '../../utils/google-maps-loader';

export interface PickedAddress {
  line: string;
  city: string;
  state: string;
  postalCode: string;
  lat: number;
  lng: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address: Record<string, string | undefined>;
  // Set on Google search suggestions, which have no position until their details are fetched.
  placeId?: string;
}

// The full English address as the map knows it (building, road, area, city, district, state),
// minus the PIN and country, which have their own fields.
function buildLine(result: NominatimResult): string {
  const a = result.address;
  const drop = new Set([a['postcode'], a['country']].filter((x): x is string => !!x).map(x => x.trim().toLowerCase()));
  const seen = new Set<string>();
  return result.display_name
    .split(',')
    .map(p => p.trim())
    .filter(p => {
      const k = p.toLowerCase();
      if (!p || drop.has(k) || /^[1-9][0-9]{5}$/.test(p) || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(', ');
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

interface OverpassWay {
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

// "12 Shanti Apartments" from a building's OSM tags, or null if it has no name/number.
function buildingLabel(t: Record<string, string> | undefined): string | null {
  if (!t) return null;
  const name = t['name:en'] ?? t['name'] ?? t['addr:housename'];
  return [t['addr:housenumber'], name].filter(Boolean).join(' ') || null;
}

// Photon returns GeoJSON; reshape it like a Nominatim result so the rest of the code is shared.
function fromPhoton(f: PhotonFeature): NominatimResult {
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

// Google's address parts, reshaped like a Nominatim result so emit() and the PIN fallback are shared.
function fromGoogle(formatted: string, parts: { name: string; types: string[] }[], name?: string): NominatimResult {
  const get = (type: string) => parts.find(p => p.types.includes(type))?.name;
  // "…, Maharashtra 400001, India": the PIN and country have their own fields.
  let display_name = formatted.replace(/\s*\b[1-9][0-9]{5}\b/, '');
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

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const PHOTON = 'https://photon.komoot.io/api';
// Building outlines are only fetched this close in; further out there are too many.
const BUILDING_ZOOM = 17;
const BUILDING_STYLE: L.PathOptions = { color: '#7b3fe4', weight: 1, fillOpacity: 0.08 };
const SELECTED_BUILDING_STYLE: L.PathOptions = { color: '#7b3fe4', weight: 3, fillOpacity: 0.35 };
const OVERPASS = 'https://overpass-api.de/api/interpreter';
// Centre of India, used until the customer searches or picks a spot.
const DEFAULT_CENTER: [number, number] = [22.5, 79];
type IndiaGeometry =
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] };
// Shared by every map on the page, so the border is only downloaded once.
let indiaBorder: Promise<IndiaGeometry> | undefined;
// South-west and north-east corners around India (lat, lng).
const INDIA_BOUNDS: [[number, number], [number, number]] = [[6, 68], [37.5, 97.5]];

// Address search + OpenStreetMap pin picker. It only suggests an address:
// the parent copies the result into its own editable fields.
// Leaflet is loaded lazily the first time the map is opened.
@Component({
  selector: 'app-address-map',
  standalone: true,
  templateUrl: './address-map.html',
  imports: [FormsModule],
  // The flat field joins the parent page's form, so that form stays invalid until it's filled.
  viewProviders: [{ provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) }],
  // Leaflet's CSS ships with the component (no angular.json / restart needed).
  // Unencapsulated because Leaflet builds its DOM outside Angular's templates;
  // every own rule is prefixed with .address-map.
  styleUrls: ['../../../../node_modules/leaflet/dist/leaflet.css', './address-map.css'],
  encapsulation: ViewEncapsulation.None
})
export class AddressMap implements OnDestroy {
  picked = output<PickedAddress>();
  // Max length of the field the address goes into (the order's ShippingAddress allows 410).
  maxLength = input(410);

  isOpen = signal(false);
  query = signal('');
  results = signal<NominatimResult[]>([]);
  isSearching = signal(false);
  isLocating = signal(false);
  message = signal('');
  flat = signal('');
  usingGoogle = signal(false);

  private mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  private leaflet?: typeof L;
  private map?: L.Map;
  private marker?: L.Marker;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private buildingTimer?: ReturnType<typeof setTimeout>;
  private buildingLayer?: L.LayerGroup;
  private buildingBounds?: L.LatLngBounds;
  private selectedBuilding?: L.Polygon;
  // Google Maps objects (untyped: the Google script is loaded at runtime, without @types).
  private gmap?: any;
  private gmarker?: any;
  private sessionToken?: any;
  // Last address sent to the parent, without the flat number, so editing the flat re-sends it.
  private lastPick?: PickedAddress;
  // Bumped on every pick so a slow PIN lookup can't overwrite a newer pick.
  private pickCount = 0;
  private lookupCount = 0;

  toggle(): void {
    this.isOpen.update(open => !open);
    if (this.isOpen()) {
      // Wait a tick so the @if renders the map container.
      setTimeout(() => this.initMap());
    } else {
      // The container is destroyed when hidden, so the map is rebuilt next time.
      this.map?.remove();
      this.map = undefined;
      this.marker = undefined;
      this.gmap = undefined;
      this.gmarker = undefined;
      this.buildingLayer = undefined;
      this.buildingBounds = undefined;
      this.selectedBuilding = undefined;
      clearTimeout(this.buildingTimer);
    }
  }

  private async initMap(): Promise<void> {
    const el = this.mapEl()?.nativeElement;
    if (!el || this.map || this.gmap) return;

    const key = isGoogleFailed() ? '' : await getGoogleMapsKey();
    if (!this.isOpen() || this.map || this.gmap) return; // Closed or built while the key was loading.
    if (key) {
      try {
        await this.initGoogle(el, key);
        return;
      } catch {
        this.useOpenStreetMap();
        return;
      }
    }

    const leafletModule: any = await import('leaflet');
    this.leaflet = (leafletModule.default ?? leafletModule) as typeof L;
    const Lf = this.leaflet;

    // We only ship within India, so the map can't be panned or zoomed out beyond it.
    this.map = Lf.map(el, {
      maxZoom: 19,
      minZoom: 4,
      maxBounds: INDIA_BOUNDS,
      maxBoundsViscosity: 1
    }).setView(DEFAULT_CENTER, 4);
    const street = Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    // Many Indian buildings are missing from the street map; satellite view shows every rooftop.
    const satellite = Lf.layerGroup([
      Lf.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Imagery &copy; Esri'
      }),
      Lf.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
      })
    ]);
    street.addTo(this.map);
    this.maskOutsideIndia();
    Lf.control.layers({ Map: street, Satellite: satellite }, undefined, { position: 'topright' }).addTo(this.map);

    // The container may still be settling into its final size when the map is created.
    setTimeout(() => this.map?.invalidateSize(), 200);

    this.buildingLayer = Lf.layerGroup().addTo(this.map);
    this.map.on('moveend', () => this.scheduleBuildings());

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.highlight(undefined);
      this.placePin(e.latlng.lat, e.latlng.lng, true);
    });
  }

  // Covers everything outside India's border so only India is visible. The border comes from
  // Nominatim (simplified) and is fetched once per page load.
  private async maskOutsideIndia(): Promise<void> {
    const map = this.map;
    const Lf = this.leaflet;
    if (!map || !Lf) return;
    try {
      indiaBorder ??= fetch(`${NOMINATIM}/search?country=India&polygon_geojson=1&polygon_threshold=0.01&format=jsonv2&limit=1`)
        .then(r => r.json())
        .then((d: { geojson: IndiaGeometry }[]) => d[0].geojson);
      const border = await indiaBorder;
      if (map !== this.map) return; // The map was closed meanwhile.

      const polygons = border.type === 'Polygon' ? [border.coordinates] : border.coordinates;
      const holes = polygons.map(p => p[0].map(([lng, lat]) => [lat, lng] as [number, number]));
      const world: [number, number][] = [[-90, -180], [-90, 180], [90, 180], [90, -180]];

      // Own pane: above the map tiles, below the building outlines and the pin.
      map.createPane('india-mask').style.zIndex = '350';
      Lf.polygon([world, ...holes], {
        pane: 'india-mask', stroke: false, fillColor: '#eeeaf3', fillOpacity: 1, interactive: false
      }).addTo(map);
      Lf.polygon(holes, {
        pane: 'india-mask', color: '#7b3fe4', weight: 1.5, fill: false, interactive: false
      }).addTo(map);
    } catch {
      indiaBorder = undefined; // Try again next time; the map still works without the mask.
    }
  }

  // Leaflet's bundled marker images don't resolve under the Angular build, so the pin is pure CSS.
  private pinIcon(): L.DivIcon {
    return this.leaflet!.divIcon({ className: 'address-map-pin', iconSize: [24, 24], iconAnchor: [12, 29] });
  }

  private async initGoogle(el: HTMLDivElement, key: string): Promise<void> {
    const g = await loadGoogle(key, () => this.useOpenStreetMap());
    const { Map } = await g.maps.importLibrary('maps');
    if (!this.isOpen() || this.mapEl()?.nativeElement !== el) return; // Closed meanwhile.
    this.gmap = new Map(el, {
      center: { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] },
      zoom: 4,
      minZoom: 4,
      // We only ship within India, so the map can't be panned outside it.
      restriction: {
        latLngBounds: { south: INDIA_BOUNDS[0][0], west: INDIA_BOUNDS[0][1], north: INDIA_BOUNDS[1][0], east: INDIA_BOUNDS[1][1] },
        strictBounds: true
      },
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy'
    });
    this.usingGoogle.set(true);

    this.gmap.addListener('click', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      this.placePin(lat, lng, false);
      if (e.placeId) {
        // A labelled building, shop or landmark: use Google's own address for it.
        e.stop();
        this.lookupPlace(e.placeId);
      } else {
        this.googleReverse(lat, lng);
      }
    });
  }

  // Google failed to load or rejected the key (e.g. the demo key's daily limit): rebuild with OpenStreetMap.
  private useOpenStreetMap(): void {
    markGoogleFailed();
    this.usingGoogle.set(false);
    this.gmap = undefined;
    this.gmarker = undefined;
    const el = this.mapEl()?.nativeElement;
    if (!el) return;
    el.replaceChildren();
    el.removeAttribute('style');
    this.initMap();
  }

  private async googleSearch(q: string): Promise<void> {
    this.isSearching.set(true);
    this.message.set('');
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await google().maps.importLibrary('places');
      // One token per search-then-pick, so Google bills it as a single session.
      this.sessionToken ??= new AutocompleteSessionToken();
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        includedRegionCodes: ['in'],
        language: 'en',
        sessionToken: this.sessionToken
      });
      this.isSearching.set(false);
      if (q !== this.query().trim()) return;
      const results: NominatimResult[] = suggestions
        .filter((s: any) => s.placePrediction)
        .map((s: any) => ({
          lat: '', lon: '', address: {},
          display_name: s.placePrediction.text.toString(),
          placeId: s.placePrediction.placeId
        }));
      this.results.set(results);
      if (results.length === 0) this.message.set('No matches. Try a nearby landmark or area.');
    } catch {
      this.isSearching.set(false);
      this.message.set('Address search is unavailable. Please type your address below.');
    }
  }

  // Full address of a Google place (a search result or a tapped building/landmark).
  private async lookupPlace(placeId: string): Promise<void> {
    const lookup = ++this.lookupCount;
    this.message.set('Finding address...');
    try {
      const { Place } = await google().maps.importLibrary('places');
      const place = new Place({ id: placeId });
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'addressComponents', 'location'] });
      this.sessionToken = undefined;
      if (lookup !== this.lookupCount) return;
      const lat = place.location.lat();
      const lng = place.location.lng();
      const data = fromGoogle(
        place.formattedAddress ?? '',
        (place.addressComponents ?? []).map((c: any) => ({ name: c.longText, types: c.types })),
        place.displayName
      );
      this.placePin(lat, lng, false);
      this.query.set(data.display_name);
      this.emit(data, lat, lng);
    } catch {
      if (lookup !== this.lookupCount) return;
      this.message.set('Could not look up this place. Please type your address below.');
    }
  }

  // Address of a tapped spot. Uses Places Nearby Search (the nearest place's address) because the
  // demo key doesn't allow the Geocoding API; falls back to OpenStreetMap if nothing is near.
  private async googleReverse(lat: number, lng: number): Promise<void> {
    const lookup = ++this.lookupCount;
    this.message.set('Finding address...');
    try {
      const { Place, SearchNearbyRankPreference } = await google().maps.importLibrary('places');
      for (const radius of [60, 300]) {
        const { places } = await Place.searchNearby({
          fields: ['formattedAddress', 'addressComponents'],
          locationRestriction: { center: { lat, lng }, radius },
          rankPreference: SearchNearbyRankPreference.DISTANCE,
          maxResultCount: 1
        });
        if (lookup !== this.lookupCount) return;
        const place = places[0];
        if (!place?.addressComponents?.length) continue;
        const data = fromGoogle(
          place.formattedAddress ?? '',
          place.addressComponents.map((c: any) => ({ name: c.longText, types: c.types }))
        );
        this.query.set(data.display_name);
        this.emit(data, lat, lng);
        return;
      }
    } catch {
      if (lookup !== this.lookupCount) return;
    }
    this.reverseLookup(lat, lng);
  }

  private placePin(lat: number, lng: number, lookup: boolean): void {
    if (this.gmap) {
      const position = { lat, lng };
      if (this.gmarker) {
        this.gmarker.setPosition(position);
      } else {
        this.gmarker = new (google().maps.Marker)({ position, map: this.gmap, draggable: true });
        this.gmarker.addListener('dragend', () => {
          const pos = this.gmarker.getPosition();
          this.googleReverse(pos.lat(), pos.lng());
        });
      }
      if (this.gmap.getZoom() < 17) {
        this.gmap.setCenter(position);
        this.gmap.setZoom(18);
      }
      if (lookup) this.googleReverse(lat, lng);
      return;
    }
    if (!this.map || !this.leaflet) return;
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = this.leaflet.marker([lat, lng], { draggable: true, icon: this.pinIcon() }).addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLatLng();
        this.reverseLookup(pos.lat, pos.lng);
      });
    }
    // Only move the map when zoomed out; re-centring on every tap made the map jump under the finger.
    if (this.map.getZoom() < 17) this.map.setView([lat, lng], 18);
    if (lookup) this.reverseLookup(lat, lng);
  }

  onQueryInput(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchTimer);
    if (value.trim().length < 3) {
      this.results.set([]);
      return;
    }
    // Debounced: the public Nominatim server allows at most 1 request/second.
    this.searchTimer = setTimeout(() => (this.gmap ? this.googleSearch(value.trim()) : this.search(value.trim())), 700);
  }

  // Photon (better at apartments, societies and partial names) and Nominatim run together;
  // Photon's matches come first, and a second result for the same spot is dropped.
  private async search(q: string): Promise<void> {
    this.isSearching.set(true);
    this.message.set('');
    const nominatimUrl = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&accept-language=en&countrycodes=in&limit=8&q=${encodeURIComponent(q)}`;
    // Photon has no country filter; the bounding box (lon/lat) keeps results around India.
    const photonUrl = `${PHOTON}/?lang=en&limit=8&bbox=68,6,98,37&q=${encodeURIComponent(q)}`;
    const [photon, nominatim] = await Promise.all([
      fetch(photonUrl)
        .then(r => r.json() as Promise<{ features: PhotonFeature[] }>)
        .then(d => d.features.filter(f => f.properties['countrycode'] === 'IN').map(fromPhoton))
        .catch(() => null),
      fetch(nominatimUrl, { headers: { 'Accept-Language': 'en' } })
        .then(r => r.json() as Promise<NominatimResult[]>)
        .catch(() => null)
    ]);
    this.isSearching.set(false);
    // Ignore stale responses if the customer kept typing.
    if (q !== this.query().trim()) return;
    if (!photon && !nominatim) {
      this.message.set('Address search is unavailable. Please type your address below.');
      return;
    }
    const seen = new Set<string>();
    const merged = [...(photon ?? []), ...(nominatim ?? [])].filter(r => {
      const key = `${(+r.lat).toFixed(4)},${(+r.lon).toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
    this.results.set(merged);
    if (merged.length === 0) this.message.set('No matches. Try a nearby landmark or area.');
  }

  private scheduleBuildings(): void {
    clearTimeout(this.buildingTimer);
    if (!this.map || this.map.getZoom() < BUILDING_ZOOM) return;
    // Wait for the customer to stop panning before asking Overpass.
    this.buildingTimer = setTimeout(() => this.loadBuildings(), 600);
  }

  // Draws the mapped building outlines around the view as tappable shapes.
  private async loadBuildings(): Promise<void> {
    const map = this.map;
    const Lf = this.leaflet;
    const layer = this.buildingLayer;
    if (!map || !Lf || !layer) return;
    const view = map.getBounds();
    if (this.buildingBounds?.contains(view)) return;
    const box = view.pad(0.3);
    const q = `[out:json][timeout:10];way[building](${box.getSouth()},${box.getWest()},${box.getNorth()},${box.getEast()});out geom 500;`;
    try {
      const res = await fetch(`${OVERPASS}?data=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(10000) });
      const data: { elements: OverpassWay[] } = await res.json();
      if (map !== this.map) return; // The map was closed meanwhile.
      layer.clearLayers();
      this.selectedBuilding = undefined;
      this.buildingBounds = box;
      for (const way of data.elements) {
        if (!way.geometry?.length) continue;
        const label = buildingLabel(way.tags);
        const shape = Lf.polygon(way.geometry.map(g => [g.lat, g.lon] as [number, number]), {
          ...BUILDING_STYLE,
          // Otherwise the map's own click handler would also fire and redo the lookup.
          bubblingMouseEvents: false
        });
        if (label) shape.bindTooltip(label);
        shape.on('click', (e: L.LeafletMouseEvent) => {
          this.highlight(shape);
          this.placePin(e.latlng.lat, e.latlng.lng, false);
          this.reverseLookup(e.latlng.lat, e.latlng.lng, label);
        });
        shape.addTo(layer);
      }
    } catch {
      // Optional extra: tapping the map still works without outlines.
    }
  }

  private highlight(shape: L.Polygon | undefined): void {
    this.selectedBuilding?.setStyle(BUILDING_STYLE);
    this.selectedBuilding = shape;
    shape?.setStyle(SELECTED_BUILDING_STYLE);
  }

  onFlatChange(value: string): void {
    this.flat.set(value);
    if (this.lastPick) this.picked.emit(this.withFlat(this.lastPick));
  }

  // Flat number + map address, shortened to the parent field's limit (the map fills the
  // field directly, so its maxlength doesn't apply). Parts that repeat the City/State
  // fields go first, then the broadest parts from the end; words are never cut unless
  // a single part is itself too long.
  private withFlat(pick: PickedAddress): PickedAddress {
    const max = this.maxLength();
    const flat = this.flat().trim();
    let parts = pick.line.split(',').map(p => p.trim()).filter(Boolean);
    const join = () => [flat, ...parts].filter(Boolean).join(', ');

    if (join().length > max) {
      const ownFields = new Set([pick.city, pick.state].map(s => s.trim().toLowerCase()).filter(Boolean));
      parts = parts.filter(p => !ownFields.has(p.toLowerCase()));
    }
    while (join().length > max && parts.length > 1) {
      parts.pop();
    }
    return { ...pick, line: join().slice(0, max) };
  }

  choose(result: NominatimResult): void {
    this.results.set([]);
    this.query.set(result.display_name);
    // Google suggestions carry only a place id; the address and position come from its details.
    if (result.placeId) {
      this.lookupPlace(result.placeId);
      return;
    }
    const lat = +result.lat;
    const lng = +result.lon;
    this.lookupCount++;
    this.placePin(lat, lng, false);
    this.emit(result, lat, lng);
  }

  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.message.set('Your browser does not support location.');
      return;
    }
    this.isLocating.set(true);
    this.message.set('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.isLocating.set(false);
        this.placePin(pos.coords.latitude, pos.coords.longitude, true);
      },
      () => {
        this.isLocating.set(false);
        this.message.set('Could not get your location. Search or tap the map instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // `knownBuilding` is passed when a building outline was tapped, so Overpass isn't asked again.
  private async reverseLookup(lat: number, lng: number, knownBuilding?: string | null): Promise<void> {
    const lookup = ++this.lookupCount;
    this.message.set('Finding address...');
    try {
      const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&accept-language=en&zoom=18&lat=${lat}&lon=${lng}`;
      // Both lookups run together so the building check doesn't delay the address.
      const [res, building] = await Promise.all([fetch(url), knownBuilding !== undefined ? knownBuilding : this.buildingAt(lat, lng)]);
      const data: NominatimResult = await res.json();
      // The pin moved again while we were waiting; the newer lookup wins.
      if (lookup !== this.lookupCount) return;
      if (!data?.address) {
        this.message.set('No address found here. Move the pin a little.');
        return;
      }
      // OSM's reverse lookup snaps to the nearest road when the tapped building
      // has no address of its own; add the building's name if one is tagged.
      if (building && !data.display_name.toLowerCase().includes(building.toLowerCase())) {
        data.display_name = `${building}, ${data.display_name}`;
      }
      this.query.set(data.display_name);
      this.emit(data, lat, lng);
    } catch {
      if (lookup !== this.lookupCount) return;
      this.message.set('Could not look up this spot. Please type your address below.');
    }
  }

  private async emit(result: NominatimResult, lat: number, lng: number): Promise<void> {
    const pick = ++this.pickCount;
    const a = result.address;
    const line = buildLine(result);

    const state = matchState(a['state'] ?? '');
    const cityCandidates = [
      a['city'], a['town'], a['municipality'], a['city_district'], a['village'],
      a['county'], a['state_district'], a['suburb']
    ].filter((c): c is string => !!c);

    let postalCode = (a['postcode'] ?? '').replace(/\s/g, '');
    if (!VALID_PIN.test(postalCode)) {
      // OSM often has no postcode for a spot; ask India Post by locality name instead.
      const localities = [
        a['suburb'], a['neighbourhood'], a['quarter'], a['village'], a['town'], a['city_district'], a['city']
      ].filter((l): l is string => !!l);
      this.message.set('Finding PIN code...');
      postalCode = (await this.lookupPin(localities, state, cityCandidates)) ?? '';
      // The customer picked another spot while we were waiting.
      if (pick !== this.pickCount) return;
    }

    this.lastPick = {
      line,
      // Prefer a name from our dropdown list; otherwise keep the map's own name ("Other").
      city: matchCity(state, cityCandidates) ?? cityCandidates[0] ?? '',
      state,
      postalCode,
      lat,
      lng
    };
    this.picked.emit(this.withFlat(this.lastPick));
    this.message.set(
      postalCode
        ? 'Address filled in below. Please check it and add your flat/house number above.'
        : 'Address filled in below. Please enter your PIN code and add your flat/house number above.'
    );
  }

  // India Post's public directory: post offices by name -> PIN. Only accepts a
  // post office in the same state, preferring one in the same district/city.
  private async lookupPin(localities: string[], state: string, cityNames: string[]): Promise<string | null> {
    const wantState = normalize(state);
    const wantPlaces = cityNames.map(normalize);
    const tried = new Set<string>();

    for (const locality of localities) {
      const key = normalize(locality);
      if (!key || tried.has(key) || tried.size >= 3) continue;
      tried.add(key);
      try {
        const res = await fetch(`${INDIA_POST}/postoffice/${encodeURIComponent(locality)}`);
        const [data]: IndiaPostResponse[] = await res.json();
        const offices = (data?.PostOffice ?? []).filter(o => !wantState || normalize(o.State) === wantState);
        const best =
          offices.find(o => wantPlaces.includes(normalize(o.District)) && o.DeliveryStatus === 'Delivery') ??
          offices.find(o => wantPlaces.includes(normalize(o.District))) ??
          offices.find(o => o.DeliveryStatus === 'Delivery') ??
          offices[0];
        if (best && VALID_PIN.test(best.Pincode)) return best.Pincode;
      } catch {
        return null; // Service down: the customer just types the PIN.
      }
    }
    return null;
  }

  // Name of the building (or named place) right under the pin, via the Overpass API.
  private async buildingAt(lat: number, lng: number): Promise<string | null> {
    const q = `[out:json][timeout:5];(way(around:25,${lat},${lng})[building][~"^(name|name:en|addr:housename)$"~"."];` +
      `node(around:25,${lat},${lng})[~"^(name|name:en)$"~"."][~"^(building|amenity|shop|office)$"~"."];);out tags 5;`;
    try {
      const res = await fetch(`${OVERPASS}?data=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(4000) });
      const data: { elements: { tags: Record<string, string> }[] } = await res.json();
      return buildingLabel(data.elements[0]?.tags);
    } catch {
      return null; // Optional extra; the road-level address still fills in.
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    clearTimeout(this.buildingTimer);
    this.map?.remove();
  }
}
