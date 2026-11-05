import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs';
import { getMoonPhaseAndTransit, LunarTransitData } from '../../utils/lunar-transit.util';
import { CheckoutModeService } from '../../services/checkout-mode.service';
import { StoreSettingsService } from '../../services/store-settings.service';

const DISMISS_STORAGE_PREFIX = 'crystal_studio_topbar_dismissed_';

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
  readonly isPaused = signal<boolean>(false);

  // Approach 4: Page-Contextual Banner (Smart Commerce)
  // Initializes based on current route and adapts when navigating across the store.
  readonly activeSlideIndex = signal<number>(this.calculateContextualSlide(this.router.url));

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

  readonly effectiveAnnouncementLink = computed(() => {
    const raw = this.announcementLink();
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  });

  readonly isAnnouncementLinkExternal = computed(() => {
    const link = this.effectiveAnnouncementLink();
    return Boolean(link && (link.startsWith('http://') || link.startsWith('https://')));
  });

  readonly announcementStyle = computed(() => {
    return typeof this.storeSettings.announcementStyle === 'function'
      ? this.storeSettings.announcementStyle()
      : 'default';
  });

  readonly moonBannerStyle = computed(() => {
    return typeof this.storeSettings.moonBannerStyle === 'function'
      ? this.storeSettings.moonBannerStyle()
      : 'midnight';
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
    // Approach 4: Smart Page-Contextual Adaptation
    // When both banners are active, automatically select the most relevant message:
    // - Commerce routes (products, cart, wishlist, orders) -> Store Promo (Slide 1)
    // - Discovery routes (home, zodiac, guides, consultation) -> Moon Transit (Slide 0)
    // Zero auto-flipping timer. The customer enjoys a serene, static banner on every page.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((e) => {
        const url = e.urlAfterRedirects || e.url || '';
        this.activeSlideIndex.set(this.calculateContextualSlide(url));
      });
  }

  /**
   * Determine the most relevant banner message based on the current page context
   */
  calculateContextualSlide(url: string | null | undefined): number {
    const route = url || '';
    if (
      route.startsWith('/products') ||
      route.startsWith('/cart') ||
      route.startsWith('/categories') ||
      route.startsWith('/orders') ||
      route.startsWith('/wishlist') ||
      route.startsWith('/mystery-box') ||
      route.startsWith('/profile')
    ) {
      return 1; // Commerce promotion & shipping
    }
    return 0; // Celestial moon phase & daily astrological alignment
  }

  pauseRotation(): void {
    this.isPaused.set(true);
  }

  resumeRotation(): void {
    this.isPaused.set(false);
  }

  togglePause(): void {
    this.isPaused.update(val => !val);
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
