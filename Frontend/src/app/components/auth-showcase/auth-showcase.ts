import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { ReviewService } from '../../services/review.service';
import { CouponService } from '../../services/coupon.service';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { HERO_IMAGE_URL } from '../../utils/hero-image.util';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { InrPipe } from '../../pipes/inr.pipe';
import { FREE_SHIPPING_THRESHOLD } from '../../services/cart.service';
import { PublicCoupon } from '../../models/coupon';
import { Review } from '../../models/review';

interface FeaturedProduct {
  productId: number;
  name: string;
  imageUrl: string;
}

// One hand-picked product photo per page - light, natural shots that sit well
// on the panel's cream background (a mixed collage of differently lit photos
// looked messy). Change the id to feature another product; if it is missing,
// inactive or has no photo, the curated hero photo is shown instead.
const FEATURED_PRODUCT_ID = {
  login: 25,    // Amethyst Cluster
  register: 29  // Chakra Healing Crystal Set
} as const;

// Products whose reviews may appear on the login page.
const REVIEW_SOURCE_COUNT = 12;

// Left panel of the Login / Register pages: real products from the catalogue,
// plus a real customer review (login) or the store's promises and current
// offer (register). Everything is live data; sections hide when there's none.
@Component({
  selector: 'app-auth-showcase',
  standalone: true,
  imports: [RouterLink, ImgFallbackDirective, InrPipe],
  templateUrl: './auth-showcase.html',
  styleUrl: './auth-showcase.css'
})
export class AuthShowcase implements OnInit {
  @Input() mode: 'login' | 'register' = 'login';

  private productService = inject(ProductService);
  private reviewService = inject(ReviewService);
  private couponService = inject(CouponService);

  readonly freeShippingThreshold = FREE_SHIPPING_THRESHOLD;
  readonly fallbackImage = HERO_IMAGE_URL;

  featured = signal<FeaturedProduct | null>(null);
  review = signal<(Review & { productName: string }) | null>(null);
  offer = signal<PublicCoupon | null>(null);

  ngOnInit(): void {
    this.productService
      .getProduct(FEATURED_PRODUCT_ID[this.mode])
      .pipe(catchError(() => of(null)))
      .subscribe(product => {
        const imageUrl = product?.isActive ? getPrimaryImageUrl(product) : null;
        this.featured.set(product && imageUrl ? { productId: product.productId, name: product.name, imageUrl } : null);
      });

    if (this.mode === 'login') {
      // Best-rated products first, so the review comes from a well-loved item.
      this.productService
        .getProductsPaged(1, REVIEW_SOURCE_COUNT, undefined, null, true, null, null, null, false, 'rating')
        .pipe(catchError(() => of(null)))
        .subscribe(page => this.loadReview((page?.items ?? []).map(p => ({ productId: p.productId, name: p.name }))));
    }

    if (this.mode === 'register') {
      this.couponService
        .getActiveCoupons()
        .pipe(catchError(() => of([] as PublicCoupon[])))
        .subscribe(coupons => this.offer.set(this.bestOffer(coupons)));
    }
  }

  // A recent 5-star (or failing that, 4-star) review with a real sentence -
  // one-word reviews ("Good") are skipped; the card stays hidden until a
  // review worth quoting exists.
  private loadReview(products: { productId: number; name: string }[]): void {
    if (products.length === 0) {
      return;
    }

    forkJoin(
      products.map(p =>
        this.reviewService.getReviews(p.productId).pipe(
          map(r => r.reviews.map(review => ({ ...review, productName: p.name }))),
          catchError(() => of([]))
        )
      )
    ).subscribe(lists => {
      const candidates = lists
        .flat()
        .filter(r => r.rating >= 4 && (r.comment?.trim().length ?? 0) >= 20 && (r.comment?.length ?? 0) <= 220)
        .sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt));

      this.review.set(candidates[0] ?? null);
    });
  }

  // The coupon a new customer is most likely to use: lowest minimum order,
  // then the biggest discount.
  private bestOffer(coupons: PublicCoupon[]): PublicCoupon | null {
    return [...coupons].sort((a, b) =>
      a.minimumOrderAmount - b.minimumOrderAmount || b.discountValue - a.discountValue
    )[0] ?? null;
  }

  stars(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < rating);
  }

  // "Priya Sharma" -> "Priya S." - enough to feel real without showing a full name.
  shortName(name: string): string {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  }
}
