import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Cart and checkout: open to customers AND logged-out shoppers (guest
// checkout - the checkout page itself asks a guest to log in or verify their
// email). Admins have no cart, same as customerGuard.
export const shopperGuard: CanActivateFn = () => {
  const authService = inject(AuthService);

  if (authService.isAdmin()) {
    inject(Router).navigate(['/admin']);
    return false;
  }

  return true;
};
