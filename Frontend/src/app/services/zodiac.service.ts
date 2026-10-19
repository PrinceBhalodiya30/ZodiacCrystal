import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Zodiac, ZodiacRequest } from '../models/zodiac';
import { Product } from '../models/product';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class ZodiacService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/Zodiac`;

  getZodiacSigns(): Observable<Zodiac[]> {
    return this.http.get<Zodiac[]>(this.baseUrl);
  }

  getZodiac(id: number): Observable<Zodiac> {
    return this.http.get<Zodiac>(`${this.baseUrl}/${id}`);
  }

  getProductsByZodiac(id: number): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/${id}/products`);
  }

  createZodiac(zodiac: ZodiacRequest): Observable<Zodiac> {
    return this.http.post<Zodiac>(this.baseUrl, zodiac);
  }

  updateZodiac(id: number, zodiac: ZodiacRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, zodiac);
  }

  deleteZodiac(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
