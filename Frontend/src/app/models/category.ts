export interface Category {
  categoryId: number;
  name: string;
  description?: string;
  parentCategoryId?: number;
  isActive: boolean;
}

export interface CategoryRequest {
  name: string;
  description?: string;
  parentCategoryId?: number | null;
  isActive: boolean;
}

// GET /api/categories/tiles - counts are active products only.
export interface CategoryTileStats {
  categoryId: number;
  // Category plus all its sub-categories (same rule as the products page filter).
  productCount: number;
  imageUrl: string | null;
  // Products directly in this category only.
  directProductCount: number;
  directImageUrl: string | null;
}
