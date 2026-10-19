import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateMysteryBoxOrderRequest, MysteryBoxInfo } from '../models/mystery-box';
import { Order } from '../models/order';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class MysteryBoxService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/mysterybox`;

  getInfo(): Observable<MysteryBoxInfo> {
    return this.http.get<MysteryBoxInfo>(this.baseUrl);
  }

  purchase(request: CreateMysteryBoxOrderRequest): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/purchase`, request);
  }
}
