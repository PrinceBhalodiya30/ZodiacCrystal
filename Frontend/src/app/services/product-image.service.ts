import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProductImage } from '../models/product-image';
import { API_BASE_URL } from './api-config';

export interface ProductImageRequest {
  productId: number;
  imageUrl: string;
  isPrimary: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductImageService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/ProductImages`;

  getImages(): Observable<ProductImage[]> {
    return this.http.get<ProductImage[]>(this.baseUrl);
  }

  getImage(id: number): Observable<ProductImage> {
    return this.http.get<ProductImage>(`${this.baseUrl}/${id}`);
  }

  createImage(request: ProductImageRequest): Observable<ProductImage> {
    return this.http.post<ProductImage>(this.baseUrl, request);
  }

  uploadImage(productId: number, file: File, isPrimary: boolean): Observable<ProductImage> {
    const formData = new FormData();
    formData.append('productId', String(productId));
    formData.append('isPrimary', String(isPrimary));
    formData.append('file', file);

    return this.http.post<ProductImage>(`${this.baseUrl}/upload`, formData);
  }

  updateImage(id: number, request: ProductImageRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, request);
  }

  setPrimary(id: number): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/set-primary`, {});
  }

  deleteImage(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
