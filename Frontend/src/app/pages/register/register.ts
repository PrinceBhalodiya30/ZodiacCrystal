import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  otp = '';
  showPassword = signal(false);
  isSubmitting = signal(false);
  errorMessage = signal('');

  // 'details' = name/email/password form; 'otp' = enter the emailed code.
  step = signal<'details' | 'otp'>('details');
  infoMessage = signal('');
  resendIn = signal(0);
  private resendTimer: ReturnType<typeof setInterval> | null = null;


  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopResendTimer());
  }

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  get passwordsMismatch(): boolean {
    return this.confirmPassword.length > 0 && this.password !== this.confirmPassword;
  }

  get passwordStrength(): PasswordStrength | null {
    return getPasswordStrength(this.password);
  }

  onSubmit(): void {
    if (this.passwordsMismatch) {
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

  onVerify(): void {
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService
      .verifyRegistration({ email: this.email, otp: this.otp.trim() })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
          this.router.navigateByUrl(returnUrl);
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
