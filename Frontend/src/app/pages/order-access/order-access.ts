import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { GuestSessionService } from '../../services/guest-session.service';
import { AuthService } from '../../services/auth.service';
import { Spinner } from '../../components/spinner/spinner';

// Landing page for the "View your order" link in guest emails (/order-access?t=...).
// Exchanges the token for a guest session and opens the order; the token is
// dropped from the address bar so it doesn't linger in history.
@Component({
  selector: 'app-order-access',
  standalone: true,
  imports: [RouterLink, Spinner],
  template: `
    <section class="container order-access-page">
      @if (errorMessage()) {
        <div class="state-message state-message--error">
          <p>{{ errorMessage() }}</p>
          <a class="btn" routerLink="/find-order">Find my order</a>
        </div>
      } @else {
        <app-spinner label="Opening your order..."></app-spinner>
      }
    </section>
  `,
  styles: [`.order-access-page { padding: 3rem 1.5rem; max-width: 640px; }`]
})
export class OrderAccess implements OnInit {
  private guestSession = inject(GuestSessionService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private token = inject(ActivatedRoute).snapshot.queryParamMap.get('t') ?? '';

  errorMessage = signal('');

  ngOnInit(): void {
    if (!this.token) {
      this.errorMessage.set('This link is incomplete. Use "Find my order" to get a new one.');
      return;
    }

    this.guestSession.openOrderLink(this.token).subscribe({
      next: response => {
        if (response.requiresLogin) {
          const target = `/orders/${response.orderId}`;
          if (this.authService.isLoggedIn()) {
            this.router.navigateByUrl(target, { replaceUrl: true });
          } else {
            this.router.navigate(['/login'], { queryParams: { returnUrl: target }, replaceUrl: true });
          }
          return;
        }
        this.router.navigate(['/order', response.orderId], { replaceUrl: true });
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(error.error?.message || 'We couldn\'t open this link. Please try again.');
      }
    });
  }
}
