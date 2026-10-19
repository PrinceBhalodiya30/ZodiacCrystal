import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Coupon,
  CouponValidationResult,
  CreateCouponRequest,
  PublicCoupon,
  UpdateCouponRequest,
  ValidateCouponRequest
} from '../models/coupon';
import { PagedResult } from '../models/paged-result';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class CouponService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/Coupons`;

  // status: 'active' | 'scheduled' | 'expired' | 'usedup' | 'inactive' ('' = any).
  getCoupons(pageNumber: number, pageSize: number, search?: string, status = ''): Observable<PagedResult<Coupon>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    if (search) {
      params = params.set('search', search);
    }
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<PagedResult<Coupon>>(`${this.baseUrl}/paged`, { params });
  }

  getCoupon(id: number): Observable<Coupon> {
    return this.http.get<Coupon>(`${this.baseUrl}/${id}`);
  }

  createCoupon(coupon: CreateCouponRequest): Observable<Coupon> {
    return this.http.post<Coupon>(this.baseUrl, coupon);
  }

  updateCoupon(id: number, coupon: UpdateCouponRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, coupon);
  }

  deleteCoupon(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // Announces the coupon in every customer's notification bell (no email).
  notifyCustomers(id: number): Observable<{ recipients: number; notifiedAt: string }> {
    return this.http.post<{ recipients: number; notifiedAt: string }>(`${this.baseUrl}/${id}/notify`, {});
  }

  validateCoupon(request: ValidateCouponRequest): Observable<CouponValidationResult> {
    return this.http.post<CouponValidationResult>(`${this.baseUrl}/validate`, request);
  }

  getActiveCoupons(): Observable<PublicCoupon[]> {
    return this.http.get<PublicCoupon[]>(`${this.baseUrl}/active`);
  }

  exportCouponsCsv(search?: string, status = ''): Observable<Blob> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get(`${this.baseUrl}/export`, { params, responseType: 'blob' });
  }
}
