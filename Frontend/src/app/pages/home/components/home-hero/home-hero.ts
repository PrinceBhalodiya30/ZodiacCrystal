import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { StoreSettingsService } from '../../../../services/store-settings.service';
import { QuizService } from '../../../../services/quiz.service';
import { ProductService } from '../../../../services/product.service';
import { CartService } from '../../../../services/cart.service';
import { Product } from '../../../../models/product';
import { InrPipe } from '../../../../pipes/inr.pipe';
import { ImgFallbackDirective } from '../../../../directives/img-fallback.directive';
import { SITE_NAME } from '../../../../services/page-title.service';
import { HERO_IMAGE_URL } from '../../../../utils/hero-image.util';
import { getPrimaryImageUrl } from '../../../../utils/product-image.util';
import { getProductSlug } from '../../../../utils/product-slug.util';

@Component({
  selector: 'app-home-hero',
  standalone: true,
  imports: [RouterLink, DecimalPipe, InrPipe, ImgFallbackDirective],
  templateUrl: './home-hero.html',
  styleUrl: './home-hero.css'
})
export class HomeHero implements OnInit, OnDestroy {
  readonly siteName = SITE_NAME;
  private storeSettings = inject(StoreSettingsService);
  private quizService = inject(QuizService);
  private productService = inject(ProductService);
  private cartService = inject(CartService);

  readonly heroEyebrow = computed(() => this.storeSettings.heroEyebrow());
  readonly heroTitle = computed(() => this.storeSettings.heroTitle());
  readonly heroSubtitle = computed(() => this.storeSettings.heroSubtitle());

  // Energy Muse Signature: Shop by Energy Intention Quick-Chips
  readonly intentionChips = [
    { id: 'wealth', label: 'Wealth & Success' },
    { id: 'protection', label: 'Protection & Grounding' },
    { id: 'love', label: 'Love & Harmony' },
    { id: 'peace', label: 'Peace & Calm' }
  ];

  // Centerpiece Live Product (Mejuri-style shoppable hero card)
  featuredProduct = signal<Product | null>(null);
  isLoadingProduct = signal<boolean>(true);
  isAdded = signal<boolean>(false);

  readonly totalSlides = 4;
  activeSlide = signal(0);
  isPaused = signal(false);
  private timerId: ReturnType<typeof setInterval> | null = null;
  private touchStartX = 0;
  private touchEndX = 0;

  ngOnInit(): void {
    this.startCarouselTimer();
    this.loadCenterpieceProduct();
  }

  ngOnDestroy(): void {
    this.stopCarouselTimer();
  }

  heroImageUrl = signal<string | null>(HERO_IMAGE_URL);

  private loadCenterpieceProduct(): void {
    this.isLoadingProduct.set(true);
    // Fetch the top-rated in-stock active product as the atelier centerpiece
    this.productService.getProductsPaged(1, 1, undefined, null, true, null, null, null, true, 'rating').subscribe({
      next: (res) => {
        if (res.items && res.items.length > 0) {
          this.featuredProduct.set(res.items[0]);
        }
        this.isLoadingProduct.set(false);
      },
      error: () => {
        this.isLoadingProduct.set(false);
      }
    });
  }

  getProductImage(product: Product): string | null {
    return getPrimaryImageUrl(product);
  }

  getProductLink(product: Product): string {
    return getProductSlug(product);
  }

  addToBag(product: Product, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (product.stockQuantity <= 0) return;

    const added = this.cartService.addToCart(product, 1);
    if (added > 0) {
      this.isAdded.set(true);
      setTimeout(() => this.isAdded.set(false), 2200);
    }
  }

  openQuiz(): void {
    this.quizService.open();
  }

  pauseCarousel(): void {
    this.isPaused.set(true);
    this.stopCarouselTimer();
  }

  resumeCarousel(): void {
    this.isPaused.set(false);
    this.startCarouselTimer();
  }

  nextSlide(): void {
    this.activeSlide.update(i => (i + 1) % this.totalSlides);
  }

  prevSlide(): void {
    this.activeSlide.update(i => (i - 1 + this.totalSlides) % this.totalSlides);
  }

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.changedTouches[0].screenX;
  }

  onTouchEnd(e: TouchEvent): void {
    this.touchEndX = e.changedTouches[0].screenX;
    const diff = this.touchStartX - this.touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) this.nextSlide();
      else this.prevSlide();
    }
  }

  private startCarouselTimer(): void {
    this.stopCarouselTimer();
    this.timerId = setInterval(() => {
      if (!this.isPaused()) {
        this.nextSlide();
      }
    }, 7000);
  }

  private stopCarouselTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
