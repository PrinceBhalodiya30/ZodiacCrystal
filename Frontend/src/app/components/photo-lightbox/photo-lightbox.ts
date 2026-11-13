import { Component, HostListener, computed, input, model, output, signal } from '@angular/core';

// Full-screen viewer for a set of photos (customer review photos on the product
// page and in admin). Arrow keys / buttons step through, Esc or backdrop closes.
@Component({
  selector: 'app-photo-lightbox',
  standalone: true,
  templateUrl: './photo-lightbox.html',
  styleUrl: './photo-lightbox.css'
})
export class PhotoLightbox {
  readonly photos = input.required<string[]>();
  readonly index = model(0);
  readonly caption = input<string>('');
  readonly closed = output<void>();

  readonly isZoomed = signal(false);

  readonly current = computed(() => this.photos()[this.index()] ?? null);
  readonly hasMany = computed(() => this.photos().length > 1);

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closed.emit();
    } else if (event.key === 'ArrowRight') {
      this.step(1);
    } else if (event.key === 'ArrowLeft') {
      this.step(-1);
    }
  }

  step(delta: number): void {
    const count = this.photos().length;
    if (count > 1) {
      this.isZoomed.set(false);
      this.index.set((this.index() + delta + count) % count);
    }
  }

  toggleZoom(event: MouseEvent): void {
    event.stopPropagation();
    this.isZoomed.update(z => !z);
  }
}
