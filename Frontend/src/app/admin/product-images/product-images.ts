import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { AdminNav } from '../admin-nav/admin-nav';
import { ImageManagerModal } from '../shared/image-manager-modal/image-manager-modal';
import { Spinner } from '../../components/spinner/spinner';
import { Pager } from '../../components/pager/pager';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { debounced } from '../../utils/debounce.util';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-product-images',
  standalone: true,
  imports: [Spinner, FormsModule, AdminNav, ImageManagerModal, Pager, ImgFallbackDirective],
  templateUrl: './product-images.html',
  styleUrls: ['../admin-shared.css', './product-images.css']
})
export class AdminProductImages implements OnInit {
  private productService = inject(ProductService);

  products = signal<Product[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  page = signal(1);
  totalPages = signal(1);
  totalCount = signal(0);
  searchTerm = signal('');
  // Products with no photos at all - the ones that need attention here.
  missingImagesOnly = signal(false);
  hasFilters = computed(() => !!this.searchTerm().trim() || this.missingImagesOnly());

  manageImagesProduct = signal<Product | null>(null);

  private loadSubscription?: Subscription;
  // Typing searches once the admin pauses, instead of on every keystroke.
  onSearchInput = debounced((term: string) => this.onSearchChange(term));

  ngOnInit(): void {
    this.loadProducts();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadProducts();
  }

  onSearchChange(term: string): void {
    this.onSearchInput.cancel();
    this.searchTerm.set(term);
    this.page.set(1);
    this.loadProducts();
  }

  onMissingImagesChange(value: boolean): void {
    this.missingImagesOnly.set(value);
    this.page.set(1);
    this.loadProducts();
  }

  clearFilters(): void {
    this.onSearchInput.cancel();
    this.searchTerm.set('');
    this.missingImagesOnly.set(false);
    this.page.set(1);
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    // A newer load (next page, new search) replaces any request still in flight.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.productService.getProductsAdminPaged(this.page(), PAGE_SIZE, { search: this.searchTerm().trim() || undefined, missingImagesOnly: this.missingImagesOnly() }).subscribe({
      next: result => {
        // Adding photos to the last product on the last page (while "Missing
        // images only" is on) leaves it empty; step back a page.
        if (result.items.length === 0 && this.page() > 1) {
          this.page.set(Math.max(1, result.totalPages));
          this.loadProducts();
          return;
        }
        this.products.set(result.items);
        this.totalPages.set(result.totalPages || 1);
        this.totalCount.set(result.totalCount);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load products.');
        this.isLoading.set(false);
      }
    });
  }

  primaryImage(product: Product): string | null {
    return getPrimaryImageUrl(product);
  }

  openImageManager(product: Product): void {
    this.manageImagesProduct.set(product);
  }

  closeImageManager(): void {
    this.manageImagesProduct.set(null);
  }

  onImagesProductUpdated(updated: Product): void {
    this.manageImagesProduct.set(updated);
    this.products.update(items =>
      items.map(p => (p.productId === updated.productId ? updated : p))
    );
  }
}
