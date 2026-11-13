import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InrPipe } from '../../../../pipes/inr.pipe';
import { Product } from '../../../../models/product';

export interface BundleItem {
  product: Product;
  slug: string;
  imageUrl: string | null;
  selected: boolean;
  isMain: boolean;
}

@Component({
  selector: 'app-product-bundle',
  standalone: true,
  imports: [RouterLink, InrPipe],
  templateUrl: './product-bundle.html',
  styleUrl: './product-bundle.css'
})
export class ProductBundle {
  @Input({ required: true }) bundleItems: BundleItem[] = [];
  @Input() bundleJustAdded = false;

  @Output() readonly itemToggled = new EventEmitter<number>();
  @Output() readonly bundleAdded = new EventEmitter<void>();

  get bundleSelectedItems(): BundleItem[] {
    return (this.bundleItems || []).filter(i => i.selected);
  }

  bundleSelectedCount(): number {
    return this.bundleSelectedItems.length;
  }

  bundleOriginalTotal(): number {
    return this.bundleSelectedItems.reduce((sum, i) => sum + i.product.price, 0);
  }

  bundleSavings(): number {
    const count = this.bundleSelectedCount();
    if (count < 2) return 0;
    return Math.round(this.bundleOriginalTotal() * 0.10);
  }

  bundleFinalPrice(): number {
    return this.bundleOriginalTotal() - this.bundleSavings();
  }

  toggleItem(productId: number): void {
    this.itemToggled.emit(productId);
  }

  addBundle(): void {
    this.bundleAdded.emit();
  }
}
