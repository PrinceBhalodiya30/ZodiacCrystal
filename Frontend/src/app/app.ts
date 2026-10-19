import { Component, Injector, afterNextRender, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { filter, first } from 'rxjs';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { ConfirmDialog } from './components/confirm-dialog/confirm-dialog';
import { ToastContainer } from './components/toast-container/toast-container';
import { AuthService } from './services/auth.service';
import { WishlistService } from './services/wishlist.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, ConfirmDialog, ToastContainer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private router = inject(Router);
  private injector = inject(Injector);

  // The admin section has its own sidebar/nav and logout, so the customer
  // site chrome would just be redundant duplicate navigation there.
  isAdminRoute = signal(this.router.url.startsWith('/admin'));

  constructor() {
    // Session ran out while the app was open: same handling as a REST 401 in the auth interceptor.
    const wishlistService = inject(WishlistService);
    inject(AuthService).sessionExpired.subscribe(() => {
      wishlistService.clear();
      const returnUrl = this.router.url.startsWith('/login') ? undefined : this.router.url;
      this.router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : {} });
    });

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => this.isAdminRoute.set(event.urlAfterRedirects.startsWith('/admin')));

    // Fade out the splash loader from index.html once the first page has
    // actually rendered (or the first navigation failed, so it never hangs).
    this.router.events
      .pipe(first(e => e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError))
      .subscribe(() => afterNextRender(() => this.hideSplash(), { injector: this.injector }));
  }

  private hideSplash(): void {
    const splash = document.getElementById('app-splash');
    if (!splash) {
      return;
    }
    splash.classList.add('is-hidden');
    setTimeout(() => splash.remove(), 400);
  }
}
