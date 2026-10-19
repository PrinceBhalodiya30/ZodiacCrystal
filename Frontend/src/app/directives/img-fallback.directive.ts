import { Directive, ElementRef, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { buildWebpSrcset } from '../utils/product-image.util';

// A tiny inline SVG (crystal glyph on a soft lavender tile) used whenever a
// product image URL 404s or otherwise fails to load. Inline so it can never
// itself fail to load and retrigger the error handler.
const FALLBACK_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f5f1e9"/>
      <path d="M100 40 L140 80 L120 160 L80 160 L60 80 Z" fill="#bec6c1" stroke="#6f8277" stroke-width="3"/>
      <path d="M100 40 L100 160 M60 80 L140 80" stroke="#6f8277" stroke-width="2" opacity="0.5"/>
    </svg>
  `);

// Drop-in fallback for any product/content <img>: on load failure, swaps the
// broken image for a neutral placeholder instead of the browser's broken-icon
// + alt text overlapping badges/UI on top of it.
//
// Optional responsive mode: bind [imgSrc] (instead of [src]) plus imgSizes and,
// for our own uploads, a WebP srcset (name-400/800/1200.webp) is added. If a
// variant 404s (e.g. an older upload with no variants), the srcset is dropped so
// the browser falls back to the original URL, and only then to the placeholder.
@Directive({
  selector: 'img[imgFallback]',
  standalone: true
})
export class ImgFallbackDirective {
  private readonly el = inject(ElementRef<HTMLImageElement>);

  readonly imgSrc = input<string | null>();
  readonly imgSizes = input('100vw');

  // URL whose WebP variants failed - kept per-URL so a new image retries.
  private readonly failedVariantsFor = signal<string | null>(null);

  private readonly srcset = computed(() => {
    const url = this.imgSrc();
    return url && this.failedVariantsFor() !== url ? buildWebpSrcset(url) : null;
  });

  constructor() {
    // Applied imperatively (not host bindings) so plain [src] usages of this
    // directive are never touched. srcset/sizes are set before src so the
    // browser doesn't start fetching the original first.
    effect(() => {
      const url = this.imgSrc();

      if (url === undefined) {
        return;
      }

      const img = this.el.nativeElement;
      const srcset = this.srcset();

      if (srcset) {
        img.setAttribute('sizes', this.imgSizes());
        img.setAttribute('srcset', srcset);
      } else {
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
      }

      img.classList.remove('img-fallback-active');

      if (url) {
        img.setAttribute('src', url);
      } else {
        img.removeAttribute('src');
      }
    });
  }

  @HostListener('error')
  onError(): void {
    const img = this.el.nativeElement;

    if (img.src === FALLBACK_IMAGE) {
      return;
    }

    // First failure with a srcset: retry with the original file only. Removing
    // the attribute directly too, since the signal update is applied on the
    // next change detection pass.
    if (this.srcset()) {
      this.failedVariantsFor.set(this.imgSrc() ?? null);
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      return;
    }

    img.src = FALLBACK_IMAGE;
    img.classList.add('img-fallback-active');
  }
}
