import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ZodiacService } from '../../services/zodiac.service';
import { Zodiac } from '../../models/zodiac';
import { AdminNav } from '../admin-nav/admin-nav';
import { Spinner } from '../../components/spinner/spinner';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-admin-zodiac',
  standalone: true,
  imports: [Spinner, FormsModule, AdminNav],
  templateUrl: './zodiac.html',
  styleUrls: ['../admin-shared.css', './zodiac.css']
})
export class AdminZodiac implements OnInit {
  private zodiacService = inject(ZodiacService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  zodiacSigns = signal<Zodiac[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  formMode = signal<'closed' | 'create' | 'edit'>('closed');
  editingZodiacId = signal<number | null>(null);
  isSubmitting = signal(false);
  formError = signal('');

  formName = '';
  formSymbol = '';
  formDescription = '';
  formImageUrl = '';

  ngOnInit(): void {
    this.loadZodiacSigns();
  }

  loadZodiacSigns(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.zodiacService.getZodiacSigns().subscribe({
      next: signs => {
        this.zodiacSigns.set(signs);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load zodiac signs.');
        this.isLoading.set(false);
      }
    });
  }

  startCreate(): void {
    this.formMode.set('create');
    this.editingZodiacId.set(null);
    this.formName = '';
    this.formSymbol = '';
    this.formDescription = '';
    this.formImageUrl = '';
    this.formError.set('');
  }

  startEdit(zodiac: Zodiac): void {
    this.formMode.set('edit');
    this.editingZodiacId.set(zodiac.zodiacId);
    this.formName = zodiac.name;
    this.formSymbol = zodiac.symbol ?? '';
    this.formDescription = zodiac.description ?? '';
    this.formImageUrl = zodiac.imageUrl ?? '';
    this.formError.set('');
  }

  cancelForm(): void {
    this.formMode.set('closed');
    this.editingZodiacId.set(null);
  }

  submitForm(): void {
    this.isSubmitting.set(true);
    this.formError.set('');

    const request = {
      name: this.formName,
      symbol: this.formSymbol || undefined,
      description: this.formDescription || undefined,
      imageUrl: this.formImageUrl || undefined
    };

    const editingId = this.editingZodiacId();

    if (editingId) {
      this.zodiacService.updateZodiac(editingId, request).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.formMode.set('closed');
          this.toast.success(`"${request.name}" updated.`);
          this.loadZodiacSigns();
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.formError.set(error.error?.message || 'Unable to save this zodiac sign.');
        }
      });
    } else {
      this.zodiacService.createZodiac(request).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.formMode.set('closed');
          this.toast.success(`"${request.name}" added.`);
          this.loadZodiacSigns();
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.formError.set(error.error?.message || 'Unable to save this zodiac sign.');
        }
      });
    }
  }

  async deleteZodiac(zodiac: Zodiac): Promise<void> {
    const confirmed = await this.confirmDialog.confirm(
      `Delete "${zodiac.name}"? This cannot be undone.`,
      { confirmLabel: 'Delete', danger: true }
    );

    if (!confirmed) {
      return;
    }

    this.zodiacService.deleteZodiac(zodiac.zodiacId).subscribe({
      next: () => {
        this.zodiacSigns.update(items => items.filter(z => z.zodiacId !== zodiac.zodiacId));
        this.toast.success(`"${zodiac.name}" deleted.`);
      },
      error: (error: HttpErrorResponse) => {
        const message = error.error?.message || `Unable to delete "${zodiac.name}".`;
        this.toast.error(message);
      }
    });
  }
}
