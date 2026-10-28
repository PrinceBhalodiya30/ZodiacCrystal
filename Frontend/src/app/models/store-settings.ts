export interface StoreSettings {
  id: number;
  announcementEnabled: boolean;
  announcementText: string;
  announcementLink?: string | null;
  announcementStyle: string;
  freeShippingThreshold: number;
  flatShippingRate: number;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  moonBannerEnabled: boolean;
  moonBannerMode: 'auto' | 'custom' | string;
  moonBannerCustomText?: string | null;
  moonBannerCustomCrystal?: string | null;
  moonBannerCustomBenefit?: string | null;
  moonBannerCustomLink?: string | null;
  moonBannerShowModal: boolean;
  moonBannerStyle?: string;
  updatedAt: string;
  updatedByEmail?: string | null;
}

export interface UpdateStoreSettingsRequest {
  announcementEnabled: boolean;
  announcementText: string;
  announcementLink?: string | null;
  announcementStyle: string;
  freeShippingThreshold: number;
  flatShippingRate: number;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  moonBannerEnabled: boolean;
  moonBannerMode: 'auto' | 'custom' | string;
  moonBannerCustomText?: string | null;
  moonBannerCustomCrystal?: string | null;
  moonBannerCustomBenefit?: string | null;
  moonBannerCustomLink?: string | null;
  moonBannerShowModal: boolean;
  moonBannerStyle?: string;
}
