import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService, FREE_SHIPPING_THRESHOLD, shippingFeeFor } from '../../services/cart.service';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { getProductSlug } from '../../utils/product-slug.util';
import { CartItem } from '../../models/cart';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

import { InrPipe } from '../../pipes/inr.pipe';
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [InrPipe, RouterLink, ImgFallbackDirective],
  templateUrl: './cart.html',
  styleUrl: './cart.css'
})
export class Cart implements OnInit {
  cartService = inject(CartService);
  private router = inject(Router);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  // Notes from re-checking prices/availability when the page opened.
  changeNotes = signal<string[]>([]);

  shippingFee = computed(() => shippingFeeFor(this.cartService.total()));
  grandTotal = computed(() => this.cartService.total() + this.shippingFee());
  amountToFreeShipping = computed(() => Math.max(0, FREE_SHIPPING_THRESHOLD - this.cartService.total()));
  freeShippingProgress = computed(() =>
    Math.min(100, Math.round((this.cartService.total() / FREE_SHIPPING_THRESHOLD) * 100))
  );

  ngOnInit(): void {
    // The saved cart is a snapshot; pull today's prices and stock before the customer decides.
    this.cartService.refresh().subscribe(notes => this.changeNotes.set(notes));
  }

  isOverStock(item: CartItem): boolean {
    return item.product.stockQuantity <= 0 || item.quantity > item.product.stockQuantity;
  }

  itemImage(item: CartItem): string | null {
    return getPrimaryImageUrl(item.product);
  }

  productSlug(item: CartItem): string {
    return getProductSlug(item.product);
  }

  itemSubtotal(item: CartItem): number {
    return item.product.price * item.quantity;
  }

  decrease(item: CartItem): void {
    this.cartService.updateQuantity(item.product.productId, item.quantity - 1);
  }

  increase(item: CartItem): void {
    this.cartService.updateQuantity(item.product.productId, item.quantity + 1);
  }

  remove(item: CartItem): void {
    this.cartService.removeFromCart(item.product.productId);
    this.toast.success(`${item.product.name} removed from your cart.`);
  }

  async clearCart(): Promise<void> {
    const count = this.cartService.items().length;
    const confirmed = await this.confirmDialog.confirm(
      `Remove all ${count} item${count === 1 ? '' : 's'} from your cart?`,
      { confirmLabel: 'Clear cart', cancelLabel: 'Keep items', danger: true }
    );
    if (!confirmed) {
      return;
    }

    this.cartService.clearCart();
    this.toast.success('Your cart has been cleared.');
  }

  checkout(): void {
    if (this.cartService.stockProblems().length > 0) {
      return;
    }

    // Checking out from the cart is never a Buy Now purchase - clear any
    // leftover Buy Now item so Checkout shows the actual cart, not a stale item.
    this.cartService.clearBuyNowItem();
    this.router.navigate(['/checkout']);
  }
}
