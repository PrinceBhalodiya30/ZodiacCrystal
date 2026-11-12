import { AfterViewInit, Component, ElementRef, OnDestroy, ViewEncapsulation, input, viewChild } from '@angular/core';
import type * as L from 'leaflet';
import { getGoogleMapsKey } from '../../services/maps-config';
import { isGoogleFailed, loadGoogle, markGoogleFailed } from '../../utils/google-maps-loader';

// Read-only map with a single pin - for showing where an order ships to
// without leaving the page. The editable picker is AddressMap. Like it, this
// uses Google Maps when a key is configured and falls back to OpenStreetMap.
@Component({
  selector: 'app-location-map',
  standalone: true,
  template: '<div #mapEl class="location-map"></div>',
  // Same as AddressMap: Leaflet's CSS ships with the component, unencapsulated
  // because Leaflet builds its DOM outside Angular's templates.
  styleUrls: ['../../../../node_modules/leaflet/dist/leaflet.css', './location-map.css'],
  encapsulation: ViewEncapsulation.None
})
export class LocationMap implements AfterViewInit, OnDestroy {
  readonly latitude = input.required<number>();
  readonly longitude = input.required<number>();
  readonly zoom = input(17);

  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');
  private map?: L.Map;
  // Google Maps objects (untyped: the Google script is loaded at runtime, without @types).
  private gmap?: any;
  private marker?: any;
  private destroyed = false;

  ngAfterViewInit(): void {
    void this.setupMap().catch(() => {
      // Ignore map setup errors
    });
  }

  private async setupMap(): Promise<void> {
    const key = isGoogleFailed() ? '' : await getGoogleMapsKey();
    if (this.destroyed) return;
    if (key) {
      try {
        await this.initGoogle(key);
        return;
      } catch {
        // Falls through to OpenStreetMap.
      }
    }
    await this.initLeaflet();
  }

  private async initGoogle(key: string): Promise<void> {
    const g = await loadGoogle(key, () => this.useOpenStreetMap());
    const { Map: GoogleMap } = await g.maps.importLibrary('maps');
    if (this.destroyed) return;
    const position = { lat: this.latitude(), lng: this.longitude() };
    this.gmap = new GoogleMap(this.mapEl().nativeElement, {
      center: position,
      zoom: this.zoom(),
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'cooperative'
    });
    this.marker = new g.maps.Marker({ position, map: this.gmap });
  }

  // Google rejected the key (e.g. the demo key's daily limit): rebuild with OpenStreetMap.
  private useOpenStreetMap(): void {
    markGoogleFailed();
    this.gmap = undefined;
    this.marker = undefined;
    const el = this.mapEl().nativeElement;
    el.replaceChildren();
    el.removeAttribute('style');
    if (!this.map) {
      void this.initLeaflet().catch(() => {
        // Ignore fallback error
      });
    }
  }

  private async initLeaflet(): Promise<void> {
    const leafletModule: any = await import('leaflet');
    if (this.destroyed || this.map) return;
    const Lf = (leafletModule.default ?? leafletModule) as typeof L;
    const point: L.LatLngExpression = [this.latitude(), this.longitude()];

    this.map = Lf.map(this.mapEl().nativeElement, { maxZoom: 19 }).setView(point, this.zoom());
    Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);
    Lf.marker(point, {
      icon: Lf.divIcon({ className: 'location-map-pin', iconSize: [24, 24], iconAnchor: [12, 29] }),
      keyboard: false
    }).addTo(this.map);

    // The drawer animates in, so re-measure once it has settled.
    setTimeout(() => this.map?.invalidateSize(), 250);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.marker?.setMap?.(null);
    this.map?.remove();
  }
}
