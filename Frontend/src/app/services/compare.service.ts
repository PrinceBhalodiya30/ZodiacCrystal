import { Injectable, computed, inject, signal } from '@angular/core';
import { Product } from '../models/product';
import { ToastService } from './toast.service';

const MAX_COMPARE_ITEMS = 3;

@Injectable({ providedIn: 'root' })
export class CompareService {
  private toast = inject(ToastService);

  readonly max = MAX_COMPARE_ITEMS;
  items = signal<Product[]>([]);
  isModalOpen = signal(false);

  count = computed(() => this.items().length);
  hasItems = computed(() => this.items().length > 0);

  isComparing(productId: number): boolean {
    return this.items().some(p => p.productId === productId);
  }

  isCompared(productId: number): boolean {
    return this.isComparing(productId);
  }

  toggle(product: Product): void {
    if (this.isComparing(product.productId)) {
      this.remove(product.productId);
      this.toast.success(`Removed "${product.name}" from comparison`);
      return;
    }

    if (this.items().length >= this.max) {
      this.toast.error(`You can compare up to ${this.max} crystals at once. Remove one to add another.`);
      return;
    }

    this.items.update(list => [...list, product]);
    this.toast.success(`Added "${product.name}" to comparison (${this.items().length}/${this.max})`);
  }

  remove(productId: number): void {
    this.items.update(list => list.filter(p => p.productId !== productId));
    if (this.items().length === 0) {
      this.closeModal();
    }
  }

  clear(): void {
    this.items.set([]);
    this.closeModal();
  }

  openModal(): void {
    if (this.items().length >= 1) {
      this.isModalOpen.set(true);
    }
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }
}
