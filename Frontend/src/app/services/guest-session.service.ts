import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api-config';

export interface GuestSession {
  token: string;
  email: string;
  name: string;
  // Epoch ms.
  expiresAt: number;
}

export interface GuestStartResponse {
  message: string;
  email: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

interface GuestVerifyResponse {
  token: string;
  email: string;
  name: string;
  expiresInSeconds: number;
}

interface OrderLinkResponse {
  requiresLogin: boolean;
  orderId: number;
  token?: string;
  email?: string;
  name?: string;
  expiresInSeconds?: number;
}

const STORAGE_KEY = 'guest_session';

// Guest checkout session: a short-lived token for a verified email, kept
// apart from AuthService on purpose - a guest is NOT logged in, so the navbar,
// My Account, wishlist etc. all keep treating them as logged out. Only the
// auth interceptor (to send the token) and checkout read it. Stored in
// sessionStorage so it ends with the tab.
@Injectable({ providedIn: 'root' })
export class GuestSessionService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/guest`;

  private session = signal<GuestSession | null>(this.load());

  readonly current = computed(() => {
    const s = this.session();
    return s && s.expiresAt > Date.now() ? s : null;
  });

  start(email: string): Observable<GuestStartResponse> {
    return this.http.post<GuestStartResponse>(`${this.baseUrl}/start`, { email });
  }

  verify(email: string, otp: string, name: string): Observable<GuestVerifyResponse> {
    return this.http
      .post<GuestVerifyResponse>(`${this.baseUrl}/verify`, { email, otp, name })
      .pipe(tap(response => this.adopt(response)));
  }

  // Opens a "View your order" email link. Guest orders start a guest session;
  // requiresLogin means the order now belongs to a registered account.
  openOrderLink(token: string): Observable<OrderLinkResponse> {
    return this.http.post<OrderLinkResponse>(`${this.baseUrl}/order-access`, { token }).pipe(
      tap(response => {
        if (!response.requiresLogin && response.token) {
          this.adopt(response as GuestVerifyResponse);
        }
      })
    );
  }

  // Emails a fresh order link if the order number and email match (never says whether they did).
  findOrder(orderId: number, email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/find-order`, { orderId, email });
  }

  private adopt(response: GuestVerifyResponse): void {
    const session: GuestSession = {
      token: response.token,
      email: response.email,
      name: response.name,
      expiresAt: Date.now() + response.expiresInSeconds * 1000
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage blocked - the session still works for this page load.
    }
    this.session.set(session);
  }

  getToken(): string | null {
    return this.current()?.token ?? null;
  }

  clear(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this.session.set(null);
  }

  private load(): GuestSession | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as GuestSession) : null;
      return parsed && parsed.expiresAt > Date.now() ? parsed : null;
    } catch {
      return null;
    }
  }
}
