import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { WishlistService } from '../services/wishlist.service';
import { GuestSessionService } from '../services/guest-session.service';
import { isAuthRequiredRoute } from '../guards/auth.guard';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const wishlistService = inject(WishlistService);
  const guestSession = inject(GuestSessionService);
  const token = authService.getToken();
  // A real login always wins; otherwise a verified guest-checkout session, if any.
  const guestToken = token ? null : guestSession.getToken();
  const bearer = token ?? guestToken;

  const authReq = bearer
    ? req.clone({ setHeaders: { Authorization: `Bearer ${bearer}` } })
    : req;

  return next(authReq).pipe(
    catchError(error => {
      // An expired or revoked guest session: drop it quietly - checkout asks
      // for the email code again instead of bouncing to the login page.
      if (error.status === 401 && guestToken) {
        guestSession.clear();
        return throwError(() => error);
      }

      // A wrong password on /Auth/login is a 401 too - the login page handles that itself.
      // Only an expired session counts: a guest (no token sent) hitting a
      // login-only endpoint must not be bounced to the login page.
      if (error.status === 401 && token && !req.url.includes('/Auth/')) {
        authService.logout();
        wishlistService.clear();

        // Only redirect to login if the user was on an authenticated route.
        // If on the home page ('/') or any public catalog page, keep the user on that page as a guest.
        const currentUrl = router.url;
        if (isAuthRequiredRoute(currentUrl)) {
          const returnUrl = currentUrl.startsWith('/login') ? undefined : currentUrl;
          void router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : {} });
        }
      }

      return throwError(() => error);
    })
  );
};
