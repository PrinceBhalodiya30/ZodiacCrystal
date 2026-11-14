import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { StoreSettings, UpdateStoreSettingsRequest } from '../models/store-settings';

export interface MarqueeElementItem {
  icon: string;
  name: string;
  energy: string;
}

export interface MysteryBoxSettings {
  enabled: boolean;
  price: number;
  minimumValue: number;
  itemCount: number;
  title: string;
  subtitle: string;
  badgeText: string;
}

export interface GiftPackagingSettings {
  enabled: boolean;
  fee: number;
  title: string;
  description: string;
}

export interface StoreContactSettings {
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  operatingHours: string;
  instagramUrl: string;
  facebookUrl: string;
  pinterestUrl: string;
  twitterUrl: string;
}

export interface HeroIntentionItem {
  id: string;
  label: string;
  sub: string;
  image: string;
  queryParam: string;
}

export const DEFAULT_GIFT_PACKAGING_SETTINGS: GiftPackagingSettings = {
  enabled: true,
  fee: 99,
  title: 'Luxury Gift Wrap & Handwritten Zodiac Note',
  description: 'Hand-wrapped in sacred velvet gift box with a personalized gold-foil astrological greeting card.'
};

export const DEFAULT_STORE_CONTACT_SETTINGS: StoreContactSettings = {
  supportEmail: 'support@crystalstudio.com',
  supportPhone: '+91 98765 43210',
  whatsappNumber: '+919876543210',
  operatingHours: 'Mon - Sat, 9am - 6pm IST',
  instagramUrl: 'https://instagram.com',
  facebookUrl: 'https://facebook.com',
  pinterestUrl: 'https://pinterest.com',
  twitterUrl: 'https://twitter.com'
};

export const DEFAULT_HERO_INTENTIONS: HeroIntentionItem[] = [
  { id: 'wealth', label: 'Wealth', sub: 'Pyrite & Citrine', image: '/intentions/wealth.webp', queryParam: 'wealth' },
  { id: 'protection', label: 'Protection', sub: 'Smoky Quartz & Obsidian', image: '/intentions/protection.webp', queryParam: 'protection' },
  { id: 'love', label: 'Love', sub: 'Rose Quartz', image: '/intentions/love.jpg', queryParam: 'love' },
  { id: 'clarity', label: 'Clarity', sub: 'Clear Quartz', image: '/intentions/clarity.webp', queryParam: 'intuition' },
  { id: 'calm', label: 'Calm', sub: 'Amethyst & Selenite', image: '/intentions/calm.jpg', queryParam: 'peace' },
  { id: 'all', label: 'All Crystals', sub: 'Explore Collection', image: '/intentions/all-crystals.webp', queryParam: '' }
];

export const DEFAULT_MYSTERY_BOX_SETTINGS: MysteryBoxSettings = {
  enabled: true,
  price: 1499,
  minimumValue: 2500,
  itemCount: 3,
  title: 'Mystery Crystal Box',
  subtitle: 'Every box is personalized with crystals attuned to your zodiac sign, picked from our in-stock authentic collection and worth at least the guaranteed minimum value at catalog prices.',
  badgeText: 'Curator Guaranteed Value'
};

export const DEFAULT_MARQUEE_ITEMS: MarqueeElementItem[] = [
  { icon: '🔥', name: 'Fire Elements', energy: 'Vitality & Willpower' },
  { icon: '🌍', name: 'Earth Elements', energy: 'Grounding & Abundance' },
  { icon: '💨', name: 'Air Elements', energy: 'Clarity & Intellect' },
  { icon: '🌊', name: 'Water Elements', energy: 'Intuition & Emotional Peace' },
  { icon: '✨', name: 'Cosmic Ether', energy: 'Higher Planetary Consciousness' }
];

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
  heroSubtitle: 'Hand-selected crystals, raw clusters, polished towers, and gemstone talismans intuitively paired to resonate with your astrological blueprint and daily intentions.',
  moonBannerEnabled: true,
  moonBannerMode: 'auto',
  moonBannerCustomText: null,
  moonBannerCustomCrystal: null,
  moonBannerCustomBenefit: null,
  moonBannerCustomLink: null,
  moonBannerShowModal: true,
  moonBannerStyle: 'midnight',
  updatedAt: new Date().toISOString()
};

@Injectable({ providedIn: 'root' })
export class StoreSettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/Settings`;

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
  readonly moonBannerStyle = computed(() => this.settings().moonBannerStyle ?? 'midnight');

  // Hero Marquee Ribbon CMS State
  private readonly platformId = inject(PLATFORM_ID);
  private readonly MARQUEE_STORAGE_KEY = 'zc_marquee_elements';

  readonly marqueeItems = signal<MarqueeElementItem[]>(this.loadInitialMarquee());

  private loadInitialMarquee(): MarqueeElementItem[] {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const stored = localStorage.getItem(this.MARQUEE_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // Fallback to defaults
      }
    }
    return DEFAULT_MARQUEE_ITEMS;
  }

  saveMarqueeItems(items: MarqueeElementItem[]): void {
    this.marqueeItems.set([...items]);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.MARQUEE_STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Ignore storage exceptions
      }
    }
  }

  // Mystery Box Curation Settings
  private readonly MYSTERY_STORAGE_KEY = 'zc_mystery_box_settings';
  readonly mysteryBoxSettings = signal<MysteryBoxSettings>(this.loadInitialMysteryBox());

  private loadInitialMysteryBox(): MysteryBoxSettings {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const stored = localStorage.getItem(this.MYSTERY_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (typeof parsed?.price === 'number') {
            return { ...DEFAULT_MYSTERY_BOX_SETTINGS, ...parsed };
          }
        }
      } catch {
        // Fallback to default configuration
      }
    }
    return DEFAULT_MYSTERY_BOX_SETTINGS;
  }

  saveMysteryBoxSettings(settings: MysteryBoxSettings): void {
    this.mysteryBoxSettings.set({ ...settings });
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.MYSTERY_STORAGE_KEY, JSON.stringify(settings));
      } catch {
        // Ignore storage exceptions
      }
    }
  }

  // Luxury Gift Packaging Settings
  private readonly GIFT_STORAGE_KEY = 'zc_gift_packaging_settings';
  readonly giftPackagingSettings = signal<GiftPackagingSettings>(this.loadInitialGiftPackaging());

  private loadInitialGiftPackaging(): GiftPackagingSettings {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const stored = localStorage.getItem(this.GIFT_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (typeof parsed?.fee === 'number') {
            return { ...DEFAULT_GIFT_PACKAGING_SETTINGS, ...parsed };
          }
        }
      } catch {
        // Fallback to defaults
      }
    }
    return DEFAULT_GIFT_PACKAGING_SETTINGS;
  }

  saveGiftPackagingSettings(settings: GiftPackagingSettings): void {
    this.giftPackagingSettings.set({ ...settings });
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.GIFT_STORAGE_KEY, JSON.stringify(settings));
      } catch {
        // Ignore storage exceptions
      }
    }
  }

  // Store Contact & Support Channels Settings
  private readonly CONTACT_STORAGE_KEY = 'zc_store_contact_settings';
  readonly storeContactSettings = signal<StoreContactSettings>(this.loadInitialStoreContact());

  private loadInitialStoreContact(): StoreContactSettings {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const stored = localStorage.getItem(this.CONTACT_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.supportEmail) {
            return { ...DEFAULT_STORE_CONTACT_SETTINGS, ...parsed };
          }
        }
      } catch {
        // Fallback to defaults
      }
    }
    return DEFAULT_STORE_CONTACT_SETTINGS;
  }

  saveStoreContactSettings(settings: StoreContactSettings): void {
    this.storeContactSettings.set({ ...settings });
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.CONTACT_STORAGE_KEY, JSON.stringify(settings));
      } catch {
        // Ignore storage exceptions
      }
    }
  }

  // Hero Curated Intentions Settings
  private readonly INTENTIONS_STORAGE_KEY = 'zc_hero_intentions';
  readonly heroIntentions = signal<HeroIntentionItem[]>(this.loadInitialHeroIntentions());

  private loadInitialHeroIntentions(): HeroIntentionItem[] {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const stored = localStorage.getItem(this.INTENTIONS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // Fallback to defaults
      }
    }
    return DEFAULT_HERO_INTENTIONS;
  }

  saveHeroIntentions(items: HeroIntentionItem[]): void {
    this.heroIntentions.set([...items]);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.INTENTIONS_STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Ignore storage exceptions
      }
    }
  }

  // Category Visual Banners / Custom Image Overrides
  private readonly CATEGORY_IMAGES_STORAGE_KEY = 'zc_category_images';
  readonly categoryImages = signal<Record<number, string>>(this.loadInitialCategoryImages());

  private loadInitialCategoryImages(): Record<number, string> {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const stored = localStorage.getItem(this.CATEGORY_IMAGES_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        }
      } catch {
        // Ignore storage exceptions
      }
    }
    return {};
  }

  getCategoryImage(categoryId: number): string | null {
    return this.categoryImages()[categoryId] ?? null;
  }

  saveCategoryImage(categoryId: number, imageUrl: string | null): void {
    const updated = { ...this.categoryImages() };
    if (imageUrl?.trim()) {
      updated[categoryId] = imageUrl.trim();
    } else {
      delete updated[categoryId];
    }
    this.categoryImages.set(updated);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.CATEGORY_IMAGES_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage exceptions
      }
    }
  }

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
