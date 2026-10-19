import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from './api-config';

// "Email me when it's back" requests for out-of-stock products. The backend
// sends the email (and a bell notification) once, then drops the request.
@Injectable({ providedIn: 'root' })
export class StockAlertService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/StockAlerts`;

  isSubscribed(productId: number): Observable<boolean> {
    return this.http.get<{ subscribed: boolean }>(`${this.baseUrl}/${productId}`).pipe(map(r => r.subscribed));
  }

  subscribe(productId: number): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${productId}`, {});
  }

  unsubscribe(productId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${productId}`);
  }
}
