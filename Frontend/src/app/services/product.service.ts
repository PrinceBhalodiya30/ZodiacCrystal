import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, ProductRequest } from '../models/product';
import { PagedResult } from '../models/paged-result';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/Products`;

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.baseUrl);
  }

  getProductsPaged(
    pageNumber: number,
    pageSize: number,
    search?: string,
    categoryId?: number | null,
    activeOnly = false,
    minPrice?: number | null,
    maxPrice?: number | null,
    zodiacId?: number | null,
    inStockOnly = false,
    sortBy?: string | null,
    lowStockOnly = false
  ): Observable<PagedResult<Product>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize)
      .set('activeOnly', activeOnly)
      .set('inStockOnly', inStockOnly);

    if (lowStockOnly) {
      params = params.set('lowStockOnly', true);
    }

    if (search) {
      params = params.set('search', search);
    }

    if (categoryId !== null && categoryId !== undefined) {
      params = params.set('categoryId', categoryId);
    }

    if (minPrice !== null && minPrice !== undefined) {
      params = params.set('minPrice', minPrice);
    }

    if (maxPrice !== null && maxPrice !== undefined) {
      params = params.set('maxPrice', maxPrice);
    }

    if (zodiacId !== null && zodiacId !== undefined) {
      params = params.set('zodiacId', zodiacId);
    }

    if (sortBy) {
      params = params.set('sortBy', sortBy);
    }

    return this.http.get<PagedResult<Product>>(`${this.baseUrl}/paged`, { params });
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  getRelatedProducts(id: number, limit = 6): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/${id}/related`, {
      params: new HttpParams().set('limit', limit)
    });
  }

  // Adds to the current stock server-side (no full product update needed).
  addStock(productId: number, quantity: number): Observable<{ stockQuantity: number }> {
    return this.http.post<{ stockQuantity: number }>(`${this.baseUrl}/${productId}/add-stock`, { quantity });
  }

  // Signed change applied to the live stock, so orders placed meanwhile aren't overwritten.
  adjustStock(productId: number, delta: number): Observable<{ stockQuantity: number }> {
    return this.http.post<{ stockQuantity: number }>(`${this.baseUrl}/${productId}/adjust-stock`, { delta });
  }

  createProduct(product: ProductRequest): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, product);
  }

  updateProduct(id: number, product: ProductRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, product);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // Admin Products / Product Images lists: same filters for the list and its export.
  getProductsAdminPaged(pageNumber: number, pageSize: number, filters: AdminProductFilters): Observable<PagedResult<Product>> {
    const params = adminProductParams(filters).set('pageNumber', pageNumber).set('pageSize', pageSize);
    return this.http.get<PagedResult<Product>>(`${this.baseUrl}/paged`, { params });
  }

  exportProductsCsv(filters: AdminProductFilters = {}): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export`, { params: adminProductParams(filters), responseType: 'blob' });
  }

  // Preview (nothing saved) or apply one bulk change. productIds = ticked rows;
  // null = every product matching filters.
  bulkUpdate(request: BulkUpdateRequest): Observable<BulkUpdateResult> {
    return this.http.post<BulkUpdateResult>(`${this.baseUrl}/bulk-update`, request);
  }

  exportStockCsv(search?: string, lowStockOnly = false): Observable<Blob> {
    let params = new HttpParams();

    if (search) {
      params = params.set('search', search);
    }

    if (lowStockOnly) {
      params = params.set('lowStockOnly', true);
    }

    return this.http.get(`${this.baseUrl}/export-stock`, { params, responseType: 'blob' });
  }
}

export type BulkAction =
  | 'setPrice' | 'increasePercent' | 'decreasePercent' | 'increaseAmount' | 'decreaseAmount'
  | 'startSale' | 'endSale' | 'activate' | 'deactivate' | 'setCategory';

export interface BulkUpdateRequest {
  productIds: number[] | null;
  filter?: { search?: string; categoryId?: number | null; status?: string; stock?: string };
  action: BulkAction;
  value?: number | null;
  rounding?: 'none' | 'whole' | '99';
  categoryId?: number | null;
  preview: boolean;
}

export interface BulkUpdateRow {
  productId: number;
  sku: string;
  name: string;
  oldPrice: number;
  newPrice: number;
  oldCompareAtPrice: number | null;
  newCompareAtPrice: number | null;
  oldIsActive: boolean;
  newIsActive: boolean;
  oldCategory: string;
  newCategory: string;
  changed: boolean;
  skipReason: string | null;
}

export interface BulkUpdateResult {
  applied: boolean;
  changedCount: number;
  skippedCount: number;
  unchangedCount: number;
  rows: BulkUpdateRow[];
}

export interface AdminProductFilters {
  search?: string;
  categoryId?: number | null;
  status?: 'active' | 'inactive' | '';
  stock?: 'in' | 'low' | 'out' | '';
  missingImagesOnly?: boolean;
}

function adminProductParams(filters: AdminProductFilters): HttpParams {
  let params = new HttpParams();
  if (filters.search) {
    params = params.set('search', filters.search);
  }
  if (filters.categoryId) {
    params = params.set('categoryId', filters.categoryId);
  }
  if (filters.status) {
    params = params.set('status', filters.status);
  }
  if (filters.stock) {
    params = params.set('stock', filters.stock);
  }
  if (filters.missingImagesOnly) {
    params = params.set('missingImagesOnly', true);
  }
  return params;
}
