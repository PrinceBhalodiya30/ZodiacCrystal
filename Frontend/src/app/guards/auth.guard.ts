import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export function isAuthRequiredRoute(url: string): boolean {
  if (!url || url === '/' || url === '') {
    return false;
  }
  const cleanUrl = url.split('?')[0].split('#')[0];
  return cleanUrl.startsWith('/admin') ||
         cleanUrl.startsWith('/profile') ||
         cleanUrl.startsWith('/orders') ||
         cleanUrl.startsWith('/wishlist') ||
         cleanUrl.startsWith('/checkout') ||
         cleanUrl.startsWith('/support');
}

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  void router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};
