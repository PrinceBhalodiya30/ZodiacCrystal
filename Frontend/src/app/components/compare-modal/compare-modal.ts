import { Component, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { CompareService } from '../../services/compare.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { getProductSlug } from '../../utils/product-slug.util';
import { getStars } from '../../utils/rating.util';
import { InrPipe } from '../../pipes/inr.pipe';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { ZodiacIcon } from '../zodiac-icon/zodiac-icon';

@Component({
  selector: 'app-compare-modal',
  standalone: true,
  imports: [InrPipe, RouterLink, ImgFallbackDirective, ZodiacIcon, DecimalPipe],
  templateUrl: './compare-modal.html',
  styleUrl: './compare-modal.css'
})
export class CompareModal {
  compareService = inject(CompareService);
  private cartService = inject(CartService);

  isOpen = this.compareService.isModalOpen;
  items = this.compareService.items;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  close(): void {
    this.compareService.closeModal();
  }

  getImage(product: Product): string | null {
    return getPrimaryImageUrl(product);
  }

  getProductSlug(product: Product): string {
    return getProductSlug(product);
  }

  getRating(product: Product): string {
    return getStars(product.averageRating ?? 0);
  }

  remove(product: Product): void {
    this.compareService.remove(product.productId);
  }

  addToCart(product: Product): void {
    this.cartService.addToCart(product, 1);
  }
}
