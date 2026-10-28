import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs';
import { getMoonPhaseAndTransit, LunarTransitData } from '../../utils/lunar-transit.util';
import { CheckoutModeService } from '../../services/checkout-mode.service';
import { StoreSettingsService } from '../../services/store-settings.service';

const DISMISS_STORAGE_PREFIX = 'crystal_studio_topbar_dismissed_';
const ROTATION_INTERVAL_MS = 5000;

@Component({
  selector: 'app-moon-transit-bar',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './moon-transit-bar.html',
  styleUrl: './moon-transit-bar.css'
})
export class MoonTransitBar implements OnInit {
  private router = inject(Router);
  private checkoutMode = inject(CheckoutModeService);
  private destroyRef = inject(DestroyRef);
  storeSettings = inject(StoreSettingsService);

  readonly transitData = signal<LunarTransitData>(getMoonPhaseAndTransit(new Date()));
  readonly isDismissed = signal<boolean>(this.checkDismissed());
  readonly isDetailsOpen = signal<boolean>(false);
  readonly activeSlideIndex = signal<number>(0); // 0 = Moon Transit, 1 = Store Promo
  readonly isPaused = signal<boolean>(false);
  private rotationTimer: any = null;

  // Suppress on checkout flow to avoid cart distraction
  private isCheckoutRoute = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/checkout'))
    ),
    { initialValue: this.router.url.startsWith('/checkout') }
  );

  readonly isMoonEnabled = computed(() => {
    return typeof this.storeSettings.moonBannerEnabled === 'function'
      ? this.storeSettings.moonBannerEnabled()
      : true;
  });

  readonly isPromoEnabled = computed(() => {
    return typeof this.storeSettings.announcementEnabled === 'function'
      ? this.storeSettings.announcementEnabled()
      : false;
  });

  // Both active check
  readonly hasMultipleSlides = computed(() => this.isMoonEnabled() && this.isPromoEnabled());

  // Store announcement data
  readonly announcementText = computed(() => {
    return typeof this.storeSettings.announcementText === 'function'
      ? this.storeSettings.announcementText()
      : '';
  });

  readonly announcementLink = computed(() => {
    return typeof this.storeSettings.announcementLink === 'function'
      ? this.storeSettings.announcementLink()
      : null;
  });

  readonly announcementStyle = computed(() => {
    return typeof this.storeSettings.announcementStyle === 'function'
      ? this.storeSettings.announcementStyle()
      : 'default';
  });

  // Unified top bar visibility
  readonly isVisible = computed(() => {
    if (this.isDismissed() || this.isCheckoutRoute() || this.checkoutMode.active()) {
      return false;
    }
    return this.isMoonEnabled() || this.isPromoEnabled();
  });

  // Effective slide to show
  readonly currentSlide = computed(() => {
    if (this.hasMultipleSlides()) {
      return this.activeSlideIndex();
    }
    if (this.isMoonEnabled()) {
      return 0;
    }
    return 1;
  });

  // Admin controls whether the modal dialog is enabled
  readonly showModal = computed(() => {
    return typeof this.storeSettings.moonBannerShowModal === 'function'
      ? this.storeSettings.moonBannerShowModal()
      : true;
  });

  // Check if admin has set custom promotional override
  readonly isCustomMode = computed(() => {
    const mode = typeof this.storeSettings.moonBannerMode === 'function' ? this.storeSettings.moonBannerMode() : 'auto';
    const customText = typeof this.storeSettings.moonBannerCustomText === 'function' ? this.storeSettings.moonBannerCustomText() : null;
    const customCrystal = typeof this.storeSettings.moonBannerCustomCrystal === 'function' ? this.storeSettings.moonBannerCustomCrystal() : null;
    return mode === 'custom' && Boolean(customText || customCrystal);
  });

  // Display texts (either custom override or real-time astronomical calculation)
  readonly crystalName = computed(() => {
    const customCrystal = typeof this.storeSettings.moonBannerCustomCrystal === 'function' ? this.storeSettings.moonBannerCustomCrystal() : null;
    if (this.isCustomMode() && customCrystal) {
      return customCrystal;
    }
    return this.transitData().crystal.name;
  });

  readonly crystalBenefit = computed(() => {
    const customBenefit = typeof this.storeSettings.moonBannerCustomBenefit === 'function' ? this.storeSettings.moonBannerCustomBenefit() : null;
    if (this.isCustomMode() && customBenefit) {
      return customBenefit;
    }
    return this.transitData().crystal.benefit;
  });

  readonly customFullText = computed(() => {
    return typeof this.storeSettings.moonBannerCustomText === 'function'
      ? this.storeSettings.moonBannerCustomText()
      : null;
  });

  ngOnInit(): void {
    this.startRotationTimer();
    this.destroyRef.onDestroy(() => {
      this.stopRotationTimer();
    });
  }

  private startRotationTimer(): void {
    if (typeof window === 'undefined') return;
    this.stopRotationTimer();
    this.rotationTimer = setInterval(() => {
      if (!this.isPaused() && this.hasMultipleSlides()) {
        this.activeSlideIndex.update(idx => (idx === 0 ? 1 : 0));
      }
    }, ROTATION_INTERVAL_MS);
  }

  private stopRotationTimer(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }

  pauseRotation(): void {
    this.isPaused.set(true);
  }

  resumeRotation(): void {
    this.isPaused.set(false);
  }

  goToSlide(index: number): void {
    this.activeSlideIndex.set(index);
  }

  private checkDismissed(): boolean {
    try {
      const todayKey = this.transitData().dateKey;
      return localStorage.getItem(`${DISMISS_STORAGE_PREFIX}${todayKey}`) === 'true';
    } catch {
      return false;
    }
  }

  dismiss(): void {
    this.isDismissed.set(true);
    try {
      const todayKey = this.transitData().dateKey;
      localStorage.setItem(`${DISMISS_STORAGE_PREFIX}${todayKey}`, 'true');
    } catch {
      // Ignore localStorage access restrictions in incognito/restricted mode
    }
  }

  openDetails(): void {
    if (this.showModal()) {
      this.isDetailsOpen.set(true);
    }
  }

  closeDetails(): void {
    this.isDetailsOpen.set(false);
  }

  navigateToCrystal(searchTerm?: string | null): void {
    this.closeDetails();
    const customLink = typeof this.storeSettings.moonBannerCustomLink === 'function' ? this.storeSettings.moonBannerCustomLink() : null;
    const query = searchTerm?.trim() ||
      (this.isCustomMode() ? customLink || this.crystalName() : this.transitData().crystal.searchTerm);

    if (query.startsWith('/')) {
      this.router.navigateByUrl(query);
    } else {
      this.router.navigate(['/products'], {
        queryParams: { search: query }
      });
    }
  }

  navigateToZodiac(): void {
    this.closeDetails();
    this.router.navigate(['/zodiac']);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isDetailsOpen()) {
      this.closeDetails();
    }
  }
}
