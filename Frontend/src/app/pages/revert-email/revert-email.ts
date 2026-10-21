import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HERO_IMAGE_URL } from '../../utils/hero-image.util';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { SITE_NAME } from '../../services/page-title.service';

// Landing page for the "this wasn't me" link in the email-changed notice.
// Nothing happens until the owner clicks the button, so mail scanners that
// open links automatically can't trigger the undo.
@Component({
  selector: 'app-revert-email',
  standalone: true,
  imports: [RouterLink, ImgFallbackDirective],
  templateUrl: './revert-email.html',
  // Same split-panel auth layout as forgot password.
  styleUrls: ['../register/register.css', '../forgot-password/forgot-password.css']
})
export class RevertEmail {
  readonly siteName = SITE_NAME;
  private authService = inject(AuthService);

  private token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  readonly hasToken = this.token.length > 0;

  state = signal<'confirm' | 'done'>('confirm');
  isSubmitting = signal(false);
  errorMessage = signal(this.token ? '' : 'This link is incomplete. Please open it again from the email.');
  restoredEmail = signal('');
  message = signal('');

  readonly heroImageUrl = HERO_IMAGE_URL;

  restore(): void {
    if (!this.token || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService.revertEmailChange(this.token).subscribe({
      next: response => {
        // Every session was just ended server side, including any in this browser.
        this.authService.logout();
        this.restoredEmail.set(response.email);
        this.message.set(response.message);
        this.state.set('done');
        this.isSubmitting.set(false);
      },
      error: err => {
        this.errorMessage.set(err.error?.message ?? 'Something went wrong. Please try again.');
        this.isSubmitting.set(false);
      }
    });
  }
}
