import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Address, AddressRequest } from '../models/address';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class AddressService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/Addresses`;

  getAddresses(): Observable<Address[]> {
    return this.http.get<Address[]>(this.baseUrl);
  }

  getAddress(id: number): Observable<Address> {
    return this.http.get<Address>(`${this.baseUrl}/${id}`);
  }

  createAddress(request: AddressRequest): Observable<Address> {
    return this.http.post<Address>(this.baseUrl, request);
  }

  updateAddress(id: number, request: AddressRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, request);
  }

  setDefault(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/set-default`, {});
  }

  deleteAddress(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
