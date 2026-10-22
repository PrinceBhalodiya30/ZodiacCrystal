import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AdminNavCountsService } from './admin-nav-counts.service';
import { SITE_NAME } from '../../services/page-title.service';
import { AdminCommandPalette } from '../shared/admin-command-palette/admin-command-palette';
import { NotificationBell } from '../../components/notification-bell/notification-bell';

type BadgeKey = 'pendingOrders' | 'requestedReturns' | 'lowStock' | 'openTickets';

interface NavLink {
  label: string;
  path: string;
  // SVG path data drawn on a 24x24 stroke icon.
  icon: string;
  badge?: BadgeKey;
  badgeLabel?: string;
}

interface NavGroup {
  title: string | null;
  links: NavLink[];
}

import { ADMIN_NAV_ICONS } from './admin-nav-icons';
export { ADMIN_NAV_ICONS };

const ICONS = ADMIN_NAV_ICONS;

@Component({
  selector: 'app-admin-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AdminCommandPalette, NotificationBell],
  templateUrl: './admin-nav.html',
  styleUrl: './admin-nav.css'
})
export class AdminNav implements OnInit {
  @ViewChild(AdminCommandPalette) commandPalette?: AdminCommandPalette;
  readonly siteName = SITE_NAME;
  private authService = inject(AuthService);
  private router = inject(Router);
  private counts = inject(AdminNavCountsService);

  openCommandPalette(): void {
    this.commandPalette?.open();
  }

  readonly icons = ADMIN_NAV_ICONS;

  readonly groups: NavGroup[] = [
    { title: null, links: [{ label: 'Dashboard', path: '/admin/dashboard', icon: ICONS.dashboard }] },
    {
      title: 'Catalog',
      links: [
        { label: 'Products', path: '/admin/products', icon: ICONS.products },
        { label: 'Categories', path: '/admin/categories', icon: ICONS.categories },
        { label: 'Zodiac Signs', path: '/admin/zodiac', icon: ICONS.zodiac },
        { label: 'Product Images', path: '/admin/product-images', icon: ICONS.images },
        { label: 'Stock', path: '/admin/stock', icon: ICONS.stock, badge: 'lowStock', badgeLabel: 'products low or out of stock' }
      ]
    },
    {
      title: 'Sales',
      links: [
        { label: 'Orders', path: '/admin/orders', icon: ICONS.orders, badge: 'pendingOrders', badgeLabel: 'new orders to confirm' },
        { label: 'Returns', path: '/admin/returns', icon: ICONS.returns, badge: 'requestedReturns', badgeLabel: 'returns waiting for review' },
        { label: 'Coupons', path: '/admin/coupons', icon: ICONS.coupons },
        { label: 'Reports', path: '/admin/reports', icon: ICONS.reports }
      ]
    },
    {
      title: 'Customers',
      links: [
        { label: 'Support', path: '/admin/support', icon: ICONS.support, badge: 'openTickets', badgeLabel: 'support tickets waiting for a reply' },
        { label: 'Users', path: '/admin/users', icon: ICONS.users },
        { label: 'Reviews', path: '/admin/reviews', icon: ICONS.reviews },
        { label: 'Newsletter', path: '/admin/newsletter-subscribers', icon: ICONS.newsletter }
      ]
    },
    {
      title: 'System',
      links: [{ label: 'Audit Logs', path: '/admin/audit-logs', icon: ICONS.audit }]
    }
  ];

  ngOnInit(): void {
    // Each admin page renders its own nav, so this refreshes the badges on every page visit.
    this.counts.refresh();
  }

  badgeCount(key: BadgeKey | undefined): number {
    return key ? this.counts[key]() : 0;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
