import { Component, Input, OnChanges, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { RecentlyViewedService } from '../../services/recently-viewed.service';
import { Product } from '../../models/product';
import { ProductCard } from '../product-card/product-card';

@Component({
  selector: 'app-recently-viewed',
  standalone: true,
  imports: [ProductCard],
  templateUrl: './recently-viewed.html',
  styleUrl: './recently-viewed.css'
})
export class RecentlyViewed implements OnInit, OnChanges {
  private productService = inject(ProductService);
  private recentlyViewedService = inject(RecentlyViewedService);

  // The product currently being viewed, if any - excluded from this list so a
  // product is never shown alongside itself on its own details page.
  @Input() excludeProductId: number | null = null;

  products = signal<Product[]>([]);

  constructor() {
    // The list is replaced on sign-in/out, when the server copy arrives, and on
    // "Clear history" - reload even if this page stays open.
    effect(() => {
      if (this.recentlyViewedService.changed() > 0) {
        untracked(() => this.load());
      }
    });
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(): void {
    this.load();
  }

  clearHistory(): void {
    this.recentlyViewedService.clear();
  }

  private load(): void {
    const ids = this.recentlyViewedService.productIds().filter(id => id !== this.excludeProductId);

    if (ids.length === 0) {
      this.products.set([]);
      return;
    }

    forkJoin(
      ids.map(id =>
        this.productService.getProduct(id).pipe(catchError(() => of(null)))
      )
    ).subscribe(results => {
      const valid: Product[] = [];

      results.forEach((product, index) => {
        // A missing/deleted product, or one that's no longer active, is silently
        // dropped from the stored list rather than shown as a broken card.
        if (product && product.isActive) {
          valid.push(product);
        } else {
          this.recentlyViewedService.remove(ids[index]);
        }
      });

      this.products.set(valid);
    });
  }
}
