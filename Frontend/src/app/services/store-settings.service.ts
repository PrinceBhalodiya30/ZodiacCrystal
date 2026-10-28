import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { StoreSettings, UpdateStoreSettingsRequest } from '../models/store-settings';

const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  announcementEnabled: true,
  announcementText: 'Free shipping on orders over ₹999 · Cash on Delivery available · 7-day returns',
  announcementLink: null,
  announcementStyle: 'emerald',
  freeShippingThreshold: 999,
  flatShippingRate: 50,
  heroEyebrow: 'Natural Minerals & Astrological Alignments',
  heroTitle: 'Discover Crystals Aligned with Your Zodiac',
  heroSubtitle: 'Hand-selected crystals, raw clusters, polished towers, and gemstone jewelry intuitively paired to resonate with your astrological blueprint and daily intentions.',
  moonBannerEnabled: true,
  moonBannerMode: 'auto',
  moonBannerCustomText: null,
  moonBannerCustomCrystal: null,
  moonBannerCustomBenefit: null,
  moonBannerCustomLink: null,
  moonBannerShowModal: true,
  updatedAt: new Date().toISOString()
};

@Injectable({ providedIn: 'root' })
export class StoreSettingsService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/Settings`;

  readonly settings = signal<StoreSettings>(DEFAULT_SETTINGS);
  readonly isLoading = signal<boolean>(false);
  readonly isLoaded = signal<boolean>(false);

  readonly announcementEnabled = computed(() => this.settings().announcementEnabled);
  readonly announcementText = computed(() => this.settings().announcementText);
  readonly announcementLink = computed(() => this.settings().announcementLink);
  readonly announcementStyle = computed(() => this.settings().announcementStyle);
  readonly freeShippingThreshold = computed(() => this.settings().freeShippingThreshold);
  readonly flatShippingRate = computed(() => this.settings().flatShippingRate);
  readonly heroEyebrow = computed(() => this.settings().heroEyebrow);
  readonly heroTitle = computed(() => this.settings().heroTitle);
  readonly heroSubtitle = computed(() => this.settings().heroSubtitle);

  // Daily Moon Phase & Transit Energy Banner Settings
  readonly moonBannerEnabled = computed(() => this.settings().moonBannerEnabled ?? true);
  readonly moonBannerMode = computed(() => this.settings().moonBannerMode ?? 'auto');
  readonly moonBannerCustomText = computed(() => this.settings().moonBannerCustomText ?? null);
  readonly moonBannerCustomCrystal = computed(() => this.settings().moonBannerCustomCrystal ?? null);
  readonly moonBannerCustomBenefit = computed(() => this.settings().moonBannerCustomBenefit ?? null);
  readonly moonBannerCustomLink = computed(() => this.settings().moonBannerCustomLink ?? null);
  readonly moonBannerShowModal = computed(() => this.settings().moonBannerShowModal ?? true);

  constructor() {
    this.loadPublicSettings();
  }

  loadPublicSettings(): void {
    this.isLoading.set(true);
    this.http.get<StoreSettings>(`${this.baseUrl}/public`).subscribe({
      next: (data) => {
        if (data) {
          this.settings.set(data);
          this.isLoaded.set(true);
        }
        this.isLoading.set(false);
      },
      error: () => {
        // Fallback gracefully to default settings on error
        this.isLoading.set(false);
        this.isLoaded.set(true);
      }
    });
  }

  getAdminSettings(): Observable<StoreSettings> {
    return this.http.get<StoreSettings>(`${this.baseUrl}/admin`).pipe(
      tap((data) => this.settings.set(data))
    );
  }

  updateSettings(req: UpdateStoreSettingsRequest): Observable<StoreSettings> {
    return this.http.put<StoreSettings>(`${this.baseUrl}/admin`, req).pipe(
      tap((updated) => this.settings.set(updated))
    );
  }
}
