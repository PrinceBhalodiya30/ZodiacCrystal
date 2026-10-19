import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { getPasswordStrength, PasswordStrength } from '../../utils/password-strength.util';
import { DeleteAccountCard } from '../../components/delete-account-card/delete-account-card';
import { ToastService } from '../../services/toast.service';

// Account Settings (/profile/settings): name, email, password, delete account.
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, DeleteAccountCard],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnDestroy {
  authService = inject(AuthService);
  private userService = inject(UserService);
  private toast = inject(ToastService);

  // Profile (name) editing - the email has its own verified flow below.
  isEditingProfile = signal(false);
  isSavingProfile = signal(false);
  profileError = signal('');
  formName = '';

  startEditProfile(): void {
    this.cancelEmailChange();
    const user = this.authService.currentUser();
    this.formName = user?.name ?? '';
    this.profileError.set('');
    this.isEditingProfile.set(true);
  }

  cancelEditProfile(): void {
    this.isEditingProfile.set(false);
  }

  saveProfile(): void {
    this.isSavingProfile.set(true);
    this.profileError.set('');

    this.userService.updateProfile({ name: this.formName.trim() }).subscribe({
      next: response => {
        this.isSavingProfile.set(false);
        this.authService.refreshSession(response);
        this.isEditingProfile.set(false);
        this.toast.success('Your name has been updated.');
      },
      error: (error: HttpErrorResponse) => {
        this.isSavingProfile.set(false);
        this.profileError.set(error.error?.message || 'Unable to update your profile.');
      }
    });
  }

  // Email change: 'request' asks for the new address + current password,
  // 'verify' takes the code emailed to the new address. Nothing changes on the
  // account until the code is confirmed.
  emailStep = signal<'closed' | 'request' | 'verify'>('closed');
  isSendingEmailCode = signal(false);
  isVerifyingEmail = signal(false);
  emailChangeError = signal('');
  emailCodeSentTo = signal('');
  emailResendIn = signal(0);
  showEmailPassword = signal(false);
  newEmail = '';
  emailPassword = '';
  emailOtp = '';
  private emailResendTimer: ReturnType<typeof setInterval> | null = null;

  startEmailChange(): void {
    this.isEditingProfile.set(false);
    this.newEmail = '';
    this.emailPassword = '';
    this.emailOtp = '';
    this.showEmailPassword.set(false);
    this.emailChangeError.set('');
    this.emailStep.set('request');
  }

  cancelEmailChange(): void {
    this.emailStep.set('closed');
    this.emailPassword = '';
    this.emailOtp = '';
    this.stopEmailResendTimer();
  }

  // Back to step 1, e.g. after a typo in the new address.
  useDifferentEmail(): void {
    this.emailOtp = '';
    this.emailChangeError.set('');
    this.emailStep.set('request');
  }

  sendEmailCode(): void {
    if (this.isSendingEmailCode()) {
      return;
    }

    this.isSendingEmailCode.set(true);
    this.emailChangeError.set('');

    this.userService.requestEmailChange(this.newEmail.trim(), this.emailPassword).subscribe({
      next: response => {
        this.isSendingEmailCode.set(false);
        this.emailCodeSentTo.set(response.newEmail);
        this.emailOtp = '';
        this.emailStep.set('verify');
        this.startEmailResendTimer(response.resendAfterSeconds);
      },
      error: (error: HttpErrorResponse) => {
        this.isSendingEmailCode.set(false);
        this.emailChangeError.set(error.error?.message || 'Unable to send the verification code.');
        if (error.error?.retryAfterSeconds) {
          this.startEmailResendTimer(error.error.retryAfterSeconds);
        }
      }
    });
  }

  verifyEmailChange(): void {
    if (this.isVerifyingEmail()) {
      return;
    }

    this.isVerifyingEmail.set(true);
    this.emailChangeError.set('');

    this.userService.verifyEmailChange(this.emailOtp.trim()).subscribe({
      next: response => {
        this.isVerifyingEmail.set(false);
        this.authService.refreshSession(response);
        this.cancelEmailChange();
        this.toast.success(`Your email is now ${response.email}.`);
      },
      error: (error: HttpErrorResponse) => {
        this.isVerifyingEmail.set(false);
        this.emailChangeError.set(error.error?.message || 'Unable to verify the code.');
      }
    });
  }

  private startEmailResendTimer(seconds: number): void {
    this.stopEmailResendTimer();
    this.emailResendIn.set(seconds);
    this.emailResendTimer = setInterval(() => {
      const next = this.emailResendIn() - 1;
      this.emailResendIn.set(Math.max(next, 0));
      if (next <= 0) {
        this.stopEmailResendTimer();
      }
    }, 1000);
  }

  private stopEmailResendTimer(): void {
    if (this.emailResendTimer) {
      clearInterval(this.emailResendTimer);
      this.emailResendTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.stopEmailResendTimer();
  }

  // Password change
  isChangingPassword = signal(false);
  isSavingPassword = signal(false);
  passwordError = signal('');
  showPassword = signal(false);
  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  get newPasswordStrength(): PasswordStrength | null {
    return getPasswordStrength(this.newPassword);
  }

  startChangePassword(): void {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.showPassword.set(false);
    this.passwordError.set('');
    this.isChangingPassword.set(true);
  }

  cancelChangePassword(): void {
    this.isChangingPassword.set(false);
  }

  get newPasswordsMismatch(): boolean {
    return this.confirmNewPassword.length > 0 && this.newPassword !== this.confirmNewPassword;
  }

  savePassword(): void {
    if (this.newPasswordsMismatch) {
      return;
    }

    this.isSavingPassword.set(true);
    this.passwordError.set('');

    this.userService
      .changePassword({ currentPassword: this.currentPassword, newPassword: this.newPassword })
      .subscribe({
        next: response => {
          this.isSavingPassword.set(false);
          this.isChangingPassword.set(false);
          this.authService.refreshSession(response);
          this.toast.success('Your password has been updated.');
        },
        error: (error: HttpErrorResponse) => {
          this.isSavingPassword.set(false);
          this.passwordError.set(error.error?.message || 'Unable to change your password.');
        }
      });
  }
}
