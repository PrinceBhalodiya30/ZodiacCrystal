import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ZodiacService } from '../../services/zodiac.service';
import { ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { Zodiac } from '../../models/zodiac';
import { Product } from '../../models/product';
import { Category, CategoryTileStats } from '../../models/category';
import { StoreSettingsService } from '../../services/store-settings.service';
import { ZodiacCard } from '../../components/zodiac-card/zodiac-card';
import { ProductCard } from '../../components/product-card/product-card';
import { ProductCardSkeleton } from '../../components/product-card-skeleton/product-card-skeleton';
import { RecentlyViewed } from '../../components/recently-viewed/recently-viewed';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { HERO_IMAGE_URL } from '../../utils/hero-image.util';
import { ScrollRevealDirective } from '../../directives/scroll-reveal.directive';
import { GUIDES } from '../../data/guides.data';
import { Guide } from '../../models/guide';
import { SITE_NAME } from '../../services/page-title.service';

import { QuizService } from '../../services/quiz.service';
import { CleansingGuideService, CleansingGuideTab } from '../../services/cleansing-guide.service';

import { BirthdaySignFinder } from '../../components/birthday-sign-finder/birthday-sign-finder';

const FEATURED_PRODUCT_LIMIT = 8;
const CATEGORY_TILE_LIMIT = 8;

export interface CarouselTab {
  label: string;
  shortLabel: string;
}

// One picture tile in "Shop by Category"; the picture is borrowed from a
// product in that category since categories don't have their own images.
export interface CategoryTile {
  category: Category;
  imageUrl: string | null;
  productCount: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ZodiacCard, ProductCard, ProductCardSkeleton, RecentlyViewed, ImgFallbackDirective, ScrollRevealDirective, BirthdaySignFinder],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, OnDestroy {
  readonly siteName = SITE_NAME;
  private zodiacService = inject(ZodiacService);
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private storeSettings = inject(StoreSettingsService);
  readonly heroEyebrow = computed(() => this.storeSettings.heroEyebrow());
  readonly heroTitle = computed(() => this.storeSettings.heroTitle());
  readonly heroSubtitle = computed(() => this.storeSettings.heroSubtitle());
  quizService = inject(QuizService);
  private cleansingGuideService = inject(CleansingGuideService);

  // Hero Carousel State (Energy Muse Pattern)
  readonly totalSlides = 4;
  activeSlide = signal(0);
  isPaused = signal(false);
  private timerId: ReturnType<typeof setInterval> | null = null;
  private touchStartX = 0;
  private touchEndX = 0;

  readonly carouselTabs: CarouselTab[] = [
    { label: 'Slide 1: Cosmic Zodiac & Planetary Alignment', shortLabel: 'Cosmic Zodiac' },
    { label: 'Slide 2: Sacred Intention Collection', shortLabel: 'Sacred Intentions' },
    { label: 'Slide 3: Intuitive 60-Second Crystal Quiz', shortLabel: 'Crystal Quiz' },
    { label: 'Slide 4: Celestial Mystery Box & Rituals', shortLabel: 'Mystery & Rituals' }
  ];

  openQuiz(): void {
    this.quizService.open();
  }

  openCleansingGuide(tab: CleansingGuideTab = 'cleansing'): void {
    this.cleansingGuideService.open(tab);
  }

  goToSlide(index: number): void {
    this.activeSlide.set((index + this.totalSlides) % this.totalSlides);
    this.startAutoplay();
  }

  nextSlide(): void {
    this.activeSlide.update(curr => (curr + 1) % this.totalSlides);
  }

  prevSlide(): void {
    this.activeSlide.update(curr => (curr - 1 + this.totalSlides) % this.totalSlides);
  }

  pauseCarousel(): void {
    this.isPaused.set(true);
  }

  resumeCarousel(): void {
    this.isPaused.set(false);
  }

  startAutoplay(): void {
    this.stopAutoplay();
    this.timerId = setInterval(() => {
      if (!this.isPaused()) {
        this.nextSlide();
      }
    }, 6500);
  }

  stopAutoplay(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  onTouchStart(e: TouchEvent): void {
    if (e.changedTouches && e.changedTouches[0]) {
      this.touchStartX = e.changedTouches[0].clientX;
      this.pauseCarousel();
    }
  }

  onTouchEnd(e: TouchEvent): void {
    if (e.changedTouches && e.changedTouches[0]) {
      this.touchEndX = e.changedTouches[0].clientX;
      this.handleSwipe();
      this.resumeCarousel();
    }
  }

  private handleSwipe(): void {
    const diff = this.touchStartX - this.touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        this.nextSlide();
      } else {
        this.prevSlide();
      }
    }
  }

  guides = signal<Guide[]>(GUIDES.slice(0, 3));
  zodiacSigns = signal<Zodiac[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  featuredProducts = signal<Product[]>([]);
  productsLoading = signal(true);
  productsError = signal('');

  categories = signal<Category[]>([]);
  private tileStats = signal<CategoryTileStats[]>([]);
  categoriesLoading = signal(true);
  categoriesError = signal('');

  // The categories with the most products, so the tiles show the main ones;
  // the rest are a click away via "View all categories". Counts are products
  // directly in the category (active only), worked out on the server.
  categoryTiles = computed<CategoryTile[]>(() => {
    const statsById = new Map(this.tileStats().map(s => [s.categoryId, s]));
    return this.categories()
      .map(category => {
        const stats = statsById.get(category.categoryId);
        return {
          category,
          imageUrl: stats?.directImageUrl ?? null,
          productCount: stats?.directProductCount ?? 0
        };
      })
      .filter(tile => tile.productCount > 0)
      .sort((a, b) => b.productCount - a.productCount)
      .slice(0, CATEGORY_TILE_LIMIT);
  });
  heroImageUrl = signal<string | null>(HERO_IMAGE_URL);

  ngOnInit(): void {
    this.loadZodiacSigns();
    this.loadFeaturedProducts();
    this.loadCategories();
    this.startAutoplay();
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
  }

  loadFeaturedProducts(): void {
    this.productsLoading.set(true);
    this.productsError.set('');

    // Newest active products, one small page instead of the whole catalogue.
    this.productService
      .getProductsPaged(1, FEATURED_PRODUCT_LIMIT, undefined, null, true, null, null, null, false, 'newest')
      .subscribe({
        next: result => {
          this.featuredProducts.set(result.items);
          this.productsLoading.set(false);
        },
        error: () => {
          this.productsError.set("Couldn't load featured crystals.");
          this.productsLoading.set(false);
        }
      });
  }

  loadCategories(): void {
    this.categoriesLoading.set(true);
    this.categoriesError.set('');

    this.categoryService.getCategories().subscribe({
      next: categories => {
        this.categories.set(categories.filter(c => c.isActive));
        this.categoryService.getCategoryTiles().subscribe({
          next: stats => {
            this.tileStats.set(stats);
            this.categoriesLoading.set(false);
          },
          error: () => {
            this.categoriesError.set("Couldn't load categories.");
            this.categoriesLoading.set(false);
          }
        });
      },
      error: () => {
        this.categoriesError.set("Couldn't load categories.");
        this.categoriesLoading.set(false);
      }
    });
  }

  loadZodiacSigns(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.zodiacService.getZodiacSigns().subscribe({
      next: signs => {
        this.zodiacSigns.set(signs);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load zodiac signs.');
        this.isLoading.set(false);
      }
    });
  }
}
