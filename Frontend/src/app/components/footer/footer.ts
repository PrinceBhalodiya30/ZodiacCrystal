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
  newsletterHoneypot = signal('');
  newsletterSubmitted = signal(false);
  welcomeCoupon = signal<string | null>(null);
  welcomeDiscount = signal<string | null>(null);
  copiedCoupon = signal(false);
  isSubscribing = signal(false);
  newsletterError = signal('');

  subscribeNewsletter(): void {
    const email = this.newsletterEmail().trim();
    if (!email || this.isSubscribing()) {
      return;
    }

    this.isSubscribing.set(true);
    this.newsletterError.set('');

    this.newsletterService.subscribe(email, this.newsletterHoneypot()).subscribe({
      next: (res) => {
        this.isSubscribing.set(false);
        this.newsletterSubmitted.set(true);
        this.welcomeCoupon.set(res.couponCode || null);
        this.welcomeDiscount.set(res.discount || null);
        this.newsletterEmail.set('');
      },
      error: (error: HttpErrorResponse) => {
        this.isSubscribing.set(false);
        this.newsletterError.set(error.error?.message || 'Please enter a valid personal or business email address.');
      }
    });
  }

  copyCoupon(code: string): void {
    if (!navigator?.clipboard) {
      return;
    }
    navigator.clipboard.writeText(code).then(() => {
      this.copiedCoupon.set(true);
      setTimeout(() => this.copiedCoupon.set(false), 2500);
    });
  }
}
