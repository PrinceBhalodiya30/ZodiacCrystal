import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateReturnRequest, ReturnRequest } from '../models/return-request';
import { PagedResult } from '../models/paged-result';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class ReturnService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/Returns`;
  private adminBaseUrl = `${API_BASE_URL}/Admin/Returns`;

  // Customer
  requestReturn(request: CreateReturnRequest): Observable<ReturnRequest> {
    return this.http.post<ReturnRequest>(this.baseUrl, request);
  }

  // Admin
  getReturnsAdmin(status?: string): Observable<ReturnRequest[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<ReturnRequest[]>(this.adminBaseUrl, { params });
  }

  // The admin Returns page; getReturnsAdmin() above stays for the dashboard and nav badge.
  // search: order number, customer name or email.
  getReturnsAdminPaged(pageNumber: number, pageSize: number, status?: string, search?: string): Observable<PagedResult<ReturnRequest>> {
    let params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);
    if (status) {
      params = params.set('status', status);
    }
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<PagedResult<ReturnRequest>>(`${this.adminBaseUrl}/paged`, { params });
  }

  approve(id: number, adminNote?: string): Observable<ReturnRequest> {
    return this.http.put<ReturnRequest>(`${this.adminBaseUrl}/${id}/approve`, { adminNote });
  }

  reject(id: number, adminNote?: string): Observable<ReturnRequest> {
    return this.http.put<ReturnRequest>(`${this.adminBaseUrl}/${id}/reject`, { adminNote });
  }

  refund(id: number, restock: boolean, adminNote?: string): Observable<ReturnRequest> {
    return this.http.put<ReturnRequest>(`${this.adminBaseUrl}/${id}/refund`, { restock, adminNote });
  }

  exportReturnsCsv(status?: string, search?: string): Observable<Blob> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get(`${this.adminBaseUrl}/export`, { params, responseType: 'blob' });
  }
}
