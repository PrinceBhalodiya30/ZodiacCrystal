import { Component, HostListener, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { StoreSettingsService } from '../../services/store-settings.service';
import { CartItem } from '../../models/cart';
import { Product } from '../../models/product';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { getProductSlug } from '../../utils/product-slug.util';
import { InrPipe } from '../../pipes/inr.pipe';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [InrPipe, RouterLink, ImgFallbackDirective],
  templateUrl: './cart-drawer.html',
  styleUrl: './cart-drawer.css'
})
export class CartDrawer {
  cartService = inject(CartService);
  private storeSettings = inject(StoreSettingsService);
  private router = inject(Router);

  readonly threshold = computed(() => this.storeSettings.freeShippingThreshold());

  items = this.cartService.items;
  total = this.cartService.total;
  totalQuantity = this.cartService.totalQuantity;
  isOpen = this.cartService.isDrawerOpen;
  lastAddedProduct = this.cartService.lastAddedProduct;

  amountNeeded = computed(() => Math.max(0, this.threshold() - this.total()));
  progressPercent = computed(() => Math.min(100, Math.round((this.total() / (this.threshold() || 1)) * 100)));
  hasFreeShipping = computed(() => this.total() >= this.threshold());

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  close(): void {
    this.cartService.closeDrawer();
  }

  pauseAutoClose(): void {
    this.cartService.pauseAutoClose();
  }

  resumeAutoClose(): void {
    this.cartService.resumeAutoClose();
  }

  getItemImage(product: Product): string | null {
    return getPrimaryImageUrl(product);
  }

  getProductSlug(product: Product): string {
    return getProductSlug(product);
  }

  increase(item: CartItem): void {
    if (item.quantity < item.product.stockQuantity) {
      this.cartService.updateQuantity(item.product.productId, item.quantity + 1);
    }
  }

  decrease(item: CartItem): void {
    if (item.quantity > 1) {
      this.cartService.updateQuantity(item.product.productId, item.quantity - 1);
    } else {
      this.remove(item);
    }
  }

  remove(item: CartItem): void {
    this.cartService.removeFromCart(item.product.productId);
    if (this.cartService.items().length === 0) {
      setTimeout(() => {
        if (this.cartService.items().length === 0 && this.isOpen()) {
          this.close();
        }
      }, 1000);
    }
  }

  proceedToCheckout(): void {
    this.close();
    if (!this.router.url.startsWith('/cart')) {
      this.router.navigateByUrl('/cart').then(() => {
        this.router.navigateByUrl('/checkout');
      });
    } else {
      this.router.navigate(['/checkout']);
    }
  }

  viewFullCart(): void {
    this.close();
    this.router.navigate(['/cart']);
  }
}
