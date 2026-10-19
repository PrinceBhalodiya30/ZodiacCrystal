import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import {
  AuthResponse,
  LoginRequest,
  RegisterOtpResponse,
  RegisterRequest,
  VerifyRegistrationRequest
} from '../models/auth';
import { AuthUser } from '../models/user';
import { API_BASE_URL } from './api-config';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/Auth`;

  currentUser = signal<AuthUser | null>(this.loadValidSession());

  // Fires when the stored token runs out while the app is open. Only HttpClient
  // calls pass through the interceptor's 401 handling - SignalR's own requests
  // don't - so without this an expired session lingered as "logged in".
  readonly sessionExpired = new Subject<void>();
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.scheduleExpiry();
  }

  // "Remember me" decides which storage the session lives in: localStorage
  // survives closing the browser, sessionStorage clears when the tab/browser
  // closes. Defaults to remembered (localStorage) to match prior behavior
  // for register and any caller that doesn't pass it explicitly.
  login(credentials: LoginRequest, rememberMe = true): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, credentials)
      .pipe(tap(response => this.setSession(response, rememberMe)));
  }

  // Step 1: emails a verification code - no account exists yet. Calling it
  // again (after the cooldown) resends a fresh code.
  register(data: RegisterRequest): Observable<RegisterOtpResponse> {
    return this.http.post<RegisterOtpResponse>(`${this.baseUrl}/register`, data);
  }

  // Step 2: confirms the code; the backend creates the account and signs in.
  verifyRegistration(data: VerifyRegistrationRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/register/verify`, data)
      .pipe(tap(response => this.setSession(response, true)));
  }

  // Forgot password, step 1: always succeeds with the same message, whether or
  // not the email has an account.
  forgotPassword(email: string): Observable<{ message: string; resendAfterSeconds: number }> {
    return this.http.post<{ message: string; resendAfterSeconds: number }>(`${this.baseUrl}/forgot-password`, { email });
  }

  // Step 2: code from the email + the new password.
  resetPassword(email: string, code: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/reset-password`, { email, code, newPassword });
  }

  // "This wasn't me" link from the email-changed notice: restores the old
  // address and signs everyone out. Returns the restored email.
  revertEmailChange(token: string): Observable<{ message: string; email: string }> {
    return this.http.post<{ message: string; email: string }>(`${this.baseUrl}/revert-email-change`, { token });
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    this.scheduleExpiry();
  }

  isSessionExpired(): boolean {
    const token = this.getToken();
    return !token || this.isTokenExpired(token);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'Admin';
  }

  // Public so callers that update the user's own name/email/role can refresh
  // the cached session with the fresh token the backend issues for that change.
  setSession(response: AuthResponse, rememberMe = true): void {
    const user: AuthUser = {
      userId: response.userId,
      name: response.name,
      email: response.email,
      role: response.role === 'Admin' ? 'Admin' : 'User',
      createdAt: response.createdAt
    };

    // Whichever storage is chosen, clear the other so a stale token can't
    // linger there and shadow the fresh one on the next page load.
    const store = rememberMe ? localStorage : sessionStorage;
    const other = rememberMe ? sessionStorage : localStorage;

    other.removeItem(TOKEN_KEY);
    other.removeItem(USER_KEY);
    store.setItem(TOKEN_KEY, response.token);
    store.setItem(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
    this.scheduleExpiry();
  }

  // (Re)arms a timer for the current token's exp claim; cleared on logout.
  private scheduleExpiry(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }

    const token = this.getToken();
    const exp = token ? this.readExp(token) : null;
    if (!this.currentUser() || exp === null) {
      return;
    }

    // setTimeout overflows above ~24.8 days; re-check in steps for long tokens.
    const delay = Math.min(exp * 1000 - Date.now(), 2_000_000_000);
    this.expiryTimer = setTimeout(() => {
      if (this.isSessionExpired()) {
        this.logout();
        this.sessionExpired.next();
      } else {
        this.scheduleExpiry();
      }
    }, Math.max(0, delay));
  }

  private readExp(token: string): number | null {
    try {
      const decoded = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof decoded.exp === 'number' ? decoded.exp : null;
    } catch {
      return null;
    }
  }

  // Swaps in a fresh token after the user edits their own details, keeping the
  // session in whichever storage it already lives in (so a "don't remember me"
  // login isn't quietly promoted to a persistent one).
  refreshSession(response: AuthResponse): void {
    this.setSession(response, localStorage.getItem(TOKEN_KEY) !== null);
  }

  private loadValidSession(): AuthUser | null {
    const token = this.getToken();
    const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);

    if (!token || !raw || this.isTokenExpired(token)) {
      // Can't call this.logout() here - this runs during currentUser's own
      // field initializer, before currentUser itself is assigned.
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      return null;
    }

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    const payload = token.split('.')[1];

    if (!payload) {
      return true;
    }

    try {
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      if (typeof decoded.exp !== 'number') {
        return true;
      }
      return decoded.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }
}
