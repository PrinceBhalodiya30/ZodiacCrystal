import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MoonTransitBar } from './moon-transit-bar';
import { CheckoutModeService } from '../../services/checkout-mode.service';
import { StoreSettingsService } from '../../services/store-settings.service';

describe('MoonTransitBar', () => {
  let component: MoonTransitBar;
  let fixture: ComponentFixture<MoonTransitBar>;
  let router: Router;
  let mockStoreSettings: {
    moonBannerEnabled: ReturnType<typeof signal<boolean>>;
    moonBannerMode: ReturnType<typeof signal<string>>;
    moonBannerCustomText: ReturnType<typeof signal<string | null>>;
    moonBannerCustomCrystal: ReturnType<typeof signal<string | null>>;
    moonBannerCustomBenefit: ReturnType<typeof signal<string | null>>;
    moonBannerCustomLink: ReturnType<typeof signal<string | null>>;
    moonBannerShowModal: ReturnType<typeof signal<boolean>>;
    announcementEnabled: ReturnType<typeof signal<boolean>>;
    announcementText: ReturnType<typeof signal<string>>;
    announcementLink: ReturnType<typeof signal<string | null>>;
    announcementStyle: ReturnType<typeof signal<string>>;
  };

  beforeEach(async () => {
    localStorage.clear();

    mockStoreSettings = {
      moonBannerEnabled: signal(true),
      moonBannerMode: signal('auto'),
      moonBannerCustomText: signal<string | null>(null),
      moonBannerCustomCrystal: signal<string | null>(null),
      moonBannerCustomBenefit: signal<string | null>(null),
      moonBannerCustomLink: signal<string | null>(null),
      moonBannerShowModal: signal(true),
      announcementEnabled: signal(false),
      announcementText: signal('Free Shipping on orders over ₹999!'),
      announcementLink: signal<string | null>('/products'),
      announcementStyle: signal('emerald')
    };

    await TestBed.configureTestingModule({
      imports: [MoonTransitBar],
      providers: [
        CheckoutModeService,
        provideRouter([]),
        { provide: StoreSettingsService, useValue: mockStoreSettings }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(MoonTransitBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('creates component and loads today transit data', () => {
    expect(component).toBeTruthy();
    expect(component.transitData()).toBeTruthy();
    expect(component.transitData().phaseName).toBeTruthy();
    expect(component.transitData().crystal.name).toBeTruthy();
  });

  it('renders the banner element when not dismissed and enabled by admin', () => {
    const bannerEl = fixture.nativeElement.querySelector('.moon-transit-bar');
    expect(bannerEl).toBeTruthy();
    expect(bannerEl.textContent).toContain(component.transitData().crystal.name);
  });

  it('hides the banner completely when admin disables moonBannerEnabled and announcement is disabled', () => {
    mockStoreSettings.moonBannerEnabled.set(false);
    mockStoreSettings.announcementEnabled.set(false);
    fixture.detectChanges();

    expect(component.isVisible()).toBe(false);
    const bannerEl = fixture.nativeElement.querySelector('.moon-transit-bar');
    expect(bannerEl).toBeFalsy();
  });

  it('supports admin custom mode and overrides featured crystal', () => {
    mockStoreSettings.moonBannerMode.set('custom');
    mockStoreSettings.moonBannerCustomCrystal.set('Amethyst Cluster');
    mockStoreSettings.moonBannerCustomBenefit.set('Crown Chakra & Peace');
    fixture.detectChanges();

    expect(component.isCustomMode()).toBe(true);
    expect(component.crystalName()).toBe('Amethyst Cluster');
    expect(component.crystalBenefit()).toBe('Crown Chakra & Peace');
  });

  it('dismisses banner and stores flag in localStorage with daily key', () => {
    const todayKey = component.transitData().dateKey;
    component.dismiss();
    fixture.detectChanges();

    expect(component.isDismissed()).toBe(true);
    expect(component.isVisible()).toBe(false);
    expect(localStorage.getItem(`crystal_studio_topbar_dismissed_${todayKey}`)).toBe('true');
  });

  it('opens and closes details modal when showModal is enabled', () => {
    expect(component.isDetailsOpen()).toBe(false);

    component.openDetails();
    fixture.detectChanges();
    expect(component.isDetailsOpen()).toBe(true);

    const modalEl = fixture.nativeElement.querySelector('.cosmic-modal-overlay');
    expect(modalEl).toBeTruthy();

    component.closeDetails();
    fixture.detectChanges();
    expect(component.isDetailsOpen()).toBe(false);
  });

  it('does not open details modal if admin disabled moonBannerShowModal', () => {
    mockStoreSettings.moonBannerShowModal.set(false);
    fixture.detectChanges();

    component.openDetails();
    fixture.detectChanges();
    expect(component.isDetailsOpen()).toBe(false);
  });

  it('closes modal on Escape key press', () => {
    component.openDetails();
    fixture.detectChanges();
    expect(component.isDetailsOpen()).toBe(true);

    component.onEscape();
    expect(component.isDetailsOpen()).toBe(false);
  });

  it('navigates to products search when crystal button is clicked', () => {
    const searchTerm = component.transitData().crystal.searchTerm;

    component.navigateToCrystal(searchTerm);

    expect(router.navigate).toHaveBeenCalledWith(['/products'], {
      queryParams: { search: searchTerm }
    });
  });

  it('navigates to zodiac page from modal action', () => {
    component.navigateToZodiac();
    expect(router.navigate).toHaveBeenCalledWith(['/zodiac']);
  });

  it('rotates between moon and promo slides when both are enabled', () => {
    mockStoreSettings.moonBannerEnabled.set(true);
    mockStoreSettings.announcementEnabled.set(true);
    fixture.detectChanges();

    expect(component.hasMultipleSlides()).toBe(true);
    expect(component.currentSlide()).toBe(0);

    // Switch to promo slide
    component.goToSlide(1);
    fixture.detectChanges();

    expect(component.currentSlide()).toBe(1);
    const promoSlide = fixture.nativeElement.querySelector('.ticker-slide--promo');
    expect(promoSlide).toBeTruthy();
    expect(promoSlide.textContent).toContain('Free Shipping on orders over ₹999!');

    // Switch back to moon slide
    component.goToSlide(0);
    fixture.detectChanges();

    expect(component.currentSlide()).toBe(0);
    const moonSlide = fixture.nativeElement.querySelector('.ticker-slide--moon');
    expect(moonSlide).toBeTruthy();
  });

  it('renders promo slide only when moon banner is disabled but announcement is enabled', () => {
    mockStoreSettings.moonBannerEnabled.set(false);
    mockStoreSettings.announcementEnabled.set(true);
    fixture.detectChanges();

    expect(component.isVisible()).toBe(true);
    expect(component.hasMultipleSlides()).toBe(false);
    expect(component.currentSlide()).toBe(1);

    const promoSlide = fixture.nativeElement.querySelector('.ticker-slide--promo');
    expect(promoSlide).toBeTruthy();
    expect(promoSlide.textContent).toContain('Free Shipping on orders over ₹999!');
  });
});
