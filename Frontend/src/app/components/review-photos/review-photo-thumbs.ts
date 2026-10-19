import { Component, input, output } from '@angular/core';

export interface ThumbPhoto {
  imageUrl: string;
  // Shown as a badge on the author's own photos that aren't public yet.
  pending?: boolean;
  alt?: string;
}

// A row of square photo thumbnails; clicking one asks the parent to open the
// lightbox at that index.
@Component({
  selector: 'app-review-photo-thumbs',
  standalone: true,
  templateUrl: './review-photo-thumbs.html',
  styleUrl: './review-photos.css'
})
export class ReviewPhotoThumbs {
  photos = input.required<ThumbPhoto[]>();
  size = input<'sm' | 'md'>('sm');
  // Optional heading, e.g. "Customer photos" above the review list.
  heading = input<string>('');
  open = output<number>();
}
