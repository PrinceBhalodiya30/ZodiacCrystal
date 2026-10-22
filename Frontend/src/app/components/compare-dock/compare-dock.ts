import { Component, inject } from '@angular/core';
import { CompareService } from '../../services/compare.service';
import { Product } from '../../models/product';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

@Component({
  selector: 'app-compare-dock',
  standalone: true,
  imports: [ImgFallbackDirective],
  templateUrl: './compare-dock.html',
  styleUrl: './compare-dock.css'
})
export class CompareDock {
  compareService = inject(CompareService);

  items = this.compareService.items;
  count = this.compareService.count;
  max = this.compareService.max;

  getImage(product: Product): string | null {
    return getPrimaryImageUrl(product);
  }

  remove(product: Product, event: MouseEvent): void {
    event.stopPropagation();
    this.compareService.remove(product.productId);
  }

  clear(): void {
    this.compareService.clear();
  }

  open(): void {
    this.compareService.openModal();
  }
}
