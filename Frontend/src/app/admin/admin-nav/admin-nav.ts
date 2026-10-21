import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AdminNavCountsService } from './admin-nav-counts.service';
import { SITE_NAME } from '../../services/page-title.service';

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

const ICONS = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  products: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  categories: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  zodiac: 'M12 2l2.9 6.9L22 9.3l-5.5 4.8L18.2 21 12 17.3 5.8 21l1.7-6.9L2 9.3l7.1-.4z',
  images: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01',
  stock: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  orders: 'M6 2l-2 4v14h16V6l-2-4zM4 6h16M16 10a4 4 0 0 1-8 0',
  returns: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  coupons: 'M20 12V6H4v4a2 2 0 0 1 0 4v4h16v-6a2 2 0 0 1 0-4zM10 6v12',
  reports: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  reviews: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  support: 'M3 14v-2a9 9 0 0 1 18 0v2M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z',
  newsletter: 'M4 4h16v16H4zM4 6l8 7 8-7',
  audit: 'M9 5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 3h6v4H9zM9 12h6M9 16h4',
  store: 'M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21V12h6v9',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'
};

@Component({
  selector: 'app-admin-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './admin-nav.html',
  styleUrl: './admin-nav.css'
})
export class AdminNav implements OnInit {
  readonly siteName = SITE_NAME;
  private authService = inject(AuthService);
  private router = inject(Router);
  private counts = inject(AdminNavCountsService);

  readonly icons = ICONS;

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
