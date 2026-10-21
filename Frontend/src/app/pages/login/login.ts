import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WishlistService } from '../../services/wishlist.service';
import { AuthShowcase } from '../../components/auth-showcase/auth-showcase';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, AuthShowcase],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private authService = inject(AuthService);
  private wishlistService = inject(WishlistService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  password = '';
  rememberMe = true;
  showPassword = signal(false);
  isSubmitting = signal(false);
  errorMessage = signal('');


  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  onSubmit(): void {
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService.login({ email: this.email, password: this.password }, this.rememberMe).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.wishlistService.loadWishlist();
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const defaultUrl = this.authService.isAdmin() ? '/admin/dashboard' : '/';
        this.router.navigateByUrl(returnUrl || defaultUrl);
      },
      error: error => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          error.status === 401
            ? 'Invalid email or password.'
            : (error.error?.message ||
                (error.status === 0
                  ? 'Unable to connect to the server. Please check your connection or verify the backend is running.'
                  : 'Unable to log in right now. Please try again.'))
        );
      }
    });
  }
}
