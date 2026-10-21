import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { NewsletterService } from '../../services/newsletter.service';
import { SITE_NAME } from '../../services/page-title.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css'
})
export class Footer {
  readonly siteName = SITE_NAME;
  readonly currentYear = new Date().getFullYear();
  authService = inject(AuthService);
  private newsletterService = inject(NewsletterService);

  newsletterEmail = signal('');
  newsletterSubmitted = signal(false);
  isSubscribing = signal(false);
  newsletterError = signal('');

  subscribeNewsletter(): void {
    const email = this.newsletterEmail().trim();
    if (!email) {
      return;
    }

    this.isSubscribing.set(true);
    this.newsletterError.set('');

    this.newsletterService.subscribe(email).subscribe({
      next: () => {
        this.isSubscribing.set(false);
        this.newsletterSubmitted.set(true);
        this.newsletterEmail.set('');
      },
      error: (error: HttpErrorResponse) => {
        this.isSubscribing.set(false);
        this.newsletterError.set(error.error?.message || 'Could not subscribe. Please try again.');
      }
    });
  }
}
