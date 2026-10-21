import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { getPasswordStrength, PasswordStrength } from '../../utils/password-strength.util';
import { HERO_IMAGE_URL } from '../../utils/hero-image.util';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { SITE_NAME } from '../../services/page-title.service';

// Two steps, like registration: 'email' asks where to send a code; 'reset'
// takes the code plus the new password.
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink, ImgFallbackDirective],
  templateUrl: './forgot-password.html',
  // Same split-panel auth layout as the register page.
  styleUrls: ['../register/register.css', './forgot-password.css']
})
export class ForgotPassword {
  readonly siteName = SITE_NAME;
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  email = '';
  code = '';
  newPassword = '';
  confirmPassword = '';

  step = signal<'email' | 'reset'>('email');
  showPassword = signal(false);
  isSubmitting = signal(false);
  errorMessage = signal('');
  infoMessage = signal('');
  resendIn = signal(0);
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  readonly heroImageUrl = HERO_IMAGE_URL;

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

  sendCode(): void {
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

  resetPassword(): void {
    if (this.passwordsMismatch) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService.resetPassword(this.email.trim(), this.code.trim(), this.newPassword).subscribe({
      next: response => {
        this.isSubmitting.set(false);
        this.toast.success(response.message);
        this.router.navigate(['/login']);
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
    this.errorMessage.set('');
    this.step.set('email');
  }

  private startResendTimer(seconds: number): void {
    this.stopResendTimer();
    this.resendIn.set(seconds);
    this.resendTimer = setInterval(() => {
      const next = this.resendIn() - 1;
      this.resendIn.set(Math.max(next, 0));
      if (next <= 0) {
        this.stopResendTimer();
      }
    }, 1000);
  }

  private stopResendTimer(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
  }
}
