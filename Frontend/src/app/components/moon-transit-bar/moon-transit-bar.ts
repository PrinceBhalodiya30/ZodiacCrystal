import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs';
import { getMoonPhaseAndTransit, LunarTransitData } from '../../utils/lunar-transit.util';
import { CheckoutModeService } from '../../services/checkout-mode.service';
import { StoreSettingsService } from '../../services/store-settings.service';

const DISMISS_STORAGE_PREFIX = 'crystal_studio_moon_dismissed_';

@Component({
  selector: 'app-moon-transit-bar',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './moon-transit-bar.html',
  styleUrl: './moon-transit-bar.css'
})
export class MoonTransitBar {
  private router = inject(Router);
  private checkoutMode = inject(CheckoutModeService);
  storeSettings = inject(StoreSettingsService);

  readonly transitData = signal<LunarTransitData>(getMoonPhaseAndTransit(new Date()));
  readonly isDismissed = signal<boolean>(this.checkDismissed());
  readonly isDetailsOpen = signal<boolean>(false);

  // Suppress on checkout flow to avoid cart distraction
  private isCheckoutRoute = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/checkout'))
    ),
    { initialValue: this.router.url.startsWith('/checkout') }
  );

  // Admin controls visibility
  readonly isVisible = computed(() => {
    return (
      this.storeSettings.moonBannerEnabled() &&
      !this.isDismissed() &&
      !this.isCheckoutRoute() &&
      !this.checkoutMode.active()
    );
  });

  // Admin controls whether the modal dialog is enabled
  readonly showModal = computed(() => this.storeSettings.moonBannerShowModal());

  // Check if admin has set custom promotional override
  readonly isCustomMode = computed(() => {
    return (
      this.storeSettings.moonBannerMode() === 'custom' &&
      Boolean(this.storeSettings.moonBannerCustomText() || this.storeSettings.moonBannerCustomCrystal())
    );
  });

  // Display texts (either custom override or real-time astronomical calculation)
  readonly crystalName = computed(() => {
    if (this.isCustomMode() && this.storeSettings.moonBannerCustomCrystal()) {
      return this.storeSettings.moonBannerCustomCrystal()!;
    }
    return this.transitData().crystal.name;
  });

  readonly crystalBenefit = computed(() => {
    if (this.isCustomMode() && this.storeSettings.moonBannerCustomBenefit()) {
      return this.storeSettings.moonBannerCustomBenefit()!;
    }
    return this.transitData().crystal.benefit;
  });

  readonly customFullText = computed(() => {
    return this.storeSettings.moonBannerCustomText();
  });

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
    const query = searchTerm?.trim() ||
      (this.isCustomMode() ? this.storeSettings.moonBannerCustomLink() || this.crystalName() : this.transitData().crystal.searchTerm);

    // If custom link starts with '/', navigate directly, else search
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
