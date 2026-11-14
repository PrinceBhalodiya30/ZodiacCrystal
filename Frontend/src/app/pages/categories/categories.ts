import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryService } from '../../services/category.service';
import { StoreSettingsService } from '../../services/store-settings.service';
import { Category, CategoryTileStats } from '../../models/category';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

interface CategoryTile {
  categoryId: number;
  name: string;
  description?: string;
  imageUrl: string | null;
  productCount: number;
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

  readonly categoryTiles = signal<CategoryTile[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.loadCategories();
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
        this.categoryTiles.set(this.buildTiles(categories, stats));
        this.isLoading.set(false);
      },
      error: () => {
        // Categories loaded fine; just show them without product counts/images.
        this.categoryTiles.set(this.buildTiles(categories, []));
        this.isLoading.set(false);
      }
    });
  }

  private buildTiles(categories: Category[], stats: CategoryTileStats[]): CategoryTile[] {
    const idSet = new Set(categories.map(category => category.categoryId));
    const roots = categories.filter(
      category => !category.parentCategoryId || !idSet.has(category.parentCategoryId)
    );
    const statsById = new Map(stats.map(s => [s.categoryId, s]));

    // Counts/images come from the server and cover the category plus all its
    // sub-categories (any depth), active products only - same rule the
    // products page uses when this card is clicked, so the counts match.
    return roots.map(root => {
      const rootStats = statsById.get(root.categoryId);
      const customImg = this.storeSettings.getCategoryImage(root.categoryId);
      return {
        categoryId: root.categoryId,
        name: root.name,
        description: root.description,
        imageUrl: customImg || rootStats?.imageUrl || null,
        productCount: rootStats?.productCount ?? 0
      };
    });
  }
}