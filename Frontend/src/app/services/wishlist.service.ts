import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WishlistItem } from '../models/wishlist';
import { Product } from '../models/product';
import { getPrimaryImageUrl } from '../utils/product-image.util';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private baseUrl = `${API_BASE_URL}/Wishlist`;

  items = signal<WishlistItem[]>([]);
  count = computed(() => this.items().length);
  isLoading = signal(false);
  errorMessage = signal('');

  private hasLoaded = false;

  constructor() {
    if (this.authService.isLoggedIn()) {
      this.loadWishlist();
    }
  }

  loadWishlist(): void {
    if (!this.authService.isLoggedIn()) {
      this.items.set([]);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.getWishlist().subscribe({
      next: items => {
        this.hasLoaded = true;
        this.items.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load your wishlist.');
        this.isLoading.set(false);
      }
    });
  }

  isWishlisted(productId: number): boolean {
    return this.items().some(item => item.productId === productId);
  }

  clear(): void {
    this.hasLoaded = false;
    this.items.set([]);
  }

  toggle(product: Product): void {
    if (!this.authService.isLoggedIn()) {
      return;
    }

    if (!this.hasLoaded) {
      this.loadWishlist();
    }

    if (this.isWishlisted(product.productId)) {
      this.remove(product);
    } else {
      this.add(product);
    }
  }

  private add(product: Product): void {
    const previous = this.items();
    const optimisticItem: WishlistItem = {
      productId: product.productId,
      productName: product.name,
      price: product.price,
      primaryImageUrl: getPrimaryImageUrl(product),
      stockQuantity: product.stockQuantity,
      isActive: product.isActive,
      addedAt: new Date().toISOString()
    };

    this.items.set([optimisticItem, ...previous]);

    this.http.post(`${this.baseUrl}/${product.productId}`, {}).subscribe({
      next: () => {
        this.hasLoaded = true;
      },
      error: () => {
        this.items.set(previous);
        this.toast.error('Could not add to wishlist. Please try again.');
      }
    });
  }

  private remove(product: Product): void {
    this.removeByProductId(product.productId, product.name);
  }

  removeByProductId(productId: number, productName: string, silent = false): void {
    const previous = this.items();
    this.items.set(previous.filter(item => item.productId !== productId));

    this.http.delete(`${this.baseUrl}/${productId}`).subscribe({
      next: () => {
        // Optimistic UI updated cleanly without popping notification
      },
      error: () => {
        this.items.set(previous);
        this.toast.error('Could not remove from wishlist. Please try again.');
      }
    });
  }

  private getWishlist(): Observable<WishlistItem[]> {
    return this.http.get<WishlistItem[]>(this.baseUrl);
  }
}
