import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WishlistService } from '../../services/wishlist.service';

interface AccountLink {
  label: string;
  path: string;
  // Overview is /profile, so it must match exactly or it would stay lit on /profile/settings.
  exact: boolean;
  icon: 'overview' | 'orders' | 'addresses' | 'wishlist' | 'support' | 'settings';
  customerOnly: boolean;
}

const LINKS: AccountLink[] = [
  { label: 'Overview', path: '/profile', exact: true, icon: 'overview', customerOnly: false },
  { label: 'Orders', path: '/orders', exact: false, icon: 'orders', customerOnly: true },
  { label: 'Addresses', path: '/profile/addresses', exact: false, icon: 'addresses', customerOnly: true },
  { label: 'Wishlist', path: '/wishlist', exact: false, icon: 'wishlist', customerOnly: true },
  { label: 'Support', path: '/support', exact: false, icon: 'support', customerOnly: true },
  { label: 'Settings', path: '/profile/settings', exact: false, icon: 'settings', customerOnly: false }
];

// "My Account" shell: identity block + side menu (tabs on phones) around the
// account pages. The pages keep their own URLs (/orders, /wishlist, ...), this
// just gives them one shared frame.
@Component({
  selector: 'app-account-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './account-layout.html',
  styleUrl: './account-layout.css'
})
export class AccountLayout {
  authService = inject(AuthService);
  wishlistService = inject(WishlistService);
  private router = inject(Router);

  // Admins have no orders/addresses/wishlist (those routes are customer-only).
  links = computed(() => (this.authService.isAdmin() ? LINKS.filter(l => !l.customerOnly) : LINKS));

  initials = computed(() => {
    const name = this.authService.currentUser()?.name?.trim() ?? '';
    if (!name) {
      return '?';
    }
    const parts = name.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  });

  logout(): void {
    this.authService.logout();
    this.wishlistService.clear();
    this.router.navigate(['/']);
  }
}
