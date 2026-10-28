import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminNav } from '../admin-nav/admin-nav';
import { StoreSettingsService } from '../../services/store-settings.service';
import { ToastService } from '../../services/toast.service';
import { UpdateStoreSettingsRequest } from '../../models/store-settings';

export interface AnnouncementTemplate {
  name: string;
  style: string;
  text: string;
  link: string;
}

export interface MoonEventPreset {
  name: string;
  text: string;
  crystal: string;
  benefit: string;
  link: string;
}

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminNav],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class AdminSettings implements OnInit {
  private storeSettingsService = inject(StoreSettingsService);
  private toastService = inject(ToastService);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly activeTab = signal<'announcement' | 'moon' | 'shipping' | 'hero'>('announcement');

  // Announcement Form State Signals
  readonly announcementEnabled = signal(true);
  readonly announcementText = signal('');
  readonly announcementLink = signal('');
  readonly announcementStyle = signal('emerald');

  // Daily Moon Phase & Transit Banner State Signals
  readonly moonBannerEnabled = signal(true);
  readonly moonBannerMode = signal<'auto' | 'custom'>('auto');
  readonly moonBannerCustomText = signal('');
  readonly moonBannerCustomCrystal = signal('');
  readonly moonBannerCustomBenefit = signal('');
  readonly moonBannerCustomLink = signal('');
  readonly moonBannerShowModal = signal(true);
  readonly moonBannerStyle = signal('midnight');

  // Live Storefront Top Bar Preview Rotation Signals
  readonly previewSlide = signal<0 | 1>(1);
  readonly hasMultiplePreviewSlides = computed(() => this.moonBannerEnabled() && this.announcementEnabled());
  readonly isTopBarPreviewVisible = computed(() => this.moonBannerEnabled() || this.announcementEnabled());
  readonly currentPreviewSlide = computed<0 | 1>(() => {
    if (this.hasMultiplePreviewSlides()) {
      return this.previewSlide();
    }
    if (this.moonBannerEnabled()) return 0;
    return 1;
  });

  setPreviewSlide(index: 0 | 1): void {
    this.previewSlide.set(index);
  }

  selectTab(tab: 'announcement' | 'moon' | 'shipping' | 'hero'): void {
    this.activeTab.set(tab);
    if (tab === 'announcement') {
      this.previewSlide.set(1);
    } else if (tab === 'moon') {
      this.previewSlide.set(0);
    }
  }

  setAnnouncementStyle(style: string): void {
    this.announcementStyle.set(style);
    this.previewSlide.set(1);
  }

  setMoonBannerStyle(style: string): void {
    this.moonBannerStyle.set(style);
    this.previewSlide.set(0);
  }

  // Shipping & Rates Form State Signals
  readonly freeShippingThreshold = signal(999);
  readonly flatShippingRate = signal(50);

  // Hero Copy Form State Signals
  readonly heroEyebrow = signal('');
  readonly heroTitle = signal('');
  readonly heroSubtitle = signal('');

  readonly lastUpdated = signal<string>('');
  readonly lastUpdatedBy = signal<string | null>(null);

  // Quick Preset Templates for Announcement Bar
  readonly templates: AnnouncementTemplate[] = [
    {
      name: 'Default Value Props',
      style: 'emerald',
      text: 'Free shipping on orders over ₹999 · Cash on Delivery available · 7-day returns',
      link: '/products'
    },
    {
      name: 'Festive Cosmic Sale',
      style: 'gold',
      text: 'Diwali Cosmic Sale: Extra 15% off with code CELESTIAL15 · Free sacred pouch on ₹1,499+',
      link: '/products'
    },
    {
      name: 'Full Moon Rituals',
      style: 'amethyst',
      text: 'Full Moon Energy: 20% off all Raw Clusters & Selenite Plates with code FULLMOON',
      link: '/categories'
    },
    {
      name: 'Flash Weekend Special',
      style: 'ruby',
      text: 'Weekend Flash Special: Flat ₹200 off orders above ₹1,499 · Use code FLASH200',
      link: '/mystery-box'
    },
    {
      name: 'Midnight Celestial Drop',
      style: 'sapphire',
      text: 'Midnight Drop: Rare Moldavite & Ethiopian Opal specimens now live in limited quantities',
      link: '/products'
    }
  ];

  // Quick Presets for Custom Moon Events
  readonly moonPresets: MoonEventPreset[] = [
    {
      name: 'Waxing Moon in Taurus (Heart & Peace)',
      text: '🌙 Waxing Moon in Taurus · Best Crystal Today: Rose Quartz for Inner Peace',
      crystal: 'Rose Quartz',
      benefit: 'Inner Peace & Emotional Harmony',
      link: '/products?search=Rose+Quartz'
    },
    {
      name: 'Full Moon Supermoon Cleansing',
      text: '🌕 Supermoon in Pisces · Best Crystal Today: Selenite & Moonstone for Aura Cleansing',
      crystal: 'Selenite',
      benefit: 'Aura Cleansing & Lunar Illumination',
      link: '/products?search=Selenite'
    },
    {
      name: 'Scorpio New Moon Transformation',
      text: '🌑 New Moon in Scorpio · Best Crystal Today: Black Obsidian for Psychic Shielding',
      crystal: 'Black Obsidian',
      benefit: 'Grounding & Energetic Shielding',
      link: '/products?search=Obsidian'
    },
    {
      name: 'Solar Eclipse Solar Vitality',
      text: '☀️ Solar Alignment · Best Crystal Today: Pyrite & Sunstone for Abundance & Courage',
      crystal: 'Pyrite',
      benefit: 'Confidence & Golden Abundance',
      link: '/products?search=Pyrite'
    }
  ];

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.isLoading.set(true);
    this.storeSettingsService.getAdminSettings().subscribe({
      next: (s) => {
        this.announcementEnabled.set(s.announcementEnabled);
        this.announcementText.set(s.announcementText);
        this.announcementLink.set(s.announcementLink ?? '');
        this.announcementStyle.set(s.announcementStyle || 'emerald');

        this.moonBannerEnabled.set(s.moonBannerEnabled ?? true);
        this.moonBannerMode.set((s.moonBannerMode as 'auto' | 'custom') || 'auto');
        this.moonBannerCustomText.set(s.moonBannerCustomText ?? '');
        this.moonBannerCustomCrystal.set(s.moonBannerCustomCrystal ?? '');
        this.moonBannerCustomBenefit.set(s.moonBannerCustomBenefit ?? '');
        this.moonBannerCustomLink.set(s.moonBannerCustomLink ?? '');
        this.moonBannerShowModal.set(s.moonBannerShowModal ?? true);
        this.moonBannerStyle.set(s.moonBannerStyle || 'midnight');

        this.freeShippingThreshold.set(s.freeShippingThreshold);
        this.flatShippingRate.set(s.flatShippingRate);

        this.heroEyebrow.set(s.heroEyebrow);
        this.heroTitle.set(s.heroTitle);
        this.heroSubtitle.set(s.heroSubtitle);

        this.lastUpdated.set(this.formatUtcIso(s.updatedAt));
        this.lastUpdatedBy.set(s.updatedByEmail ?? null);
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load store settings');
        this.isLoading.set(false);
      }
    });
  }

  applyTemplate(template: AnnouncementTemplate): void {
    this.announcementText.set(template.text);
    this.announcementStyle.set(template.style);
    this.announcementLink.set(template.link);
    this.announcementEnabled.set(true);
    this.previewSlide.set(1);
    this.toastService.info(`Applied "${template.name}" template. Click "Save Changes" to publish.`);
  }

  applyMoonPreset(preset: MoonEventPreset): void {
    this.moonBannerMode.set('custom');
    this.moonBannerCustomText.set(preset.text);
    this.moonBannerCustomCrystal.set(preset.crystal);
    this.moonBannerCustomBenefit.set(preset.benefit);
    this.moonBannerCustomLink.set(preset.link);
    this.moonBannerEnabled.set(true);
    this.previewSlide.set(0);
    this.toastService.info(`Applied "${preset.name}". Click "Save Changes" to publish.`);
  }

  saveSettings(): void {
    if (!this.announcementText().trim()) {
      this.toastService.error('Announcement banner text cannot be empty');
      return;
    }

    if (this.freeShippingThreshold() < 0) {
      this.toastService.error('Free shipping threshold cannot be negative');
      return;
    }

    if (this.flatShippingRate() < 0) {
      this.toastService.error('Flat shipping rate cannot be negative');
      return;
    }

    this.isSaving.set(true);
    const req: UpdateStoreSettingsRequest = {
      announcementEnabled: this.announcementEnabled(),
      announcementText: this.announcementText().trim(),
      announcementLink: this.announcementLink().trim() || null,
      announcementStyle: this.announcementStyle(),
      moonBannerEnabled: this.moonBannerEnabled(),
      moonBannerMode: this.moonBannerMode(),
      moonBannerCustomText: this.moonBannerCustomText().trim() || null,
      moonBannerCustomCrystal: this.moonBannerCustomCrystal().trim() || null,
      moonBannerCustomBenefit: this.moonBannerCustomBenefit().trim() || null,
      moonBannerCustomLink: this.moonBannerCustomLink().trim() || null,
      moonBannerShowModal: this.moonBannerShowModal(),
      moonBannerStyle: this.moonBannerStyle(),
      freeShippingThreshold: Number(this.freeShippingThreshold()),
      flatShippingRate: Number(this.flatShippingRate()),
      heroEyebrow: this.heroEyebrow().trim(),
      heroTitle: this.heroTitle().trim(),
      heroSubtitle: this.heroSubtitle().trim()
    };

    this.storeSettingsService.updateSettings(req).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.lastUpdated.set(this.formatUtcIso(updated.updatedAt));
        this.lastUpdatedBy.set(updated.updatedByEmail ?? null);
        this.toastService.success('Store settings & CMS copy saved successfully!');
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = err.error?.message || 'Failed to save settings. Please try again.';
        this.toastService.error(msg);
      }
    });
  }

  private formatUtcIso(rawDate: string | null | undefined): string {
    if (!rawDate) return '';
    const trimmed = rawDate.trim();
    // If the date string does not have a timezone indicator (Z or offset),
    // append 'Z' so JavaScript and Angular DatePipe correctly treat it as UTC
    // and convert it to the browser's local timezone (e.g. IST).
    if (!trimmed.endsWith('Z') && !trimmed.includes('+') && !/-\d{2}:\d{2}$/.test(trimmed)) {
      return `${trimmed}Z`;
    }
    return trimmed;
  }
}
