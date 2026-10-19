import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminUser } from '../models/user';
import { AuthResponse } from '../models/auth';
import { PagedResult } from '../models/paged-result';
import { API_BASE_URL } from './api-config';

export interface UpdateProfileRequest {
  name: string;
}

export interface EmailChangeCodeResponse {
  message: string;
  newEmail: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/Admin/Users`;
  private meBaseUrl = `${API_BASE_URL}/Users/me`;

  getAllUsersAdmin(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(this.baseUrl);
  }

  // role: 'Admin' | 'User'; status: 'active' | 'inactive' ('' = any).
  getUsersAdminPaged(pageNumber: number, pageSize: number, search?: string, role = '', status = ''): Observable<PagedResult<AdminUser>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    if (search) {
      params = params.set('search', search);
    }
    if (role) {
      params = params.set('role', role);
    }
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<PagedResult<AdminUser>>(`${this.baseUrl}/paged`, { params });
  }

  updateUserStatus(id: number, isActive: boolean): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/status`, { isActive });
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  updateProfile(request: UpdateProfileRequest): Observable<AuthResponse> {
    return this.http.put<AuthResponse>(this.meBaseUrl, request);
  }

  // Step 1 of an email change: checks the password and emails a code to the new address.
  requestEmailChange(newEmail: string, currentPassword: string): Observable<EmailChangeCodeResponse> {
    return this.http.post<EmailChangeCodeResponse>(`${this.meBaseUrl}/email`, { newEmail, currentPassword });
  }

  // Step 2: the code from the new inbox. Returns a fresh session carrying the new email.
  verifyEmailChange(otp: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.meBaseUrl}/email/verify`, { otp });
  }

  // Signs out every other device; returns a fresh session for this one.
  changePassword(request: ChangePasswordRequest): Observable<AuthResponse> {
    return this.http.put<AuthResponse>(`${this.meBaseUrl}/password`, request);
  }

  // Customer self-service deletion; the password confirms it's the owner.
  deleteMyAccount(password: string): Observable<void> {
    return this.http.delete<void>(this.meBaseUrl, { body: { password } });
  }

  exportUsersCsv(search?: string, role = '', status = ''): Observable<Blob> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    if (role) {
      params = params.set('role', role);
    }
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get(`${this.baseUrl}/export`, { params, responseType: 'blob' });
  }
}
