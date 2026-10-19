import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { API_BASE_URL } from './api-config';

// How it works (same idea as Amazon/Flipkart):
// - Signed in: history lives on the server, so it follows the customer to any
//   device. Views older than 90 days expire there.
// - Guest: history lives in this browser only and expires after 30 days.
// - Signing in merges the guest history into the account and clears it here;
//   signing out leaves nothing behind for the next person on the device.
const GUEST_KEY = 'recently_viewed_guest';
const GUEST_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 6;

// Earlier versions kept one shared list, then a per-user list in the browser.
// The shared one is dropped; a per-user one is uploaded on that user's next sign-in.
const LEGACY_SHARED_KEY = 'recently_viewed_product_ids';
const legacyUserKey = (userId: number) => `recently_viewed_product_ids_${userId}`;
try {
  localStorage.removeItem(LEGACY_SHARED_KEY);
} catch {
  // Storage unavailable - nothing to clean up.
}

interface GuestView {
  id: number;
  at: number;
}

@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private baseUrl = `${API_BASE_URL}/RecentlyViewed`;
  private userId: number | null | undefined = undefined;

  productIds = signal<number[]>([]);

  // Bumped whenever the list is replaced (sign-in/out, server load, clear), so open lists reload.
  changed = signal(0);

  constructor() {
    effect(() => {
      const userId = this.auth.currentUser()?.userId ?? null;
      untracked(() => this.onUserChange(userId));
    });
  }

  private onUserChange(userId: number | null): void {
    if (userId === this.userId) {
      return;
    }

    const previous = this.userId;
    this.userId = userId;

    if (userId === null) {
      // Signed out (or a guest from the start). After a sign-out, start empty.
      if (previous) {
        this.writeGuest([]);
      }
      this.replace(this.readGuest().map(v => v.id));
      return;
    }

    // Signed in: hand over anything browsed as a guest (plus any list an older
    // version saved in this browser), then show the account's history.
    const toMerge = [...new Set([...this.readGuest().map(v => v.id), ...this.takeLegacyUserList(userId)])];
    this.writeGuest([]);

    if (toMerge.length > 0) {
      this.http.post<void>(`${this.baseUrl}/merge`, { productIds: toMerge }).subscribe({
        next: () => this.loadFromServer(),
        error: () => this.loadFromServer()
      });
    } else {
      this.loadFromServer();
    }
  }

  private loadFromServer(): void {
    this.http.get<number[]>(this.baseUrl).subscribe({
      next: ids => {
        // Ignore a late reply after the user has already signed out.
        if (this.userId) {
          this.replace(ids.slice(0, MAX_ITEMS));
        }
      },
      // History is a nice-to-have; on failure the section just stays hidden.
      error: () => this.replace([])
    });
  }

  // Records a view, moving the product to the front if already present.
  record(productId: number): void {
    this.productIds.set([productId, ...this.productIds().filter(id => id !== productId)].slice(0, MAX_ITEMS));

    if (this.userId) {
      this.http.post<void>(`${this.baseUrl}/${productId}`, {}).subscribe({ error: () => {} });
    } else {
      this.writeGuest([
        { id: productId, at: Date.now() },
        ...this.readGuest().filter(v => v.id !== productId)
      ].slice(0, MAX_ITEMS));
    }
  }

  // Drops an id from what's shown (deleted/inactive product, failed fetch).
  // Local only - the server already skips inactive products.
  remove(productId: number): void {
    this.productIds.set(this.productIds().filter(id => id !== productId));
    if (!this.userId) {
      this.writeGuest(this.readGuest().filter(v => v.id !== productId));
    }
  }

  // "Clear history".
  clear(): void {
    this.replace([]);
    if (this.userId) {
      this.http.delete<void>(this.baseUrl).subscribe({ error: () => {} });
    } else {
      this.writeGuest([]);
    }
  }

  private replace(ids: number[]): void {
    this.productIds.set(ids);
    this.changed.update(n => n + 1);
  }

  private takeLegacyUserList(userId: number): number[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(legacyUserKey(userId)) ?? '[]');
      localStorage.removeItem(legacyUserKey(userId));
      return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : [];
    } catch {
      return [];
    }
  }

  private readGuest(): GuestView[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]');
      if (!Array.isArray(parsed)) {
        return [];
      }
      const cutoff = Date.now() - GUEST_EXPIRY_MS;
      return parsed.filter(
        (v): v is GuestView => typeof v?.id === 'number' && typeof v?.at === 'number' && v.at >= cutoff
      );
    } catch {
      return [];
    }
  }

  private writeGuest(views: GuestView[]): void {
    try {
      if (views.length === 0) {
        localStorage.removeItem(GUEST_KEY);
      } else {
        localStorage.setItem(GUEST_KEY, JSON.stringify(views));
      }
    } catch {
      // Storage may be unavailable (private browsing, quota exceeded, etc.) -
      // the in-memory signal still works for the rest of this session.
    }
  }
}
