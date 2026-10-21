import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api-config';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { NotificationService, StockLevel } from './notification.service';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
import { CartItem } from '../models/cart';
import { Product } from '../models/product';
import { ToastService } from './toast.service';

// Guest cart; each signed-in user gets their own key so the next person to sign
// in on a shared device never sees someone else's cart.
const GUEST_CART_KEY = 'cart_items';
const cartKey = (userId: number | null) => (userId ? `cart_items_${userId}` : GUEST_CART_KEY);
const BUY_NOW_KEY = 'buy_now_item';
const MERGE_NOTICE_KEY = 'cart_merge_notice';

// Mirrors OrdersController.CreateOrder: free at/above ₹999 item subtotal, flat ₹50
// otherwise. Display only - the backend computes the fee it actually charges.
export const FREE_SHIPPING_THRESHOLD = 999;
export const FLAT_SHIPPING_FEE = 50;
export const shippingFeeFor = (subtotal: number) =>
  subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;

@Injectable({ providedIn: 'root' })
export class CartService {
  private auth = inject(AuthService);
  private productService = inject(ProductService);
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private syncTimer?: ReturnType<typeof setTimeout>;
  private storageKey = cartKey(this.auth.currentUser()?.userId ?? null);

  items = signal<CartItem[]>(this.loadStoredCart(this.storageKey));
  mergeNotice = signal<string | null>(this.loadStoredMergeNotice());

  private loadStoredMergeNotice(): string | null {
    try {
      return sessionStorage.getItem(MERGE_NOTICE_KEY);
    } catch {
      return null;
    }
  }

  setMergeNotice(msg: string): void {
    this.mergeNotice.set(msg);
    try {
      sessionStorage.setItem(MERGE_NOTICE_KEY, msg);
    } catch {}
  }

  dismissMergeNotice(): void {
    this.mergeNotice.set(null);
    try {
      sessionStorage.removeItem(MERGE_NOTICE_KEY);
    } catch {}
  }

  // A "Buy Now" purchase never touches the persisted cart - it's handed to the
  // Checkout page directly, then cleared. Kept in sessionStorage (not just
  // memory) so refreshing Checkout doesn't lose it and silently fall back to
  // the regular cart; sessionStorage is per-tab and gone when the tab closes.
  buyNowItem = signal<CartItem | null>(this.loadStoredBuyNowItem());

  constructor() {
    // Live stock (SignalR): keep the stock shown in the cart current, so an item
    // that sells out shows as such before checkout. Quantities are left alone;
    // the server still checks stock when the order is placed.
    inject(NotificationService).stockChanged.subscribe(levels => this.applyStock(levels));

    // Switch carts when the signed-in user changes (login, logout, session expiry).
    effect(() => {
      const key = cartKey(this.auth.currentUser()?.userId ?? null);
      untracked(() => this.switchCart(key));
    });
  }

  private switchCart(key: string): void {
    if (key === this.storageKey) {
      return;
    }

    let items = this.loadStoredCart(key);

    // Signing in: bring along anything added while browsing as a guest.
    if (this.storageKey === GUEST_CART_KEY && key !== GUEST_CART_KEY) {
      const guestItems = this.items();
      const hadPreviousItems = items.length > 0;

      if (guestItems.length > 0) {
        for (const guestItem of guestItems) {
          const existing = items.find(i => i.product.productId === guestItem.product.productId);
          if (existing) {
            existing.quantity = Math.min(existing.quantity + guestItem.quantity, guestItem.product.stockQuantity);
            existing.product = guestItem.product;
          } else {
            items.push(guestItem);
          }
        }
        localStorage.removeItem(GUEST_CART_KEY);

        // Notify user about merged items so they understand why both are in the cart
        if (hadPreviousItems) {
          const msg = 'We combined the items from your browsing session with your saved cart.';
          this.toast.success(msg);
          this.setMergeNotice(msg);
        } else {
          this.toast.success('Your cart items have been saved to your account.');
        }
      }
    } else {
      this.dismissMergeNotice();
    }

    this.storageKey = key;
    this.setItems(items);

    // A new session must not inherit another user's half-finished Buy Now.
    this.clearBuyNowItem();
  }

  // Re-fetches every line so the cart shows today's price and stock, not the
  // snapshot saved when it was added. Returns a note per line that changed
  // (empty when nothing did), for the page to show the customer.
  refresh(): Observable<string[]> {
    const items = this.items();
    if (items.length === 0) {
      return of([]);
    }

    return forkJoin(
      items.map(item =>
        // 404 = gone (null); any other failure keeps the line as it was (undefined).
        this.productService.getProduct(item.product.productId).pipe(
          catchError(err => of(err?.status === 404 ? null : undefined))
        )
      )
    ).pipe(
      map(fresh => {
        const notes: string[] = [];
        const updated: CartItem[] = [];

        items.forEach((item, i) => {
          const product = fresh[i];
          const name = item.product.name;

          if (product === undefined) {
            updated.push(item);
            return;
          }

          if (!product || !product.isActive) {
            notes.push(`"${name}" is no longer available and was removed.`);
            return;
          }

          if (product.price !== item.product.price) {
            notes.push(`"${name}" price changed from ₹${item.product.price} to ₹${product.price}.`);
          }

          updated.push({ product, quantity: item.quantity });
        });

        // Only replace lines the fetch covered; anything added meanwhile is kept.
        const refreshedIds = new Set(items.map(i => i.product.productId));
        this.setItems([
          ...updated,
          ...this.items().filter(i => !refreshedIds.has(i.product.productId))
        ]);

        return notes;
      })
    );
  }

  // Same as refresh(), for the one-off Buy Now item.
  refreshBuyNow(): Observable<string[]> {
    const item = this.buyNowItem();
    if (!item) {
      return of([]);
    }

    return this.productService.getProduct(item.product.productId).pipe(
      map(product => {
        if (!product.isActive) {
          this.clearBuyNowItem();
          return [`"${item.product.name}" is no longer available.`];
        }
        const notes = product.price !== item.product.price
          ? [`"${product.name}" price changed from ₹${item.product.price} to ₹${product.price}.`]
          : [];
        const fresh = { product, quantity: item.quantity };
        this.buyNowItem.set(fresh);
        sessionStorage.setItem(BUY_NOW_KEY, JSON.stringify(fresh));
        return notes;
      }),
      catchError(err => {
        if (err?.status === 404) {
          this.clearBuyNowItem();
          return of([`"${item.product.name}" is no longer available.`]);
        }
        return of([]);
      })
    );
  }

  // Lines asking for more than is in stock (including sold out). Checkout is blocked while any exist.
  stockProblems = computed(() =>
    this.items().filter(i => i.product.stockQuantity <= 0 || i.quantity > i.product.stockQuantity)
  );

  private applyStock(levels: StockLevel[]): void {
    const byId = new Map(levels.map(l => [l.productId, l.stockQuantity]));
    const update = (item: CartItem): CartItem =>
      byId.has(item.product.productId)
        ? { ...item, product: { ...item.product, stockQuantity: byId.get(item.product.productId)! } }
        : item;

    if (this.items().some(i => byId.has(i.product.productId))) {
      this.setItems(this.items().map(update));
    }

    const buyNow = this.buyNowItem();
    if (buyNow && byId.has(buyNow.product.productId)) {
      this.buyNowItem.set(update(buyNow));
    }
  }

  totalQuantity = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0)
  );

  total = computed(() =>
    this.items().reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  );

  // Returns how many were actually added - less than asked (or 0) when stock runs
  // out, so callers can say "Only N in stock" instead of a false success.
  addToCart(product: Product, quantity = 1): number {
    const items = [...this.items()];
    const index = items.findIndex(item => item.product.productId === product.productId);
    const current = index >= 0 ? items[index].quantity : 0;
    const next = Math.min(current + quantity, Math.max(0, product.stockQuantity));
    const added = Math.max(0, next - current);

    if (index >= 0) {
      items[index] = { product, quantity: Math.max(current, next) };
    } else if (next > 0) {
      items.push({ product, quantity: next });
    } else {
      return 0;
    }

    this.setItems(items);
    return added;
  }

  // Toast text for an add-to-cart result; null when everything asked for was added.
  static shortfallMessage(product: Product, asked: number, added: number): string | null {
    if (added >= asked) {
      return null;
    }
    if (product.stockQuantity <= 0) {
      return `${product.name} is sold out.`;
    }
    return added === 0
      ? `You already have all ${product.stockQuantity} in stock in your cart.`
      : `Only ${product.stockQuantity} in stock - added ${added} to your cart.`;
  }

  updateQuantity(productId: number, quantity: number): void {
    const items = this.items().map(item => {
      if (item.product.productId !== productId) {
        return item;
      }

      const clamped = Math.max(1, Math.min(quantity, item.product.stockQuantity));
      return { ...item, quantity: clamped };
    });

    this.setItems(items);
  }

  removeFromCart(productId: number): void {
    this.setItems(this.items().filter(item => item.product.productId !== productId));
  }

  clearCart(): void {
    this.setItems([]);
  }

  setBuyNowItem(product: Product, quantity: number): void {
    const item = { product, quantity: Math.min(quantity, product.stockQuantity) };
    this.buyNowItem.set(item);
    sessionStorage.setItem(BUY_NOW_KEY, JSON.stringify(item));
  }

  clearBuyNowItem(): void {
    this.buyNowItem.set(null);
    sessionStorage.removeItem(BUY_NOW_KEY);
  }

  private loadStoredBuyNowItem(): CartItem | null {
    const raw = sessionStorage.getItem(BUY_NOW_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as CartItem;
    } catch {
      return null;
    }
  }

  private setItems(items: CartItem[]): void {
    this.items.set(items);
    localStorage.setItem(this.storageKey, JSON.stringify(items));
    this.scheduleServerSync();
  }

  // Signed-in carts are copied to the server (debounced), only so a cart left idle
  // for a day can get a reminder email. An empty cart (e.g. after ordering) clears it.
  private scheduleServerSync(): void {
    clearTimeout(this.syncTimer);
    const userId = this.auth.currentUser()?.userId;
    if (!userId) {
      return;
    }
    this.syncTimer = setTimeout(() => {
      // Signed out or switched account meanwhile.
      if (this.auth.currentUser()?.userId !== userId) {
        return;
      }
      const lines = this.items().map(i => ({ productId: i.product.productId, quantity: i.quantity }));
      // Best effort: the cart works the same if this fails.
      this.http.put(`${API_BASE_URL}/cart`, lines).subscribe({ error: () => {} });
    }, 2000);
  }

  private loadStoredCart(key: string): CartItem[] {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as CartItem[];
    } catch {
      return [];
    }
  }
}
