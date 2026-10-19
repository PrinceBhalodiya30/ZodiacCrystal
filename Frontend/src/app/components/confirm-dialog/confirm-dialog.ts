import { Component, effect, inject, signal } from '@angular/core';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css'
})
export class ConfirmDialog {
  service = inject(ConfirmDialogService);
  selectedReason = signal('');

  constructor() {
    // Each new request starts with nothing chosen.
    effect(() => {
      this.service.request();
      this.selectedReason.set('');
    });
  }
}
