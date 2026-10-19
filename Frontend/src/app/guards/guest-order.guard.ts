import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { GuestSessionService } from '../services/guest-session.service';

// /order/:id (the guest order pages). A signed-in customer goes to the normal
// /orders/:id page; a guest needs a session from an order link; anyone else
// is sent to "Find my order". The API still checks the order is theirs.
export const guestOrderGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return router.parseUrl(state.url.replace(/^\/order\//, '/orders/'));
  }

  if (inject(GuestSessionService).current()) {
    return true;
  }

  return router.createUrlTree(['/find-order'], { queryParams: { orderId: route.paramMap.get('id') } });
};
