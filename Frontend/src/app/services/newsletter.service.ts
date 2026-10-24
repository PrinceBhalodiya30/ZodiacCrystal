import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NewsletterStats, NewsletterStatusFilter, NewsletterSubscriber } from '../models/newsletter-subscriber';
import { PagedResult } from '../models/paged-result';
import { API_BASE_URL } from './api-config';

export interface SubscribeResponse {
  message: string;
  couponCode?: string;
  discount?: string;
}

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/newsletter`;
  private adminBaseUrl = `${API_BASE_URL}/Admin/Newsletter-Subscribers`;

  subscribe(email: string, website?: string): Observable<SubscribeResponse> {
    return this.http.post<SubscribeResponse>(`${this.baseUrl}/subscribe`, { email, website });
  }

  // From the token in a subscriber's unsubscribe link.
  unsubscribe(token: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/unsubscribe`, { token });
  }

  getSubscribersAdminPaged(
    pageNumber: number,
    pageSize: number,
    search?: string,
    status: NewsletterStatusFilter = 'all'
  ): Observable<PagedResult<NewsletterSubscriber>> {
    let params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize).set('status', status);

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<PagedResult<NewsletterSubscriber>>(`${this.adminBaseUrl}/paged`, { params });
  }

  getStatsAdmin(): Observable<NewsletterStats> {
    return this.http.get<NewsletterStats>(`${this.adminBaseUrl}/stats`);
  }

  unsubscribeAdmin(id: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.adminBaseUrl}/${id}/unsubscribe`, {});
  }

  exportSubscribersCsv(search?: string, status: NewsletterStatusFilter = 'active'): Observable<Blob> {
    let params = new HttpParams().set('status', status);
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get(`${this.adminBaseUrl}/export`, { params, responseType: 'blob' });
  }
}
