import { Product } from '../models/product';

export function getPrimaryImageUrl(product: Product): string | null {
  if (!product.images || product.images.length === 0) {
    return null;
  }

  const primary = product.images.find(image => image.isPrimary);
  return (primary ?? product.images[0]).imageUrl;
}

// Widths the backend generates as WebP next to each uploaded product image
// (name-400.webp, name-800.webp, name-1200.webp) - see ImageVariantService.cs.
const VARIANT_WIDTHS = [400, 800, 1200];
const UPLOADED_IMAGE_PATTERN = /^(.*\/uploads\/products\/[^/?#]+)\.(jpe?g|png|webp)$/i;

// Builds a WebP srcset for our own uploaded images, or null for anything else
// (external stock-photo URLs, data URIs) which have no generated variants.
// Older uploads may lack variants too - ImgFallbackDirective drops the srcset
// on error so the original URL still shows.
export function buildWebpSrcset(url: string | null | undefined): string | null {
  const match = url ? UPLOADED_IMAGE_PATTERN.exec(url) : null;

  if (!match) {
    return null;
  }

  return VARIANT_WIDTHS.map(width => `${match[1]}-${width}.webp ${width}w`).join(', ');
}
