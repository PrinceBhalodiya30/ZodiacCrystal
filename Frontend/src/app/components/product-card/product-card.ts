import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Product } from '../../models/product';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { getStockLabel, getStockStatus } from '../../utils/stock-status.util';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { NotificationService } from '../../services/notification.service';
import { WishlistService } from '../../services/wishlist.service';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { getStars } from '../../utils/rating.util';
import { getDiscountPercent } from '../../utils/pricing.util';
import { ZodiacIcon } from '../zodiac-icon/zodiac-icon';

import { InrPipe } from '../../pipes/inr.pipe';
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [InrPipe, RouterLink, ImgFallbackDirective, ZodiacIcon],
  templateUrl: './product-card.html',
  styleUrl: './product-card.css'
})
export class ProductCard implements OnInit {
  @Input({ required: true }) product!: Product;
  @Input() variant: 'default' | 'wishlist' = 'default';

  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  wishlistService = inject(WishlistService);

  constructor() {
    // Live stock (SignalR): the badge and Add to Cart follow sell-outs/restocks.
    inject(NotificationService).stockChanged
      .pipe(takeUntilDestroyed())
      .subscribe(levels => {
        const level = levels.find(l => l.productId === this.product?.productId);
        if (level) {
          this.product = { ...this.product, stockQuantity: level.stockQuantity };
        }
      });
  }

  selectedImageUrl = signal<string | null>(null);
  justAdded = signal(false);

  get ratingStars(): string {
    return getStars(this.product.averageRating ?? 0);
  }

  get discountPercent(): number | null {
    return getDiscountPercent(this.product.price, this.product.compareAtPrice);
  }

  ngOnInit(): void {
    this.selectedImageUrl.set(getPrimaryImageUrl(this.product));
  }

  get stockLabel(): string {
    return getStockLabel(this.product.stockQuantity);
  }

  get stockStatus(): string {
    return getStockStatus(this.product.stockQuantity);
  }

  get isOutOfStock(): boolean {
    return this.product.stockQuantity <= 0;
  }

  get isUnavailable(): boolean {
    return !this.product.isActive;
  }

  get purchaseDisabled(): boolean {
    return this.isOutOfStock || this.isUnavailable;
  }

  get unavailableMessage(): string | null {
    if (this.isUnavailable) {
      return 'No longer available';
    }
    if (this.isOutOfStock) {
      return 'Out of stock';
    }
    return null;
  }

  addToCart(): void {
    if (this.purchaseDisabled) {
      return;
    }

    const added = this.cartService.addToCart(this.product, 1);
    if (added === 0) {
      this.toast.error(CartService.shortfallMessage(this.product, 1, 0)!);
      return;
    }
    this.toast.success(`${this.product.name} added to cart`);
    this.flashAdded();
  }

  private flashAdded(): void {
    this.justAdded.set(true);
    setTimeout(() => this.justAdded.set(false), 1100);
  }

  get isWishlisted(): boolean {
    return this.wishlistService.isWishlisted(this.product.productId);
  }

  toggleWishlist(): void {
    if (!this.requireLogin()) {
      return;
    }

    this.wishlistService.toggle(this.product);
  }

  moveToCart(): void {
    if (this.purchaseDisabled) {
      return;
    }

    if (!this.requireLogin()) {
      return;
    }

    if (this.cartService.addToCart(this.product, 1) === 0) {
      this.toast.error(CartService.shortfallMessage(this.product, 1, 0)!);
      return;
    }
    this.wishlistService.removeByProductId(this.product.productId, this.product.name, true);
    this.toast.success(`${this.product.name} moved to cart`);
  }

  buyNow(): void {
    if (this.purchaseDisabled) {
      return;
    }

    this.cartService.setBuyNowItem(this.product, 1);

    // Checkout itself offers log in or guest checkout.
    this.router.navigate(['/checkout']);
  }

  private requireLogin(returnUrl: string = this.router.url, message = 'Please log in to continue.'): boolean {
    if (this.authService.isLoggedIn()) {
      return true;
    }

    this.toast.error(message);
    this.router.navigate(['/login'], { queryParams: { returnUrl } });
    return false;
  }
}
