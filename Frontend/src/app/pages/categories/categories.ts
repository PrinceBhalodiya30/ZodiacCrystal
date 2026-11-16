import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CategoryService } from '../../services/category.service';
import { StoreSettingsService } from '../../services/store-settings.service';
import { Category, CategoryTileStats } from '../../models/category';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

export interface CategorySubItem {
  categoryId: number;
  name: string;
}

export interface CategoryTile {
  categoryId: number;
  name: string;
  description?: string;
  imageUrl: string | null;
  productCount: number;
  subCategories?: CategorySubItem[];
  parentName?: string | null;
  isParent: boolean;
}

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [RouterLink, ImgFallbackDirective],
  templateUrl: './categories.html',
  styleUrl: './categories.css'
})
export class Categories implements OnInit {
  private readonly categoryService = inject(CategoryService);
  private readonly storeSettings = inject(StoreSettingsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly activeView = signal<'roots' | 'all'>('roots');
  readonly rootTiles = signal<CategoryTile[]>([]);
  readonly allTiles = signal<CategoryTile[]>([]);

  readonly displayedTiles = computed(() => {
    return this.activeView() === 'roots' ? this.rootTiles() : this.allTiles();
  });

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    const viewParam = this.route.snapshot.queryParamMap.get('view');
    if (viewParam === 'all' || viewParam === 'roots') {
      this.activeView.set(viewParam);
    }
    this.loadCategories();
  }

  setView(view: 'roots' | 'all'): void {
    this.activeView.set(view);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'all' ? 'all' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  loadCategories(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.categoryService.getCategories().subscribe({
      next: categories => this.loadTileStats(categories),
      error: () => {
        this.errorMessage.set('Unable to load categories.');
        this.isLoading.set(false);
      }
    });
  }

  private loadTileStats(categories: Category[]): void {
    this.categoryService.getCategoryTiles().subscribe({
      next: stats => {
        this.populateTiles(categories, stats);
        this.isLoading.set(false);
      },
      error: () => {
        // Categories loaded fine; just show them without product counts/images.
        this.populateTiles(categories, []);
        this.isLoading.set(false);
      }
    });
  }

  private populateTiles(categories: Category[], stats: CategoryTileStats[]): void {
    const activeCats = categories.filter(c => c.isActive);
    const catMap = new Map<number, Category>(activeCats.map(c => [c.categoryId, c]));
    const statsById = new Map<number, CategoryTileStats>(stats.map(s => [s.categoryId, s]));

    // Map active child categories to their parent root
    const childrenByParent = new Map<number, CategorySubItem[]>();
    for (const cat of activeCats) {
      if (cat.parentCategoryId && catMap.has(cat.parentCategoryId)) {
        const list = childrenByParent.get(cat.parentCategoryId) ?? [];
        list.push({ categoryId: cat.categoryId, name: cat.name });
        childrenByParent.set(cat.parentCategoryId, list);
      }
    }

    // 1. Root categories (9 Main Collections)
    const roots = activeCats.filter(
      cat => !cat.parentCategoryId || !catMap.has(cat.parentCategoryId)
    );

    const rootResult: CategoryTile[] = roots.map(root => {
      const rootStats = statsById.get(root.categoryId);
      const customImg = this.storeSettings.getCategoryImage(root.categoryId);
      const subCategories = childrenByParent.get(root.categoryId) ?? [];

      return {
        categoryId: root.categoryId,
        name: root.name,
        description: root.description,
        imageUrl: customImg || rootStats?.imageUrl || null,
        productCount: rootStats?.productCount ?? 0,
        subCategories,
        isParent: true
      };
    });

    // 2. All Categories (all 21 categories)
    const allResult: CategoryTile[] = activeCats.map(cat => {
      const catStats = statsById.get(cat.categoryId);
      const customImg = this.storeSettings.getCategoryImage(cat.categoryId);
      const subCategories = childrenByParent.get(cat.categoryId) ?? [];
      const parentName = cat.parentCategoryId ? catMap.get(cat.parentCategoryId)?.name ?? null : null;

      const productCount = cat.parentCategoryId
        ? (catStats?.directProductCount ?? catStats?.productCount ?? 0)
        : (catStats?.productCount ?? 0);

      const imageUrl = customImg || (cat.parentCategoryId
        ? (catStats?.directImageUrl || catStats?.imageUrl || null)
        : (catStats?.imageUrl || null));

      return {
        categoryId: cat.categoryId,
        name: cat.name,
        description: cat.description,
        imageUrl,
        productCount,
        subCategories: subCategories.length > 0 ? subCategories : undefined,
        parentName,
        isParent: !cat.parentCategoryId || !catMap.has(cat.parentCategoryId)
      };
    });

    this.rootTiles.set(rootResult);
    this.allTiles.set(allResult);
  }

  getMoreSubcategoriesTooltip(subs?: CategorySubItem[]): string {
    if (!subs || subs.length <= 3) {
      return '';
    }
    return subs.slice(3).map(s => s.name).join(', ');
  }
}