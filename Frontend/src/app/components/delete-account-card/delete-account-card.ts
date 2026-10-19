import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { CartService } from '../../services/cart.service';

// Profile "danger zone": permanently delete the customer's own account after
// re-entering their password and confirming. The backend refuses while orders
// or returns are still in progress and explains why.
@Component({
  selector: 'app-delete-account-card',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './delete-account-card.html',
  styleUrl: './delete-account-card.css'
})
export class DeleteAccountCard {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private cartService = inject(CartService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);

  isOpen = signal(false);
  isDeleting = signal(false);
  errorMessage = signal('');
  password = '';

  open(): void {
    this.password = '';
    this.errorMessage.set('');
    this.isOpen.set(true);
  }

  cancel(): void {
    this.isOpen.set(false);
  }

  async deleteAccount(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm(
      'Delete your account permanently? Your addresses, wishlist and notifications will be removed and you won\'t be able to log in again.',
      { confirmLabel: 'Delete Account', danger: true }
    );

    if (!confirmed) {
      return;
    }

    this.isDeleting.set(true);
    this.errorMessage.set('');

    this.userService.deleteMyAccount(this.password).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.cartService.clearCart();
        this.cartService.clearBuyNowItem();
        this.authService.logout();
        this.toast.success('Your account has been deleted.');
        this.router.navigate(['/']);
      },
      error: error => {
        this.isDeleting.set(false);
        this.errorMessage.set(error.error?.message || 'Unable to delete your account right now. Please try again.');
      }
    });
  }
}
