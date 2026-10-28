import { Component, ElementRef, HostListener, ViewChild, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../services/product.service';
import { UserService } from '../../../services/user.service';
import { debounced } from '../../../utils/debounce.util';
import { Product } from '../../../models/product';
import { AdminUser } from '../../../models/user';
import { PagedResult } from '../../../models/paged-result';
import { ADMIN_NAV_ICONS } from '../../admin-nav/admin-nav-icons';

export interface CommandItem {
  id: string;
  category: 'Navigation' | 'Order' | 'Product' | 'Customer';
  title: string;
  subtitle?: string;
  icon: string;
  path: string;
  queryParams?: Record<string, string | number>;
}

const STATIC_NAV_COMMANDS: CommandItem[] = [
  { id: 'nav-dash', category: 'Navigation', title: 'Dashboard', subtitle: 'Store overview, KPI cards & insights', icon: ADMIN_NAV_ICONS.dashboard, path: '/admin/dashboard' },
  { id: 'nav-orders', category: 'Navigation', title: 'Orders', subtitle: 'Manage orders, fulfillment & tracking', icon: ADMIN_NAV_ICONS.orders, path: '/admin/orders' },
  { id: 'nav-products', category: 'Navigation', title: 'Products', subtitle: 'Catalog, crystal items & pricing', icon: ADMIN_NAV_ICONS.products, path: '/admin/products' },
  { id: 'nav-stock', category: 'Navigation', title: 'Stock & Inventory', subtitle: 'Low stock warnings & replenishment', icon: ADMIN_NAV_ICONS.stock, path: '/admin/stock' },
  { id: 'nav-categories', category: 'Navigation', title: 'Categories', subtitle: 'Product categories & collections', icon: ADMIN_NAV_ICONS.categories, path: '/admin/categories' },
  { id: 'nav-zodiac', category: 'Navigation', title: 'Zodiac Signs', subtitle: 'Astrological signs & stone affinity', icon: ADMIN_NAV_ICONS.zodiac, path: '/admin/zodiac' },
  { id: 'nav-images', category: 'Navigation', title: 'Product Images', subtitle: 'Gallery & image asset library', icon: ADMIN_NAV_ICONS.images, path: '/admin/product-images' },
  { id: 'nav-returns', category: 'Navigation', title: 'Returns', subtitle: 'Customer returns & photo inspection', icon: ADMIN_NAV_ICONS.returns, path: '/admin/returns' },
  { id: 'nav-support', category: 'Navigation', title: 'Support Tickets', subtitle: 'Customer inquiries & canned replies', icon: ADMIN_NAV_ICONS.support, path: '/admin/support' },
  { id: 'nav-reviews', category: 'Navigation', title: 'Customer Reviews', subtitle: 'Review moderation queue & ratings', icon: ADMIN_NAV_ICONS.reviews, path: '/admin/reviews' },
  { id: 'nav-coupons', category: 'Navigation', title: 'Coupons & Discounts', subtitle: 'Promo codes & usage limits', icon: ADMIN_NAV_ICONS.coupons, path: '/admin/coupons' },
  { id: 'nav-reports', category: 'Navigation', title: 'Sales Reports', subtitle: 'Revenue, area charts & analytics', icon: ADMIN_NAV_ICONS.reports, path: '/admin/reports' },
  { id: 'nav-users', category: 'Navigation', title: 'Users & Customers', subtitle: 'User accounts & Customer 360', icon: ADMIN_NAV_ICONS.users, path: '/admin/users' },
  { id: 'nav-settings', category: 'Navigation', title: 'Store Settings & CMS', subtitle: 'Announcement bar, shipping rules & hero banner', icon: ADMIN_NAV_ICONS.settings, path: '/admin/settings' },
  { id: 'nav-audit', category: 'Navigation', title: 'Audit Logs', subtitle: 'System security & action history', icon: ADMIN_NAV_ICONS.audit, path: '/admin/audit-logs' },
  { id: 'nav-news', category: 'Navigation', title: 'Newsletter Subscribers', subtitle: 'Email subscriber audience', icon: ADMIN_NAV_ICONS.newsletter, path: '/admin/newsletter-subscribers' },
  { id: 'nav-store', category: 'Navigation', title: 'View Storefront', subtitle: 'Public customer shop', icon: ADMIN_NAV_ICONS.store, path: '/' }
];

@Component({
  selector: 'app-admin-command-palette',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-command-palette.html',
  styleUrls: ['./admin-command-palette.css']
})
export class AdminCommandPalette {
  private router = inject(Router);
  private productService = inject(ProductService);
  private userService = inject(UserService);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  isOpen = signal(false);
  query = signal('');
  selectedIndex = signal(0);

  // Dynamic search results
  productResults = signal<CommandItem[]>([]);
  customerResults = signal<CommandItem[]>([]);

  readonly navCommands = STATIC_NAV_COMMANDS;

  onSearchInput = debounced((q: string) => this.fetchDynamicResults(q), 200);

  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcut(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.toggle();
    } else if (event.key === 'Escape' && this.isOpen()) {
      event.preventDefault();
      this.close();
    }
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.isOpen.set(true);
    this.query.set('');
    this.selectedIndex.set(0);
    this.productResults.set([]);
    this.customerResults.set([]);
    setTimeout(() => this.searchInput?.nativeElement.focus(), 50);
  }

  close(): void {
    this.isOpen.set(false);
    this.query.set('');
  }

  onQueryChange(val: string): void {
    this.query.set(val);
    this.selectedIndex.set(0);
    this.onSearchInput(val.trim());
  }

  // Combined and filtered commands
  filteredCommands = computed(() => {
    const q = this.query().trim().toLowerCase();
    const items: CommandItem[] = [];

    // 1. If query is numeric or starts with #, show Direct Order Jump
    const cleanNumber = q.startsWith('#') ? q.slice(1).trim() : q;
    if (cleanNumber && /^\d+$/.test(cleanNumber)) {
      items.push({
        id: `order-jump-${cleanNumber}`,
        category: 'Order',
        title: `Jump to Order #${cleanNumber}`,
        subtitle: 'Open order detail drawer directly',
        icon: ADMIN_NAV_ICONS.orders,
        path: '/admin/orders',
        queryParams: { order: cleanNumber }
      });
    }

    // 2. Navigation items matching query
    if (q) {
      const matchedNav = this.navCommands.filter(
        cmd => cmd.title.toLowerCase().includes(q) || (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q))
      );
      items.push(...matchedNav);
    } else {
      items.push(...this.navCommands);
    }

    // 3. Products
    items.push(...this.productResults());

    // 4. Customers
    items.push(...this.customerResults());

    return items;
  });

  onKeydown(event: KeyboardEvent): void {
    const total = this.filteredCommands().length;
    if (total === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex.update(i => (i + 1) % total);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex.update(i => (i - 1 + total) % total);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = this.filteredCommands()[this.selectedIndex()];
      if (selected) {
        this.executeCommand(selected);
      }
    }
  }

  executeCommand(item: CommandItem): void {
    this.close();
    this.router.navigate([item.path], { queryParams: item.queryParams });
  }

  private fetchDynamicResults(q: string): void {
    if (!q || q.length < 2) {
      this.productResults.set([]);
      this.customerResults.set([]);
      return;
    }

    // Search Products
    this.productService.getProductsAdminPaged(1, 4, { search: q }).subscribe({
      next: (res: PagedResult<Product>) => {
        const prods: CommandItem[] = (res.items || []).map((p: Product) => ({
          id: `prod-${p.productId}`,
          category: 'Product',
          title: p.name,
          subtitle: `SKU: ${p.sku || 'N/A'} · Stock: ${p.stockQuantity}`,
          icon: ADMIN_NAV_ICONS.products,
          path: '/admin/products',
          queryParams: { search: p.name }
        }));
        this.productResults.set(prods);
      },
      error: () => this.productResults.set([])
    });

    // Search Customers
    this.userService.getUsersAdminPaged(1, 4, q).subscribe({
      next: (res: PagedResult<AdminUser>) => {
        const custs: CommandItem[] = (res.items || []).map((u: AdminUser) => ({
          id: `user-${u.userId}`,
          category: 'Customer',
          title: u.name,
          subtitle: `${u.email} · ${u.role}`,
          icon: ADMIN_NAV_ICONS.users,
          path: '/admin/users',
          queryParams: { search: u.email }
        }));
        this.customerResults.set(custs);
      },
      error: () => this.customerResults.set([])
    });
  }
}
