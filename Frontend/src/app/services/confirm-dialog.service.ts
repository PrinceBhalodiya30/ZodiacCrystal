import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  // When set, the dialog shows a dropdown and Confirm needs a choice.
  reasons?: string[];
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (confirmed: boolean, reason?: string) => void;
}

export interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  request = signal<PendingConfirm | null>(null);

  confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    return new Promise(resolve => {
      this.request.set({
        message,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        danger: options.danger ?? false,
        resolve
      });
    });
  }

  // Like confirm(), but the user must pick one of `reasons`. Resolves to the
  // chosen reason, or null if they backed out.
  chooseReason(message: string, reasons: string[], options: ConfirmOptions = {}): Promise<string | null> {
    return new Promise(resolve => {
      this.request.set({
        message,
        reasons,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        danger: options.danger ?? false,
        resolve: (confirmed, reason) => resolve(confirmed && reason ? reason : null)
      });
    });
  }

  respond(confirmed: boolean, reason?: string): void {
    this.request()?.resolve(confirmed, reason);
    this.request.set(null);
  }
}
