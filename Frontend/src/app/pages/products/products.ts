import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { ZodiacService } from '../../services/zodiac.service';
import { Product } from '../../models/product';
import { getProductSlug } from '../../utils/product-slug.util';
import { Category } from '../../models/category';
import { Zodiac } from '../../models/zodiac';
import { ProductCard } from '../../components/product-card/product-card';
import { ProductCardSkeleton } from '../../components/product-card-skeleton/product-card-skeleton';
import { Pager } from '../../components/pager/pager';
import { SACRED_INTENTIONS, SacredIntention, getIntentionById, productMatchesIntention } from '../../utils/crystal-intentions.util';

const PAGE_SIZE = 12;
const SKELETON_ROWS = Array.from({ length: PAGE_SIZE });

import { InrPipe } from '../../pipes/inr.pipe';
import { VedicZodiacPipe } from '../../pipes/vedic-zodiac.pipe';
@Component({
  selector: 'app-products',
  standalone: true,
  imports: [InrPipe, FormsModule, ProductCard, ProductCardSkeleton, Pager, VedicZodiacPipe],
  templateUrl: './products.html',
  styleUrl: './products.css'
})
export class Products implements OnInit {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private zodiacService = inject(ZodiacService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  zodiacs = signal<Zodiac[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  searchTerm = signal('');
  selectedCategoryId = signal<number | null>(null);
  selectedIntentionId = signal<string | null>(null);
  selectedIntention = computed(() => getIntentionById(this.selectedIntentionId()));
  readonly sacredIntentions = SACRED_INTENTIONS;
  private allProductsCache: Product[] | null = null;

  // Sub-category chips under the filters, e.g. Crystals → All · Raw · Tumbled …
  // Shown when the chosen category has sub-categories, or is one (so you can
  // hop to a sibling or back to the whole parent).
  subcategoryChips = computed(() => {
    const all = this.categories();
    const selected = all.find(c => c.categoryId === this.selectedCategoryId());
    if (!selected) {
      return null;
    }

    const childrenOf = (id: number) => all.filter(c => c.parentCategoryId === id);
    const parent = childrenOf(selected.categoryId).length > 0
      ? selected
      : all.find(c => c.categoryId === selected.parentCategoryId);
    if (!parent) {
      return null;
    }

    return { parent, children: childrenOf(parent.categoryId) };
  });
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);
  selectedZodiacId = signal<number | null>(null);
  inStockOnly = signal(false);
  sortBy = signal('');

  page = signal(1);
  totalPages = signal(1);

  readonly skeletonRows = SKELETON_ROWS;

  // Autosuggest dropdown - independent of the main filtered grid, so typing
  // doesn't have to wait for the (unrelated) product-grid request to resolve.
  suggestions = signal<Product[]>([]);
  showSuggestions = signal(false);
  private suggestionInput = new Subject<string>();

  ngOnInit(): void {
    this.suggestionInput
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(term => {
          if (!term.trim()) {
            return of(null);
          }
          return this.productService.getProductsPaged(1, 5, term.trim(), null, true);
        })
      )
      .subscribe({
        next: result => this.suggestions.set(result?.items ?? []),
        error: () => this.suggestions.set([])
      });

    this.categoryService.getCategories().subscribe({
      next: categories => this.categories.set(categories),
      error: () => {
        // Category filter just won't be populated; not fatal.
      }
    });

    this.zodiacService.getZodiacSigns().subscribe({
      next: zodiacs => this.zodiacs.set(zodiacs),
      error: () => {
        // Zodiac filter just won't be populated; not fatal.
      }
    });

    this.route.queryParamMap.subscribe(params => {
      const categoryId = Number(params.get('category'));
      this.selectedCategoryId.set(Number.isFinite(categoryId) && categoryId > 0 ? categoryId : null);

      const intentionParam = params.get('intention');
      const searchParam = params.get('search') || '';

      if (intentionParam) {
        this.selectedIntentionId.set(intentionParam);
      } else if (searchParam) {
        const matched = getIntentionById(searchParam);
        if (matched) {
          this.selectedIntentionId.set(matched.id);
        } else {
          this.selectedIntentionId.set(null);
        }
      } else {
        this.selectedIntentionId.set(null);
      }

      this.searchTerm.set(searchParam);
      this.page.set(1);
      this.loadProducts();
    });
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.page.set(1);
    this.loadProducts();
    this.showSuggestions.set(!!term.trim());
    this.suggestionInput.next(term);
  }

  onSearchFocus(): void {
    this.showSuggestions.set(!!this.searchTerm().trim());
  }

  onSearchBlur(): void {
    // Delay so a click on a suggestion registers before the dropdown unmounts.
    setTimeout(() => this.showSuggestions.set(false), 150);
  }

  selectSuggestion(product: Product): void {
    this.showSuggestions.set(false);
    this.router.navigate(['/products', getProductSlug(product)]);
  }

  onIntentionChange(intentionId: string | null): void {
    if (this.selectedIntentionId() === intentionId) {
      this.selectedIntentionId.set(null);
    } else {
      this.selectedIntentionId.set(intentionId);
    }
    this.page.set(1);
    this.updateQueryParams();
    this.loadProducts();
  }

  private updateQueryParams(): void {
    const qParams: Record<string, string | number | null> = {};
    if (this.selectedIntentionId()) {
      qParams['intention'] = this.selectedIntentionId();
    } else {
      qParams['intention'] = null;
    }
    if (this.selectedCategoryId()) {
      qParams['category'] = this.selectedCategoryId();
    }
    if (this.searchTerm().trim()) {
      qParams['search'] = this.searchTerm().trim();
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: qParams,
      queryParamsHandling: 'merge'
    });
  }

  onCategoryChange(categoryId: number | null): void {
    this.selectedCategoryId.set(categoryId);
    this.page.set(1);
    this.loadProducts();
  }

  onZodiacChange(zodiacId: number | null): void {
    this.selectedZodiacId.set(zodiacId);
    this.page.set(1);
    this.loadProducts();
  }

  onPriceRangeChange(range: string): void {
    if (!range) {
      this.minPrice.set(null);
      this.maxPrice.set(null);
    } else {
      const [min, max] = range.split('-');
      this.minPrice.set(min ? Number(min) : null);
      this.maxPrice.set(max ? Number(max) : null);
    }
    this.page.set(1);
    this.loadProducts();
  }

  onInStockOnlyChange(inStockOnly: boolean): void {
    this.inStockOnly.set(inStockOnly);
    this.page.set(1);
    this.loadProducts();
  }

  onSortChange(sortBy: string): void {
    this.sortBy.set(sortBy);
    this.page.set(1);
    this.loadProducts();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadProducts();
  }

  hasActiveFilters(): boolean {
    return !!(
      this.searchTerm() ||
      this.selectedCategoryId() ||
      this.selectedZodiacId() ||
      this.selectedIntentionId() ||
      this.minPrice() !== null ||
      this.maxPrice() !== null ||
      this.inStockOnly()
    );
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedCategoryId.set(null);
    this.selectedZodiacId.set(null);
    this.selectedIntentionId.set(null);
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.inStockOnly.set(false);
    this.page.set(1);
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const intention = this.selectedIntention();

    if (!intention) {
      this.productService
        .getProductsPaged(
          this.page(),
          PAGE_SIZE,
          this.searchTerm().trim() || undefined,
          this.selectedCategoryId(),
          true,
          this.minPrice(),
          this.maxPrice(),
          this.selectedZodiacId(),
          this.inStockOnly(),
          this.sortBy() || undefined
        )
        .subscribe({
          next: result => {
            this.products.set(result.items);
            this.totalPages.set(result.totalPages || 1);
            this.isLoading.set(false);
          },
          error: () => {
            this.errorMessage.set('Unable to load products.');
            this.isLoading.set(false);
          }
        });
      return;
    }

    const fetchAll$ = this.allProductsCache
      ? of(this.allProductsCache)
      : this.productService.getProducts();

    fetchAll$.subscribe({
      next: allProducts => {
        this.allProductsCache = allProducts;
        let filtered = allProducts.filter(p => p.isActive && productMatchesIntention(p, intention));

        if (this.selectedCategoryId()) {
          filtered = filtered.filter(p => p.categoryId === this.selectedCategoryId());
        }

        if (this.selectedZodiacId()) {
          filtered = filtered.filter(p => p.zodiacs?.some(z => z.zodiacId === this.selectedZodiacId()));
        }

        if (this.inStockOnly()) {
          filtered = filtered.filter(p => p.stockQuantity > 0);
        }

        if (this.minPrice() !== null) {
          filtered = filtered.filter(p => p.price >= this.minPrice()!);
        }
        if (this.maxPrice() !== null) {
          filtered = filtered.filter(p => p.price <= this.maxPrice()!);
        }

        const term = this.searchTerm().trim().toLowerCase();
        if (term) {
          filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(term) ||
            (p.description && p.description.toLowerCase().includes(term))
          );
        }

        const sort = this.sortBy();
        if (sort === 'price_asc') {
          filtered.sort((a, b) => a.price - b.price);
        } else if (sort === 'price_desc') {
          filtered.sort((a, b) => b.price - a.price);
        } else if (sort === 'newest') {
          filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else if (sort === 'rating') {
          filtered.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
        }

        const totalCount = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        this.totalPages.set(totalPages);

        const startIndex = (this.page() - 1) * PAGE_SIZE;
        const pagedItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);
        this.products.set(pagedItems);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load products.');
        this.isLoading.set(false);
      }
    });
  }
}
