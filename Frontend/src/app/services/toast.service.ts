import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  durationMs: number;
}

const SUCCESS_DISMISS_MS = 3500;
const ERROR_DISMISS_MS = 7000;
const MAX_VISIBLE_TOASTS = 3;

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);
  private nextId = 1;
  private readonly queuedToasts: Toast[] = [];
  private readonly dismissTimers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  dismiss(id: number): void {
    const timer = this.dismissTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.dismissTimers.delete(id);
    }

    this.toasts.update(items => items.filter(t => t.id !== id));
    this.showNextQueuedToast();
  }

  private show(message: string, type: ToastType): void {
    const toast: Toast = {
      id: this.nextId++,
      message,
      type,
      durationMs: type === 'error' ? ERROR_DISMISS_MS : SUCCESS_DISMISS_MS
    };

    if (this.toasts().length >= MAX_VISIBLE_TOASTS) {
      this.queuedToasts.push(toast);
      return;
    }

    this.present(toast);
  }

  private showNextQueuedToast(): void {
    if (this.toasts().length >= MAX_VISIBLE_TOASTS) {
      return;
    }

    const next = this.queuedToasts.shift();
    if (next) {
      this.present(next);
    }
  }

  private present(toast: Toast): void {
    this.toasts.update(items => [...items, toast]);
    this.dismissTimers.set(toast.id, setTimeout(() => this.dismiss(toast.id), toast.durationMs));
  }
}
