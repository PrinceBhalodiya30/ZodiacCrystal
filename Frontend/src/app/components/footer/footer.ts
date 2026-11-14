import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { InrPipe } from '../../pipes/inr.pipe';
import { AuthService } from '../../services/auth.service';
import { NewsletterService } from '../../services/newsletter.service';
import { StoreSettingsService } from '../../services/store-settings.service';
import { SITE_NAME } from '../../services/page-title.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, FormsModule, InrPipe],
  templateUrl: './footer.html',
  styleUrl: './footer.css'
})
export class Footer {
  readonly siteName = SITE_NAME;
  readonly currentYear = new Date().getFullYear();
  readonly authService = inject(AuthService);
  private readonly newsletterService = inject(NewsletterService);
  private readonly storeSettings = inject(StoreSettingsService);
  readonly freeShippingThreshold = computed(() => this.storeSettings.freeShippingThreshold());
  readonly contact = computed(() => this.storeSettings.storeContactSettings());

  readonly newsletterEmail = signal('');
  readonly newsletterHoneypot = signal('');
  readonly newsletterSubmitted = signal(false);
  readonly welcomeCoupon = signal<string | null>(null);
  readonly welcomeDiscount = signal<string | null>(null);
  readonly copiedCoupon = signal(false);
  readonly isSubscribing = signal(false);
  readonly newsletterError = signal('');

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
    void navigator.clipboard
      .writeText(code)
      .then(() => {
        this.copiedCoupon.set(true);
        setTimeout(() => this.copiedCoupon.set(false), 2500);
      })
      .catch(() => {
        // Clipboard write failed or permission denied
      });
  }
}
