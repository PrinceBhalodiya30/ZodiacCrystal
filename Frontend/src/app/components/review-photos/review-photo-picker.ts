import { Component, DestroyRef, inject, input, model } from '@angular/core';
import { ToastService } from '../../services/toast.service';

export interface PickedPhoto {
  file: File;
  previewUrl: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

// "Add photos" control for the review form: picks up to `max` JPG/PNG/WebP
// files (5 MB each), shows previews and lets the customer remove them before
// the review is submitted. The server re-checks everything.
@Component({
  selector: 'app-review-photo-picker',
  standalone: true,
  templateUrl: './review-photo-picker.html',
  styleUrl: './review-photos.css'
})
export class ReviewPhotoPicker {
  private toast = inject(ToastService);

  photos = model<PickedPhoto[]>([]);
  max = input(3);
  disabled = input(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.photos().forEach(p => URL.revokeObjectURL(p.previewUrl)));
  }

  onFilesSelected(input: HTMLInputElement): void {
    const chosen = Array.from(input.files ?? []);
    input.value = '';

    const room = this.max() - this.photos().length;
    if (chosen.length > room) {
      this.toast.error(`You can add up to ${this.max()} photos.`);
    }

    const accepted: PickedPhoto[] = [];
    for (const file of chosen.slice(0, Math.max(0, room))) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        this.toast.error(`${file.name} isn't a JPG, PNG or WebP image.`);
      } else if (file.size > MAX_BYTES) {
        this.toast.error(`${file.name} is larger than 5 MB.`);
      } else {
        accepted.push({ file, previewUrl: URL.createObjectURL(file) });
      }
    }

    if (accepted.length) {
      this.photos.update(list => [...list, ...accepted]);
    }
  }

  remove(index: number): void {
    const photo = this.photos()[index];
    if (photo) {
      URL.revokeObjectURL(photo.previewUrl);
      this.photos.update(list => list.filter((_, i) => i !== index));
    }
  }
}
