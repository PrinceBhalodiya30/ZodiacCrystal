import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { getPasswordStrength, PasswordStrength } from '../../utils/password-strength.util';
import { AuthShowcase } from '../../components/auth-showcase/auth-showcase';
import { SITE_NAME } from '../../services/page-title.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, AuthShowcase],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  readonly siteName = SITE_NAME;
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  otp = '';
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');

  // 'details' = name/email/password form; 'otp' = enter the emailed code.
  readonly step = signal<'details' | 'otp'>('details');
  readonly infoMessage = signal('');
  readonly resendIn = signal(0);
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopResendTimer());
  }

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }

  get passwordsMismatch(): boolean {
    return this.confirmPassword.length > 0 && this.password !== this.confirmPassword;
  }

  get passwordStrength(): PasswordStrength | null {
    return getPasswordStrength(this.password);
  }

  onSubmit(form?: NgForm): void {
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

    this.sendCode();
  }

  resendCode(): void {
    if (this.resendIn() > 0 || this.isSubmitting()) {
      return;
    }

    this.otp = '';
    this.sendCode();
  }

  onVerify(form?: NgForm): void {
    if (form?.invalid) {
      Object.values(form.controls).forEach(control => control.markAsTouched());
      const firstInvalid = document.querySelector('input.ng-invalid') as HTMLElement | null;
      firstInvalid?.focus();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService
      .verifyRegistration({ email: this.email, otp: this.otp.trim() })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.clearCooldown();
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
          void this.router.navigateByUrl(returnUrl);
        },
        error: error => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            error.error?.message || 'Unable to verify the code right now. Please try again.'
          );
        }
      });
  }

  changeDetails(): void {
    this.stopResendTimer();
    this.resendIn.set(0);
    this.clearCooldown();
    this.otp = '';
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.step.set('details');
  }

  private sendCode(): void {
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService
      .register({ name: this.name, email: this.email, password: this.password })
      .subscribe({
        next: response => {
          this.isSubmitting.set(false);
          this.infoMessage.set(`${response.message} (${response.email})`);
          this.step.set('otp');
          this.startResendTimer(response.resendAfterSeconds);
        },
        error: error => {
          this.isSubmitting.set(false);
          if (error.status === 429 && error.error?.retryAfterSeconds) {
            this.startResendTimer(error.error.retryAfterSeconds);
          }
          this.errorMessage.set(
            error.error?.message || 'Unable to register right now. Please try again.'
          );
        }
      });
  }

  private startResendTimer(seconds: number): void {
    this.stopResendTimer();
    const expireAt = Date.now() + seconds * 1000;
    try {
      sessionStorage.setItem(`otp_resend_${this.email.toLowerCase()}`, expireAt.toString());
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
      sessionStorage.removeItem(`otp_resend_${this.email.toLowerCase()}`);
    } catch {}
  }
}
