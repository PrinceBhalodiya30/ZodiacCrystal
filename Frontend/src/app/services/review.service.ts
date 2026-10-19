import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateReviewRequest, PhotoEligibility, ProductReviews, Review, ReviewPhoto } from '../models/review';
import { AdminReview, ReviewPhotoFilter, ReviewPhotoStatus, ReviewStatus } from '../models/admin-review';
import { PagedResult } from '../models/paged-result';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/products`;
  private adminBaseUrl = `${API_BASE_URL}/Admin/Reviews`;

  getReviews(productId: number): Observable<ProductReviews> {
    return this.http.get<ProductReviews>(`${this.baseUrl}/${productId}/reviews`);
  }

  getReviewsAdminPaged(
    pageNumber: number,
    pageSize: number,
    search?: string,
    minRating?: number | null,
    status?: ReviewStatus | null,
    photos?: ReviewPhotoFilter
  ): Observable<PagedResult<AdminReview>> {
    const params = this.adminFilterParams(search, minRating, status, photos)
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    return this.http.get<PagedResult<AdminReview>>(`${this.adminBaseUrl}/paged`, { params });
  }

  // Same filters as the list, so the file matches what the admin is looking at.
  exportReviewsCsv(
    search?: string,
    minRating?: number | null,
    status?: ReviewStatus | null,
    photos?: ReviewPhotoFilter
  ): Observable<Blob> {
    const params = this.adminFilterParams(search, minRating, status, photos);
    return this.http.get(`${this.adminBaseUrl}/export`, { params, responseType: 'blob' });
  }

  updatePhotoStatus(reviewImageId: number, status: Exclude<ReviewPhotoStatus, 'Pending'>): Observable<void> {
    return this.http.put<void>(`${this.adminBaseUrl}/images/${reviewImageId}/status`, { status });
  }

  getPhotoEligibility(productId: number): Observable<PhotoEligibility> {
    return this.http.get<PhotoEligibility>(`${this.baseUrl}/${productId}/reviews/photo-eligibility`);
  }

  uploadPhotos(productId: number, reviewId: number, files: File[]): Observable<ReviewPhoto[]> {
    const form = new FormData();
    files.forEach(file => form.append('files', file, file.name));
    return this.http.post<ReviewPhoto[]>(`${this.baseUrl}/${productId}/reviews/${reviewId}/images`, form);
  }

  private adminFilterParams(
    search?: string,
    minRating?: number | null,
    status?: ReviewStatus | null,
    photos?: ReviewPhotoFilter
  ): HttpParams {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    if (minRating !== null && minRating !== undefined) {
      params = params.set('minRating', minRating);
    }
    if (status) {
      params = params.set('status', status);
    }
    if (photos) {
      params = params.set('photos', photos);
    }
    return params;
  }

  createReview(productId: number, request: CreateReviewRequest): Observable<Review> {
    return this.http.post<Review>(`${this.baseUrl}/${productId}/reviews`, request);
  }

  deleteReview(productId: number, reviewId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${productId}/reviews/${reviewId}`);
  }

  deleteReviewAdmin(reviewId: number): Observable<void> {
    return this.http.delete<void>(`${this.adminBaseUrl}/${reviewId}`);
  }

  updateStatus(reviewId: number, status: ReviewStatus): Observable<void> {
    return this.http.put<void>(`${this.adminBaseUrl}/${reviewId}/status`, { status });
  }

  bulkUpdateStatus(reviewIds: number[], status: ReviewStatus): Observable<void> {
    return this.http.post<void>(`${this.adminBaseUrl}/bulk-status`, { reviewIds, status });
  }

  updateReply(reviewId: number, reply: string): Observable<void> {
    return this.http.put<void>(`${this.adminBaseUrl}/${reviewId}/reply`, { reply });
  }
}
