import { Component, HostListener, computed, inject, signal, effect, WritableSignal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { CheckoutModeService } from '../../services/checkout-mode.service';
import { NotificationBell } from '../notification-bell/notification-bell';
import { SITE_NAME } from '../../services/page-title.service';

const ANNOUNCEMENT_DISMISSED_KEY = 'announcementDismissed';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule, NotificationBell],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  readonly siteName = SITE_NAME;
  authService = inject(AuthService);
  cartService = inject(CartService);
  wishlistService = inject(WishlistService);
  private router = inject(Router);

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
  isAnnouncementVisible = signal(this.readAnnouncementVisible());

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

  private readAnnouncementVisible(): boolean {
    try {
      return localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY) !== 'true';
    } catch {
      return true;
    }
  }

  dismissAnnouncement(): void {
    this.isAnnouncementVisible.set(false);
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

  logout(): void {
    this.authService.logout();
    this.wishlistService.clear();
    this.closeMenu();
    this.router.navigate(['/']);
  }
}
