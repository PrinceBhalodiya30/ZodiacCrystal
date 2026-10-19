import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category, CategoryRequest, CategoryTileStats } from '../models/category';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/Categories`;

  // Admin only: products directly in each category, keyed by categoryId.
  getProductCounts(): Observable<Record<number, number>> {
    return this.http.get<Record<number, number>>(`${this.baseUrl}/product-counts`);
  }

  // Storefront tiles: per-category active product counts and a picture.
  getCategoryTiles(): Observable<CategoryTileStats[]> {
    return this.http.get<CategoryTileStats[]>(`${this.baseUrl}/tiles`);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.baseUrl);
  }

  getCategory(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.baseUrl}/${id}`);
  }

  createCategory(category: CategoryRequest): Observable<Category> {
    return this.http.post<Category>(this.baseUrl, category);
  }

  updateCategory(id: number, category: CategoryRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, category);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
