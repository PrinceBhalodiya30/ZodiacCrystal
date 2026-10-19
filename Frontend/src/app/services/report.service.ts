import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CategorySales,
  CouponPerformance,
  DailySales,
  OrderInsights,
  ReportOperations,
  ReportSummary,
  TopProduct,
  UnsoldProducts,
  ZodiacSales
} from '../models/report';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/AdminReports`;

  private buildParams(from?: string, to?: string): HttpParams {
    let params = new HttpParams();

    if (from) {
      params = params.set('from', from);
    }

    if (to) {
      params = params.set('to', to);
    }

    return params;
  }

  getSummary(from?: string, to?: string): Observable<ReportSummary> {
    return this.http.get<ReportSummary>(`${this.baseUrl}/summary`, { params: this.buildParams(from, to) });
  }

  getTopProducts(from?: string, to?: string, limit = 10): Observable<TopProduct[]> {
    return this.http.get<TopProduct[]>(`${this.baseUrl}/top-products`, {
      params: this.buildParams(from, to).set('limit', limit)
    });
  }

  getCategorySales(from?: string, to?: string): Observable<CategorySales[]> {
    return this.http.get<CategorySales[]>(`${this.baseUrl}/category-sales`, { params: this.buildParams(from, to) });
  }

  getZodiacSales(from?: string, to?: string): Observable<ZodiacSales[]> {
    return this.http.get<ZodiacSales[]>(`${this.baseUrl}/zodiac-sales`, { params: this.buildParams(from, to) });
  }

  getCouponPerformance(from?: string, to?: string): Observable<CouponPerformance[]> {
    return this.http.get<CouponPerformance[]>(`${this.baseUrl}/coupon-performance`, { params: this.buildParams(from, to) });
  }

  getUnsoldProducts(from?: string, to?: string, limit = 20): Observable<UnsoldProducts> {
    return this.http.get<UnsoldProducts>(`${this.baseUrl}/unsold-products`, {
      params: this.buildParams(from, to).set('limit', limit)
    });
  }

  getDailySales(from?: string, to?: string): Observable<DailySales[]> {
    return this.http.get<DailySales[]>(`${this.baseUrl}/daily-sales`, { params: this.buildParams(from, to) });
  }

  getOrderInsights(from?: string, to?: string): Observable<OrderInsights> {
    return this.http.get<OrderInsights>(`${this.baseUrl}/order-insights`, { params: this.buildParams(from, to) });
  }

  getOperations(from?: string, to?: string): Observable<ReportOperations> {
    return this.http.get<ReportOperations>(`${this.baseUrl}/operations`, { params: this.buildParams(from, to) });
  }

  exportReportsCsv(from?: string, to?: string, rankBy: 'revenue' | 'units' = 'revenue'): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export`, {
      params: this.buildParams(from, to).set('rankBy', rankBy),
      responseType: 'blob'
    });
  }
}
