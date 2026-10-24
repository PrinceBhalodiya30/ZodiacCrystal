import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  title?: string;
  message: string;
  type: ToastType;
  durationMs: number;
  remainingMs?: number;
  startedAt?: number;
}

const SUCCESS_DISMISS_MS = 4000;
const ERROR_DISMISS_MS = 6500;
const INFO_DISMISS_MS = 4000;
const MAX_VISIBLE_TOASTS = 3;

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);
  private nextId = 1;
  private readonly queuedToasts: Toast[] = [];
  private readonly dismissTimers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string, durationMs?: number): void;
  success(title: string, message: string, durationMs?: number): void;
  success(messageOrTitle: string, messageOrDuration?: string | number, durationMs?: number): void {
    if (typeof messageOrDuration === 'string') {
      this.showWithTitle(messageOrTitle, messageOrDuration, 'success', durationMs);
    } else {
      this.show(messageOrTitle, 'success', messageOrDuration);
    }
  }

  error(message: string, durationMs?: number): void;
  error(title: string, message: string, durationMs?: number): void;
  error(messageOrTitle: string, messageOrDuration?: string | number, durationMs?: number): void {
    if (typeof messageOrDuration === 'string') {
      this.showWithTitle(messageOrTitle, messageOrDuration, 'error', durationMs);
    } else {
      this.show(messageOrTitle, 'error', messageOrDuration);
    }
  }

  info(message: string, durationMs?: number): void;
  info(title: string, message: string, durationMs?: number): void;
  info(messageOrTitle: string, messageOrDuration?: string | number, durationMs?: number): void {
    if (typeof messageOrDuration === 'string') {
      this.showWithTitle(messageOrTitle, messageOrDuration, 'info', durationMs);
    } else {
      this.show(messageOrTitle, 'info', messageOrDuration);
    }
  }

  warning(message: string, durationMs?: number): void;
  warning(title: string, message: string, durationMs?: number): void;
  warning(messageOrTitle: string, messageOrDuration?: string | number, durationMs?: number): void {
    if (typeof messageOrDuration === 'string') {
      this.showWithTitle(messageOrTitle, messageOrDuration, 'warning', durationMs);
    } else {
      this.show(messageOrTitle, 'warning', messageOrDuration);
    }
  }

  pause(id: number): void {
    const timer = this.dismissTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.dismissTimers.delete(id);
    }

    const current = this.toasts().find(t => t.id === id);
    if (current && current.startedAt) {
      const elapsed = Date.now() - current.startedAt;
      current.remainingMs = Math.max(1200, current.durationMs - elapsed);
    }
  }

  resume(id: number): void {
    if (this.dismissTimers.has(id)) {
      return;
    }

    const current = this.toasts().find(t => t.id === id);
    if (!current) {
      return;
    }

    const remaining = current.remainingMs ?? current.durationMs;
    current.startedAt = Date.now();
    current.durationMs = remaining;
    this.dismissTimers.set(id, setTimeout(() => this.dismiss(id), remaining));
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

  private show(message: string, type: ToastType, customDurationMs?: number): void {
    const defaultDuration = type === 'error' ? ERROR_DISMISS_MS : (type === 'warning' ? 5000 : SUCCESS_DISMISS_MS);
    const toast: Toast = {
      id: this.nextId++,
      message,
      type,
      durationMs: customDurationMs ?? defaultDuration
    };

    if (this.toasts().length >= MAX_VISIBLE_TOASTS) {
      this.queuedToasts.push(toast);
      return;
    }

    this.present(toast);
  }

  private showWithTitle(title: string, message: string, type: ToastType, customDurationMs?: number): void {
    const defaultDuration = type === 'error' ? ERROR_DISMISS_MS : (type === 'warning' ? 5000 : SUCCESS_DISMISS_MS);
    const toast: Toast = {
      id: this.nextId++,
      title,
      message,
      type,
      durationMs: customDurationMs ?? defaultDuration
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
    toast.startedAt = Date.now();
    toast.remainingMs = toast.durationMs;
    this.toasts.update(items => [...items, toast]);
    this.dismissTimers.set(toast.id, setTimeout(() => this.dismiss(toast.id), toast.durationMs));
  }
}
