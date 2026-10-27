import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, Location } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { PageTitleService, SITE_NAME } from '../../services/page-title.service';
import { SeoService, absoluteUrl } from '../../services/seo.service';
import { SITE_URL } from '../../services/api-config';
import { Product } from '../../models/product';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { getProductSlug, parseProductIdFromSlug } from '../../utils/product-slug.util';
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
import { VedicZodiacPipe } from '../../pipes/vedic-zodiac.pipe';

const RELATED_PRODUCT_LIMIT = 4;

import { InrPipe, formatInr } from '../../pipes/inr.pipe';
import { CompareService } from '../../services/compare.service';
import { FormsModule } from '@angular/forms';
import { CouponService } from '../../services/coupon.service';
import { PublicCoupon } from '../../models/coupon';
import { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING_FEE } from '../../services/cart.service';
import { checkDeliveryPincode, getSavedPincode, savePincode, PincodeDeliveryInfo } from '../../utils/pincode.util';
import { getProductCrystalSpecs, CrystalSpecs } from '../../utils/crystal-specs.util';

export interface BundleItem {
  product: Product;
  selected: boolean;
  isMain: boolean;
  slug: string;
  imageUrl: string | null;
}

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
    PhotoLightbox,
    FormsModule,
    VedicZodiacPipe
  ],
  templateUrl: './product-details.html',
  styleUrl: './product-details.css'
})
export class ProductDetails implements OnInit {
  readonly siteName = SITE_NAME;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
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
  cartQuantity = computed(() => {
    const p = this.product();
    if (!p) {
      return 0;
    }
    const item = this.cartService.items().find(i => i.product.productId === p.productId);
    return item?.quantity ?? 0;
  });
  isLoading = signal(true);
  errorMessage = signal('');
  isLightboxOpen = signal(false);
  isZooming = signal(false);
  zoomTransformOrigin = signal('center center');
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

  // Simulated Pincode Delivery Checker
  pincodeInput = signal('');
  pincodeResult = signal<PincodeDeliveryInfo | null>(null);
  isCheckingPincode = signal(false);
  pincodeError = signal('');

  // Frequently Bought Together Bundle
  bundleItems = signal<BundleItem[]>([]);
  bundleJustAdded = signal(false);

  bundleSelectedItems = computed(() => this.bundleItems().filter(i => i.selected));
  bundleSelectedCount = computed(() => this.bundleSelectedItems().length);
  bundleOriginalTotal = computed(() => this.bundleSelectedItems().reduce((sum, i) => sum + i.product.price, 0));
  bundleSavings = computed(() => {
    const count = this.bundleSelectedCount();
    if (count < 2) return 0;
    return Math.round(this.bundleOriginalTotal() * 0.10); // 10% bundle savings
  });
  bundleFinalPrice = computed(() => this.bundleOriginalTotal() - this.bundleSavings());

  // Crystal Healing & Care Specs Accordion
  crystalSpecs = computed<CrystalSpecs | null>(() => getProductCrystalSpecs(this.product()));
  isHealingOpen = signal(false);
  isCareOpen = signal(false);

  toggleHealingAccordion(): void {
    this.isHealingOpen.update(v => !v);
  }

  toggleCareAccordion(): void {
    this.isCareOpen.update(v => !v);
  }

  ngOnInit(): void {
    const savedPin = getSavedPincode();
    if (savedPin) {
      this.pincodeInput.set(savedPin);
      this.pincodeResult.set(checkDeliveryPincode(savedPin));
    }

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
      this.productId = parseProductIdFromSlug(params.get('id'));
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
    this.isZooming.set(false);
    this.zoomTransformOrigin.set('center center');
    this.photoViewer.set(null);
    this.reviews.set([]);
    this.averageRating.set(0);
    this.reviewCount.set(0);
    this.reviewRating.set(0);
    this.reviewComment.set('');
    this.stockAlertSubscribed.set(false);
    this.photoEligibility.set(null);
    this.clearReviewPhotos();
    this.bundleItems.set([]);
    this.bundleJustAdded.set(false);
  }

  loadProduct(): void {
    const id = this.productId;

    if (isNaN(id) || id <= 0) {
      this.product.set(null);
      this.updateSeo(null, this.pageTitle.setPageTitle('Crystal Not Found'));
      this.isLoading.set(false);
      return;
    }

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
          const canonicalSlug = getProductSlug(activeProduct);
          const currentParam = this.route.snapshot.paramMap.get('id');
          if (canonicalSlug && currentParam !== canonicalSlug) {
            this.location.replaceState(`/products/${canonicalSlug}`);
          }

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
    const canonicalSlug = getProductSlug(product);
    const url = `${SITE_URL}/products/${canonicalSlug}`;

    this.seo.update({
      title: fullTitle,
      description: product.description || `${product.name} healing crystal from ${SITE_NAME}.`,
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
      brand: { '@type': 'Brand', name: SITE_NAME },
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
          if (related.length > 0) {
            this.initBundleItems(product, related);
          } else {
            // Fallback: fetch top catalog products so the bundle pairing always works
            this.productService.getProducts().subscribe({
              next: catalog => {
                if (product.productId === this.productId) {
                  this.initBundleItems(product, catalog);
                }
              }
            });
          }
        }
      },
      error: () => {
        // "You may also like" is a nice-to-have; not fatal if it fails to load.
      }
    });
  }

  private initBundleItems(mainProduct: Product, candidates: Product[]): void {
    if (!mainProduct || mainProduct.stockQuantity <= 0) {
      this.bundleItems.set([]);
      return;
    }

    const complementary = candidates
      .filter(p => p.productId !== mainProduct.productId && p.isActive && p.stockQuantity > 0)
      .slice(0, 2);

    if (complementary.length === 0) {
      this.bundleItems.set([]);
      return;
    }

    const items: BundleItem[] = [
      {
        product: mainProduct,
        selected: true,
        isMain: true,
        slug: getProductSlug(mainProduct),
        imageUrl: getPrimaryImageUrl(mainProduct)
      },
      ...complementary.map(p => ({
        product: p,
        selected: true,
        isMain: false,
        slug: getProductSlug(p),
        imageUrl: getPrimaryImageUrl(p)
      }))
    ];

    this.bundleItems.set(items);
  }

  toggleBundleItem(productId: number): void {
    this.bundleItems.update(items =>
      items.map(item =>
        item.product.productId === productId ? { ...item, selected: !item.selected } : item
      )
    );
  }

  addBundleToCart(): void {
    const selected = this.bundleSelectedItems();
    if (selected.length === 0) return;

    selected.forEach((item, index) => {
      const isLast = index === selected.length - 1;
      this.cartService.addToCart(item.product, 1, isLast);
    });

    this.bundleJustAdded.set(true);
    setTimeout(() => this.bundleJustAdded.set(false), 2500);

    const count = selected.length;
    const savings = this.bundleSavings();
    if (savings > 0) {
      this.toast.success(`Bundle added! Saved ${formatInr(savings, 0)} on ${count} items.`, 5000);
    } else {
      this.toast.success(`Added ${count} item${count > 1 ? 's' : ''} to your bag.`, 5000);
    }
  }

  onImageMouseMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    this.zoomTransformOrigin.set(`${x}% ${y}%`);
    this.isZooming.set(true);
  }

  onImageMouseLeave(): void {
    this.isZooming.set(false);
    this.zoomTransformOrigin.set('center center');
  }

  selectImage(imageUrl: string): void {
    this.selectedImageUrl.set(imageUrl);
  }

  openLightbox(): void {
    const p = this.product();
    if (!p) return;
    const currentUrl = this.selectedImageUrl();
    const urls = p.images && p.images.length > 0
      ? p.images.map(img => img.imageUrl)
      : (currentUrl ? [currentUrl] : []);
    if (!urls.length) return;

    const activeIndex = currentUrl ? urls.indexOf(currentUrl) : 0;
    this.photoViewer.set({
      urls,
      index: activeIndex >= 0 ? activeIndex : 0,
      caption: p.name
    });
    this.isLightboxOpen.set(true);
  }

  closeLightbox(): void {
    const viewer = this.photoViewer();
    if (viewer && viewer.urls[viewer.index]) {
      this.selectedImageUrl.set(viewer.urls[viewer.index]);
    }
    this.photoViewer.set(null);
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

  onPincodeChange(value: string): void {
    const digits = (value || '').replace(/\D/g, '').slice(0, 6);
    this.pincodeInput.set(digits);
    this.pincodeError.set('');
    if (digits.length === 6 && !this.pincodeResult()) {
      this.checkPincode();
    }
  }

  checkPincode(): void {
    const pin = this.pincodeInput().trim();
    if (pin.length !== 6) {
      this.pincodeError.set('Please enter a valid 6-digit Indian postal pincode.');
      return;
    }

    this.isCheckingPincode.set(true);
    this.pincodeError.set('');

    setTimeout(() => {
      const result = checkDeliveryPincode(pin);
      this.isCheckingPincode.set(false);
      if (result) {
        this.pincodeResult.set(result);
        savePincode(pin);
      } else {
        this.pincodeError.set('Invalid pincode. Please check your 6 digits.');
      }
    }, 200);
  }

  resetPincode(): void {
    this.pincodeResult.set(null);
    this.pincodeInput.set('');
    this.pincodeError.set('');
  }

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
    }
    this.justAdded.set(true);
    setTimeout(() => this.justAdded.set(false), 1100);
  }

  compareService = inject(CompareService);

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

  get isCompared(): boolean {
    const product = this.product();
    return product !== null && this.compareService.isCompared(product.productId);
  }

  toggleCompare(): void {
    const product = this.product();
    if (!product) {
      return;
    }

    this.compareService.toggle(product);
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

    // Buy Now is an isolated instant checkout (Amazon/Shopify model).
    this.router.navigate(['/checkout']);
  }

  shareOnWhatsApp(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const product = this.product();
    const productName = product?.name ?? 'Healing Crystal';
    const currentUrl = window.location.href;
    const shareText = `Check out this authentic natural crystal: ${productName} on ${this.siteName} · ${currentUrl}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  async copyProductLink(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }
    const currentUrl = window.location.href;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = currentUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      this.toast.success('Product link copied to clipboard');
    } catch {
      this.toast.info('Link ready to copy: ' + currentUrl);
    }
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
