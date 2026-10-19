import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { PageTitleService } from '../../services/page-title.service';
import { SeoService, absoluteUrl } from '../../services/seo.service';
import { SITE_URL } from '../../services/api-config';
import { Product } from '../../models/product';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { getStockLabel, getStockStatus } from '../../utils/stock-status.util';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { NotificationService } from '../../services/notification.service';
import { WishlistService } from '../../services/wishlist.service';
import { StockAlertService } from '../../services/stock-alert.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ReviewService } from '../../services/review.service';
import { PhotoEligibility, Review } from '../../models/review';
import { PickedPhoto, ReviewPhotoPicker } from '../../components/review-photos/review-photo-picker';
import { ReviewPhotoThumbs, ThumbPhoto } from '../../components/review-photos/review-photo-thumbs';
import { PhotoLightbox } from '../../components/photo-lightbox/photo-lightbox';
import { Spinner } from '../../components/spinner/spinner';
import { ProductCard } from '../../components/product-card/product-card';
import { RecentlyViewed } from '../../components/recently-viewed/recently-viewed';
import { RecentlyViewedService } from '../../services/recently-viewed.service';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { getStars as getStarsUtil } from '../../utils/rating.util';
import { getDiscountPercent as getDiscountPercentUtil } from '../../utils/pricing.util';
import { ZodiacIcon } from '../../components/zodiac-icon/zodiac-icon';

const RELATED_PRODUCT_LIMIT = 4;

import { InrPipe, formatInr } from '../../pipes/inr.pipe';
import { CouponService } from '../../services/coupon.service';
import { PublicCoupon } from '../../models/coupon';
import { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING_FEE } from '../../services/cart.service';
@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [
    InrPipe,
    Breadcrumbs,
    Spinner,
    RouterLink,
    DatePipe,
    ProductCard,
    RecentlyViewed,
    ImgFallbackDirective,
    ZodiacIcon,
    ReviewPhotoPicker,
    ReviewPhotoThumbs,
    PhotoLightbox
  ],
  templateUrl: './product-details.html',
  styleUrl: './product-details.css'
})
export class ProductDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private pageTitle = inject(PageTitleService);
  private seo = inject(SeoService);
  private stockAlertService = inject(StockAlertService);

  // "Notify me when it's back" for out-of-stock products (customers only).
  stockAlertSubscribed = signal(false);
  isStockAlertBusy = signal(false);
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  wishlistService = inject(WishlistService);
  private confirmDialog = inject(ConfirmDialogService);
  private reviewService = inject(ReviewService);
  private recentlyViewedService = inject(RecentlyViewedService);
  private destroyRef = inject(DestroyRef);
  private notificationService = inject(NotificationService);
  private couponService = inject(CouponService);

  readonly freeShippingThreshold = FREE_SHIPPING_THRESHOLD;
  readonly flatShippingFee = FLAT_SHIPPING_FEE;
  private activeCoupons = signal<PublicCoupon[]>([]);

  private productId = 0;
  private loadSubscription?: Subscription;

  product = signal<Product | null>(null);
  selectedImageUrl = signal<string | null>(null);
  quantity = signal(1);
  justAdded = signal(false);
  isLoading = signal(true);
  errorMessage = signal('');
  isLightboxOpen = signal(false);
  relatedProducts = signal<Product[]>([]);

  reviews = signal<Review[]>([]);
  averageRating = signal(0);
  reviewCount = signal(0);
  reviewsLoading = signal(true);
  reviewsError = signal('');

  reviewRating = signal(0);
  reviewComment = signal('');
  isSubmittingReview = signal(false);

  // Review photos: verified buyers (delivered order) can attach some; each is
  // public once an admin approves it. The author also sees their pending ones.
  photoEligibility = signal<PhotoEligibility | null>(null);
  reviewPhotos = signal<PickedPhoto[]>([]);
  // Approved photos from every review, for the "Customer photos" strip.
  customerPhotos = computed<ThumbPhoto[]>(() =>
    this.reviews().flatMap(review =>
      (review.images ?? [])
        .filter(photo => photo.status !== 'Pending')
        .map(photo => ({ imageUrl: photo.imageUrl, alt: `Photo by ${review.userName}` }))
    )
  );
  photoViewer = signal<{ urls: string[]; index: number; caption: string } | null>(null);

  ngOnInit(): void {
    // Same list checkout offers; a failure just hides the coupon line.
    this.couponService.getActiveCoupons().subscribe({
      next: coupons => this.activeCoupons.set(coupons),
      error: () => this.activeCoupons.set([])
    });

    // Angular reuses this component when going from one product to another (e.g. a
    // "You may also like" card), so react to every id change, not just the first.
    // Live stock (SignalR): if this product sells out or is restocked while open,
    // the stock badge and buttons update without a reload.
    this.notificationService.stockChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(levels => {
      const product = this.product();
      const level = product && levels.find(l => l.productId === product.productId);
      if (product && level) {
        this.product.set({ ...product, stockQuantity: level.stockQuantity });
      }
    });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.productId = Number(params.get('id'));
      this.resetForNewProduct();
      this.loadProduct();
    });
  }

  private resetForNewProduct(): void {
    this.product.set(null);
    this.selectedImageUrl.set(null);
    this.quantity.set(1);
    this.justAdded.set(false);
    this.isLightboxOpen.set(false);
    this.reviews.set([]);
    this.averageRating.set(0);
    this.reviewCount.set(0);
    this.reviewRating.set(0);
    this.reviewComment.set('');
    this.stockAlertSubscribed.set(false);
    this.photoEligibility.set(null);
    this.clearReviewPhotos();
  }

  loadProduct(): void {
    const id = this.productId;

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.relatedProducts.set([]);

    // Drop a still-pending request for the previous product so it can't overwrite this one.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.productService.getProduct(id).subscribe({
      next: product => {
        // Inactive products aren't for sale, so customers see "not found" rather than a listing.
        const activeProduct = product.isActive ? product : null;
        this.product.set(activeProduct);
        const fullTitle = this.pageTitle.setPageTitle(activeProduct?.name ?? 'Crystal Not Found');
        this.updateSeo(activeProduct, fullTitle);
        this.selectedImageUrl.set(activeProduct ? getPrimaryImageUrl(activeProduct) : null);
        this.isLoading.set(false);

        if (activeProduct) {
          this.loadRelatedProducts(activeProduct);
          this.loadReviews(activeProduct.productId);
          this.recentlyViewedService.record(activeProduct.productId);
          this.loadStockAlertStatus(activeProduct);
          this.loadPhotoEligibility(activeProduct.productId);
        }
      },
      error: (err: { status?: number }) => {
        // 404 = doesn't exist or is hidden (inactive): same "not found" view as above.
        if (err?.status === 404) {
          this.product.set(null);
          this.updateSeo(null, this.pageTitle.setPageTitle('Crystal Not Found'));
        } else {
          this.errorMessage.set('Unable to load product details.');
        }
        this.isLoading.set(false);
      }
    });
  }

  // Search/social tags plus schema.org Product data (price, stock, rating)
  // so Google can show rich results. Missing products are kept out of the index.
  private updateSeo(product: Product | null, fullTitle: string): void {
    if (!product) {
      this.seo.update({ title: fullTitle, noindex: true });
      this.seo.setJsonLd(null);
      return;
    }

    const images = product.images.map(image => absoluteUrl(image.imageUrl));
    const primaryImage = getPrimaryImageUrl(product);
    const url = `${SITE_URL}/products/${product.productId}`;

    this.seo.update({
      title: fullTitle,
      description: product.description || `${product.name} healing crystal from Zodiac Crystals.`,
      image: primaryImage,
      type: 'product'
    });

    this.seo.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      sku: product.sku,
      description: product.description || undefined,
      image: images.length ? images : undefined,
      category: product.categoryName || undefined,
      brand: { '@type': 'Brand', name: 'Zodiac Crystals' },
      url,
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: 'INR',
        price: product.price.toFixed(2),
        availability: product.stockQuantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition'
      },
      aggregateRating:
        product.reviewCount && product.averageRating
          ? {
              '@type': 'AggregateRating',
              ratingValue: product.averageRating.toFixed(1),
              reviewCount: product.reviewCount
            }
          : undefined
    });
  }

  loadReviews(productId: number): void {
    this.reviewsLoading.set(true);
    this.reviewsError.set('');

    this.reviewService.getReviews(productId).subscribe({
      next: result => {
        if (productId !== this.productId) {
          return;
        }
        this.reviews.set(result.reviews);
        this.averageRating.set(result.averageRating);
        this.reviewCount.set(result.reviewCount);
        this.reviewsLoading.set(false);
      },
      error: () => {
        if (productId !== this.productId) {
          return;
        }
        this.reviewsError.set('Unable to load reviews.');
        this.reviewsLoading.set(false);
      }
    });
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get hasReviewed(): boolean {
    const userId = this.authService.currentUser()?.userId;
    return userId !== undefined && this.reviews().some(r => r.userId === userId);
  }

  canDeleteReview(review: Review): boolean {
    const user = this.authService.currentUser();
    if (!user) {
      return false;
    }
    return user.userId === review.userId || user.role === 'Admin';
  }

  setReviewRating(rating: number): void {
    this.reviewRating.set(rating);
  }

  submitReview(): void {
    const product = this.product();
    if (!product || this.reviewRating() < 1) {
      this.toast.error('Please select a star rating.');
      return;
    }

    this.isSubmittingReview.set(true);
    const photos = this.reviewPhotos().map(p => p.file);

    this.reviewService
      .createReview(product.productId, {
        rating: this.reviewRating(),
        comment: this.reviewComment().trim() || undefined
      })
      .subscribe({
        next: review => {
          this.reviewRating.set(0);
          this.reviewComment.set('');

          if (photos.length === 0) {
            this.isSubmittingReview.set(false);
            this.toast.success('Thanks for your review!');
            this.loadReviews(product.productId);
            return;
          }

          // The review is saved either way; photos are a second request.
          this.reviewService.uploadPhotos(product.productId, review.reviewId, photos).subscribe({
            next: () => {
              this.isSubmittingReview.set(false);
              this.clearReviewPhotos();
              this.toast.success('Thanks for your review! Your photos will appear once approved.');
              this.loadReviews(product.productId);
            },
            error: err => {
              this.isSubmittingReview.set(false);
              this.clearReviewPhotos();
              this.toast.error(err?.error?.message || 'Your review was posted, but the photos could not be uploaded.');
              this.loadReviews(product.productId);
            }
          });
        },
        error: err => {
          this.isSubmittingReview.set(false);
          const message = err?.error?.message || 'Could not submit your review. Please try again.';
          this.toast.error(message);
        }
      });
  }

  private loadPhotoEligibility(productId: number): void {
    if (!this.authService.isLoggedIn() || this.authService.isAdmin()) {
      return;
    }

    this.reviewService.getPhotoEligibility(productId).subscribe({
      next: eligibility => {
        if (productId === this.productId) {
          this.photoEligibility.set(eligibility);
        }
      },
      error: () => this.photoEligibility.set(null)
    });
  }

  private clearReviewPhotos(): void {
    this.reviewPhotos().forEach(p => URL.revokeObjectURL(p.previewUrl));
    this.reviewPhotos.set([]);
  }

  reviewThumbs(review: Review): ThumbPhoto[] {
    return (review.images ?? []).map(photo => ({
      imageUrl: photo.imageUrl,
      pending: photo.status === 'Pending',
      alt: `Photo by ${review.userName}`
    }));
  }

  openPhotoViewer(photos: ThumbPhoto[], index: number, caption = ''): void {
    this.photoViewer.set({ urls: photos.map(p => p.imageUrl), index, caption });
  }

  async deleteReview(review: Review): Promise<void> {
    const product = this.product();
    if (!product) {
      return;
    }

    const confirmed = await this.confirmDialog.confirm('Delete this review?', { danger: true });
    if (!confirmed) {
      return;
    }

    this.reviewService.deleteReview(product.productId, review.reviewId).subscribe({
      next: () => {
        this.toast.success('Review deleted');
        this.loadReviews(product.productId);
      },
      error: () => {
        this.toast.error('Could not delete this review. Please try again.');
      }
    });
  }

  getStars(rating: number): string {
    return getStarsUtil(rating);
  }

  getDiscountPercent(product: Product): number | null {
    return getDiscountPercentUtil(product.price, product.compareAtPrice);
  }

  // "Coupon available" line: the coupon that saves most on this product alone,
  // or failing that the one with the lowest minimum order (shown with it).
  couponOffer(product: Product): string | null {
    const coupons = this.activeCoupons();
    if (coupons.length === 0) {
      return null;
    }

    const saving = (c: PublicCoupon) =>
      c.discountType === 'Percentage' ? (product.price * c.discountValue) / 100 : Math.min(c.discountValue, product.price);
    const label = (c: PublicCoupon) =>
      c.discountType === 'Percentage' ? `${c.discountValue}% off` : `${formatInr(c.discountValue)} off`;

    const eligible = coupons.filter(c => product.price >= c.minimumOrderAmount);
    if (eligible.length > 0) {
      const best = eligible.reduce((a, b) => (saving(b) > saving(a) ? b : a));
      return `Extra ${label(best)} with code ${best.code}`;
    }

    const nearest = coupons.reduce((a, b) => (b.minimumOrderAmount < a.minimumOrderAmount ? b : a));
    return `Extra ${label(nearest)} on orders above ${formatInr(nearest.minimumOrderAmount)} with code ${nearest.code}`;
  }

  private loadRelatedProducts(product: Product): void {
    this.productService.getRelatedProducts(product.productId, RELATED_PRODUCT_LIMIT).subscribe({
      next: related => {
        if (product.productId === this.productId) {
          this.relatedProducts.set(related);
        }
      },
      error: () => {
        // "You may also like" is a nice-to-have; not fatal if it fails to load.
      }
    });
  }

  selectImage(imageUrl: string): void {
    this.selectedImageUrl.set(imageUrl);
  }

  openLightbox(): void {
    if (this.selectedImageUrl()) {
      this.isLightboxOpen.set(true);
    }
  }

  closeLightbox(): void {
    this.isLightboxOpen.set(false);
  }

  get stockLabel(): string {
    const product = this.product();
    return product ? getStockLabel(product.stockQuantity) : '';
  }

  get stockStatus(): string {
    const product = this.product();
    return product ? getStockStatus(product.stockQuantity) : '';
  }

  get isOutOfStock(): boolean {
    return (this.product()?.stockQuantity ?? 0) <= 0;
  }

  decreaseQuantity(): void {
    this.quantity.update(qty => Math.max(1, qty - 1));
  }

  increaseQuantity(): void {
    const max = this.product()?.stockQuantity ?? 1;
    this.quantity.update(qty => Math.min(max, qty + 1));
  }

  // Open to logged-out shoppers too: guest checkout (the cart lives in the browser).
  addToCart(): void {
    const product = this.product();
    if (!product) {
      return;
    }

    const added = this.cartService.addToCart(product, this.quantity());
    const shortfall = CartService.shortfallMessage(product, this.quantity(), added);
    if (added === 0) {
      this.toast.error(shortfall!);
      return;
    }
    if (shortfall) {
      this.toast.error(shortfall);
    } else {
      this.toast.success(`${product.name} added to cart`);
    }
    this.justAdded.set(true);
    setTimeout(() => this.justAdded.set(false), 1100);
  }

  get isWishlisted(): boolean {
    const product = this.product();
    return product !== null && this.wishlistService.isWishlisted(product.productId);
  }

  toggleWishlist(): void {
    const product = this.product();
    if (!product || !this.requireLogin()) {
      return;
    }

    this.wishlistService.toggle(product);
  }

  get canRequestStockAlert(): boolean {
    return this.isOutOfStock && !this.authService.isAdmin();
  }

  private loadStockAlertStatus(product: Product): void {
    if (product.stockQuantity > 0 || !this.authService.isLoggedIn() || this.authService.isAdmin()) {
      return;
    }

    this.stockAlertService.isSubscribed(product.productId).subscribe({
      next: subscribed => {
        if (this.product()?.productId === product.productId) {
          this.stockAlertSubscribed.set(subscribed);
        }
      },
      error: () => this.stockAlertSubscribed.set(false)
    });
  }

  toggleStockAlert(): void {
    const product = this.product();
    if (!product || this.isStockAlertBusy() || !this.requireLogin()) {
      return;
    }

    const subscribing = !this.stockAlertSubscribed();
    const request = subscribing
      ? this.stockAlertService.subscribe(product.productId)
      : this.stockAlertService.unsubscribe(product.productId);

    this.isStockAlertBusy.set(true);
    request.subscribe({
      next: () => {
        this.stockAlertSubscribed.set(subscribing);
        this.isStockAlertBusy.set(false);
        if (subscribing) {
          this.toast.success("We'll email you when it's back in stock");
        } else {
          this.toast.success('Stock alert cancelled');
        }
      },
      error: (err: { error?: { message?: string } }) => {
        this.isStockAlertBusy.set(false);
        this.toast.error(err?.error?.message ?? 'Could not update your stock alert. Please try again.');
      }
    });
  }

  buyNow(): void {
    const product = this.product();
    if (!product) {
      return;
    }

    this.cartService.setBuyNowItem(product, this.quantity());

    // Checkout itself offers log in or guest checkout.
    this.router.navigate(['/checkout']);
  }

  private requireLogin(returnUrl: string = this.router.url): boolean {
    if (this.authService.isLoggedIn()) {
      return true;
    }

    this.router.navigate(['/login'], { queryParams: { returnUrl } });
    return false;
  }
}
