import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { getPasswordStrength, PasswordStrength } from '../../utils/password-strength.util';
import { SITE_NAME } from '../../services/page-title.service';

// Two steps: 'email' asks where to send a code; 'reset' takes the code plus the new password.
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['../register/register.css', './forgot-password.css']
})
export class ForgotPassword {
  readonly siteName = SITE_NAME;
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  email = '';
  code = '';
  newPassword = '';
  confirmPassword = '';

  readonly step = signal<'email' | 'reset'>('email');
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly infoMessage = signal('');
  readonly resendIn = signal(0);
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Prefilled when arriving from the "this wasn't me" email-change undo page.
    this.email = inject(ActivatedRoute).snapshot.queryParamMap.get('email') ?? '';
    inject(DestroyRef).onDestroy(() => this.stopResendTimer());
  }

  get passwordsMismatch(): boolean {
    return this.confirmPassword.length > 0 && this.newPassword !== this.confirmPassword;
  }

  get passwordStrength(): PasswordStrength | null {
    return getPasswordStrength(this.newPassword);
  }

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }

  sendCode(form?: NgForm): void {
    if (form?.invalid) {
      Object.values(form.controls).forEach(control => control.markAsTouched());
      const firstInvalid = document.querySelector('input.ng-invalid') as HTMLElement | null;
      firstInvalid?.focus();
      return;
    }

    if (this.isSubmitting() || this.resendIn() > 0) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService.forgotPassword(this.email.trim()).subscribe({
      next: response => {
        this.isSubmitting.set(false);
        this.infoMessage.set(response.message);
        this.code = '';
        this.step.set('reset');
        this.startResendTimer(response.resendAfterSeconds);
      },
      error: error => {
        this.isSubmitting.set(false);
        this.errorMessage.set(error.error?.message || 'Unable to send a reset code right now. Please try again.');
      }
    });
  }

  resetPassword(form?: NgForm): void {
    if (form?.invalid) {
      Object.values(form.controls).forEach(control => control.markAsTouched());
      const firstInvalid = document.querySelector('input.ng-invalid') as HTMLElement | null;
      firstInvalid?.focus();
      return;
    }

    if (this.passwordsMismatch) {
      const confirmInput = document.getElementById('confirmPassword');
      confirmInput?.focus();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService.resetPassword(this.email.trim(), this.code.trim(), this.newPassword).subscribe({
      next: response => {
        this.isSubmitting.set(false);
        this.clearCooldown();
        this.toast.success(response.message);
        void this.router.navigate(['/login']);
      },
      error: error => {
        this.isSubmitting.set(false);
        this.errorMessage.set(error.error?.message || 'Unable to reset your password right now. Please try again.');
      }
    });
  }

  changeEmail(): void {
    this.stopResendTimer();
    this.resendIn.set(0);
    this.clearCooldown();
    this.errorMessage.set('');
    this.step.set('email');
  }

  private startResendTimer(seconds: number): void {
    this.stopResendTimer();
    const expireAt = Date.now() + seconds * 1000;
    try {
      sessionStorage.setItem(`pwd_reset_cooldown_${this.email.toLowerCase()}`, expireAt.toString());
    } catch {}

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expireAt - Date.now()) / 1000));
      this.resendIn.set(remaining);
      if (remaining <= 0) {
        this.stopResendTimer();
        this.clearCooldown();
      }
    };
    tick();
    this.resendTimer = setInterval(tick, 1000);
  }

  private stopResendTimer(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
  }

  private clearCooldown(): void {
    try {
      sessionStorage.removeItem(`pwd_reset_cooldown_${this.email.toLowerCase()}`);
    } catch {}
  }
}
