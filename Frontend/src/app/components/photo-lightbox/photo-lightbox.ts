import { Component, HostListener, computed, input, model, output } from '@angular/core';

// Full-screen viewer for a set of photos (customer review photos on the product
// page and in admin). Arrow keys / buttons step through, Esc or backdrop closes.
@Component({
  selector: 'app-photo-lightbox',
  standalone: true,
  templateUrl: './photo-lightbox.html',
  styleUrl: './photo-lightbox.css'
})
export class PhotoLightbox {
  photos = input.required<string[]>();
  index = model(0);
  caption = input<string>('');
  closed = output<void>();

  current = computed(() => this.photos()[this.index()] ?? null);
  hasMany = computed(() => this.photos().length > 1);

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
      this.index.set((this.index() + delta + count) % count);
    }
  }
}
