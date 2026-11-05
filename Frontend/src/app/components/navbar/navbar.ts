import { Component, HostListener, computed, inject, signal, effect, WritableSignal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { StoreSettingsService } from '../../services/store-settings.service';
import { CheckoutModeService } from '../../services/checkout-mode.service';
import { NotificationBell } from '../notification-bell/notification-bell';
import { MoonTransitBar } from '../moon-transit-bar/moon-transit-bar';
import { SITE_NAME } from '../../services/page-title.service';

import { QuizService } from '../../services/quiz.service';

const ANNOUNCEMENT_DISMISSED_KEY = 'announcementDismissed';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule, NotificationBell, MoonTransitBar],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  readonly siteName = SITE_NAME;
  authService = inject(AuthService);
  cartService = inject(CartService);
  wishlistService = inject(WishlistService);
  quizService = inject(QuizService);
  storeSettings = inject(StoreSettingsService);
  private router = inject(Router);

  openQuiz(): void {
    this.quizService.open();
  }

  // Checkout gets a focused header (logo + "Secure checkout" only) so shoppers
  // aren't tempted away mid-purchase; the logo still links home.
  // Pages with an inline checkout (Mystery Box) turn it on via CheckoutModeService.
  private checkoutMode = inject(CheckoutModeService);
  private isCheckoutRoute = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/checkout'))
    ),
    { initialValue: this.router.url.startsWith('/checkout') }
  );
  isCheckout = computed(() => this.isCheckoutRoute() || this.checkoutMode.active());

  isMenuOpen = signal(false);
  isScrolled = signal(false);
  isSearchOpen = signal(false);
  searchTerm = signal('');
  isShopDropdownOpen = signal(false);
  isAccountDropdownOpen = signal(false);

  userInitials = computed(() => {
    const name = this.authService.currentUser()?.name;
    if (!name) return '';
    return name
      .trim()
      .split(/\s+/)
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });
  announcementDismissed = signal(this.readAnnouncementDismissed());
  isAnnouncementVisible = computed(() => this.storeSettings.announcementEnabled() && !this.announcementDismissed());
  announcementText = computed(() => this.storeSettings.announcementText());
  announcementLink = computed(() => this.storeSettings.announcementLink());
  announcementStyle = computed(() => this.storeSettings.announcementStyle());

  cartBump = signal(false);
  wishlistBump = signal(false);
  private previousCartCount = this.cartService.totalQuantity();
  private previousWishlistCount = this.wishlistService.count();

  constructor() {
    // Bumps the icon badge whenever the underlying count actually changes,
    // not on first render - previousCount already matches the initial value.
    effect(() => {
      const count = this.cartService.totalQuantity();
      if (count !== this.previousCartCount) {
        this.previousCartCount = count;
        this.triggerBump(this.cartBump);
      }
    });

    effect(() => {
      const count = this.wishlistService.count();
      if (count !== this.previousWishlistCount) {
        this.previousWishlistCount = count;
        this.triggerBump(this.wishlistBump);
      }
    });
  }

  private triggerBump(bumpSignal: WritableSignal<boolean>): void {
    bumpSignal.set(true);
    setTimeout(() => bumpSignal.set(false), 350);
  }

  private readAnnouncementDismissed(): boolean {
    try {
      return localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  dismissAnnouncement(): void {
    this.announcementDismissed.set(true);
    try {
      localStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, 'true');
    } catch {
      // localStorage unavailable (private mode, etc.) - dismissal won't persist
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled.set(window.scrollY > 8);
  }

  toggleMenu(): void {
    this.isMenuOpen.set(!this.isMenuOpen());
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
    this.isShopDropdownOpen.set(false);
    this.isAccountDropdownOpen.set(false);
  }

  toggleShopDropdown(event?: Event): void {
    if (event) event.stopPropagation();
    this.isAccountDropdownOpen.set(false);
    this.isShopDropdownOpen.update(v => !v);
  }

  toggleAccountDropdown(event?: Event): void {
    if (event) event.stopPropagation();
    this.isShopDropdownOpen.set(false);
    this.isAccountDropdownOpen.update(v => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isShopDropdownOpen.set(false);
    this.isAccountDropdownOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isShopDropdownOpen.set(false);
    this.isAccountDropdownOpen.set(false);
    this.isSearchOpen.set(false);
    this.isMenuOpen.set(false);
  }

  toggleSearch(): void {
    this.isSearchOpen.update(open => !open);
  }

  submitSearch(): void {
    const term = this.searchTerm().trim();
    if (!term) {
      return;
    }

    this.router.navigate(['/products'], { queryParams: { search: term } });
    this.searchTerm.set('');
    this.isSearchOpen.set(false);
    this.closeMenu();
  }

  onCartClick(): void {
    this.closeMenu();
    if (this.cartService.totalQuantity() === 0) {
      this.router.navigate(['/cart']);
    } else {
      this.cartService.toggleDrawer();
    }
  }

  logout(): void {
    this.isAccountDropdownOpen.set(false);
    this.authService.logout();
    this.wishlistService.clear();
    this.closeMenu();
    this.router.navigate(['/']);
  }
}
