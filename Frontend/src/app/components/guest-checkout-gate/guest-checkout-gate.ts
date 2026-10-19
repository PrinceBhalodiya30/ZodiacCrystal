import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { GuestSessionService } from '../../services/guest-session.service';

type GateStep = 'choose' | 'email' | 'code';

// Checkout for a logged-out shopper: log in / create an account, or continue
// as a guest by verifying their email with a 6-digit code.
@Component({
  selector: 'app-guest-checkout-gate',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './guest-checkout-gate.html',
  styleUrl: './guest-checkout-gate.css'
})
export class GuestCheckoutGate {
  private guestSession = inject(GuestSessionService);

  verified = output<void>();

  step = signal<GateStep>('choose');
  name = '';
  email = '';
  code = '';
  isBusy = signal(false);
  errorMessage = signal('');
  // Set when the verified email already has an account.
  accountExists = signal(false);
  resendIn = signal(0);
  private resendTimer?: ReturnType<typeof setInterval>;

  sendCode(): void {
    if (this.isBusy() || !this.name.trim() || !this.email.trim()) {
      this.errorMessage.set('Please enter your name and email.');
      return;
    }
    this.isBusy.set(true);
    this.errorMessage.set('');
    this.guestSession.start(this.email.trim()).subscribe({
      next: response => {
        this.isBusy.set(false);
        this.code = '';
        this.step.set('code');
        this.startResendCountdown(response.resendAfterSeconds);
      },
      error: (error: HttpErrorResponse) => {
        this.isBusy.set(false);
        if (error.status === 429 && error.error?.retryAfterSeconds) {
          // A code was sent very recently - it's still valid, so go enter it.
          this.step.set('code');
          this.startResendCountdown(error.error.retryAfterSeconds);
          return;
        }
        this.errorMessage.set(error.error?.message || 'We couldn\'t send the code. Please try again.');
      }
    });
  }

  verify(): void {
    if (this.isBusy() || !/^\d{6}$/.test(this.code.trim())) {
      this.errorMessage.set('Enter the 6-digit code from the email.');
      return;
    }
    this.isBusy.set(true);
    this.errorMessage.set('');
    this.guestSession.verify(this.email.trim(), this.code.trim(), this.name.trim()).subscribe({
      next: () => {
        this.isBusy.set(false);
        clearInterval(this.resendTimer);
        this.verified.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.isBusy.set(false);
        this.accountExists.set(error.status === 409 && !!error.error?.accountExists);
        this.errorMessage.set(error.error?.message || 'That code didn\'t work. Please try again.');
      }
    });
  }

  changeEmail(): void {
    this.step.set('email');
    this.errorMessage.set('');
    this.accountExists.set(false);
  }

  private startResendCountdown(seconds: number): void {
    clearInterval(this.resendTimer);
    this.resendIn.set(seconds);
    this.resendTimer = setInterval(() => {
      this.resendIn.update(s => Math.max(0, s - 1));
      if (this.resendIn() === 0) {
        clearInterval(this.resendTimer);
      }
    }, 1000);
  }
}
