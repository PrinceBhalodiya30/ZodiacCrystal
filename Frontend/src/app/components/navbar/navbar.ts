import { Component, ElementRef, HostListener, computed, inject, signal, effect, WritableSignal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
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
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { getProductSlug } from '../../utils/product-slug.util';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { InrPipe } from '../../pipes/inr.pipe';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule, NotificationBell, MoonTransitBar, InrPipe, ImgFallbackDirective],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  readonly siteName = SITE_NAME;
  readonly authService = inject(AuthService);
  readonly cartService = inject(CartService);
  readonly wishlistService = inject(WishlistService);
  readonly quizService = inject(QuizService);
  readonly storeSettings = inject(StoreSettingsService);
  readonly productService = inject(ProductService);
  private readonly router = inject(Router);

  private readonly searchInputElement = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  openQuiz(): void {
    this.quizService.open();
  }

  // Checkout gets a focused header (logo + "Secure checkout" only) so shoppers
  // aren't tempted away mid-purchase; the logo still links home.
  // Pages with an inline checkout (Mystery Box) turn it on via CheckoutModeService.
  private readonly checkoutMode = inject(CheckoutModeService);
  private readonly isCheckoutRoute = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/checkout'))
    ),
    { initialValue: this.router.url.startsWith('/checkout') }
  );
  readonly isCheckout = computed(() => this.isCheckoutRoute() || this.checkoutMode.active());

  readonly isMenuOpen = signal(false);
  readonly isScrolled = signal(false);
  readonly isSearchOpen = signal(false);
  readonly searchTerm = signal('');
  readonly isSearching = signal(false);
  readonly liveSuggestions = signal<Product[]>([]);
  private readonly searchSubject$ = new Subject<string>();

  readonly popularSearches: readonly string[] = [
    'Amethyst',
    'Pyrite Specimen',
    'Rose Quartz',
    'Clear Quartz',
    'Protection',
    'Wealth'
  ];

  readonly isShopDropdownOpen = signal(false);
  readonly isAccountDropdownOpen = signal(false);

  readonly userInitials = computed(() => {
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

  readonly cartBump = signal(false);
  readonly wishlistBump = signal(false);
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

    // Reactive live autocomplete for instant search feedback
    this.searchSubject$
      .pipe(
        takeUntilDestroyed(),
        debounceTime(200),
        distinctUntilChanged(),
        switchMap(term => {
          const trimmed = term.trim();
          if (trimmed.length < 2) {
            return of(null);
          }
          this.isSearching.set(true);
          return this.productService.getProductsPaged(1, 5, {
            search: trimmed,
            activeOnly: true
          });
        })
      )
      .subscribe({
        next: result => {
          this.isSearching.set(false);
          this.liveSuggestions.set(result?.items ?? []);
        },
        error: () => {
          this.isSearching.set(false);
          this.liveSuggestions.set([]);
        }
      });
  }

  private triggerBump(bumpSignal: WritableSignal<boolean>): void {
    bumpSignal.set(true);
    setTimeout(() => bumpSignal.set(false), 350);
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
    this.closeSearch();
    this.isMenuOpen.set(false);
  }

  toggleSearch(): void {
    const nextState = !this.isSearchOpen();
    this.isSearchOpen.set(nextState);
    if (nextState) {
      setTimeout(() => {
        this.searchInputElement()?.nativeElement?.focus();
        this.searchInputElement()?.nativeElement?.select();
      }, 50);
    } else {
      this.closeSearch();
    }
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      this.liveSuggestions.set([]);
      this.isSearching.set(false);
      return;
    }
    this.searchSubject$.next(trimmed);
  }

  clearSearchInput(): void {
    this.searchTerm.set('');
    this.liveSuggestions.set([]);
    this.isSearching.set(false);
    this.searchInputElement()?.nativeElement?.focus();
  }

  selectSuggestion(product: Product): void {
    const slug = getProductSlug(product);
    void this.router.navigate(['/products', slug]);
    this.closeSearch();
  }

  quickSearch(term: string): void {
    this.searchTerm.set(term);
    this.submitSearch();
  }

  closeSearch(): void {
    this.isSearchOpen.set(false);
    this.searchTerm.set('');
    this.liveSuggestions.set([]);
    this.isSearching.set(false);
  }

  getProductImage(product: Product): string {
    return getPrimaryImageUrl(product) || 'assets/images/placeholder.svg';
  }

  submitSearch(): void {
    const term = this.searchTerm().trim();
    if (!term) {
      return;
    }

    void this.router.navigate(['/products'], { queryParams: { search: term } });
    this.closeSearch();
    this.closeMenu();
  }

  onCartClick(): void {
    this.closeMenu();
    this.cartService.toggleDrawer();
  }

  logout(): void {
    this.isAccountDropdownOpen.set(false);
    this.authService.logout();
    this.wishlistService.clear();
    this.closeMenu();
    void this.router.navigate(['/']);
  }
}
