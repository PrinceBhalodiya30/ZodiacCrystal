/**
 * Converts text into an SEO-friendly URL slug.
 * E.g. "Amethyst Tumbled Stone" -> "amethyst-tumbled-stone"
 * "Golden Tiger's Eye Palm Stone" -> "golden-tigers-eye-palm-stone"
 */
export function slugify(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Creates the hybrid SEO slug for product URLs.
 * E.g. { productId: 1, name: "Amethyst Tumbled Stone" } -> "1-amethyst-tumbled-stone"
 */
export function getProductSlug(product: { productId: number; name?: string } | null | undefined): string {
  if (!product || !product.productId) {
    return '';
  }

  const slug = slugify(product.name);
  return slug ? `${product.productId}-${slug}` : `${product.productId}`;
}

/**
 * Extracts the numeric productId from either a plain ID ("1") or a hybrid slug ("1-amethyst-tumbled-stone").
 * Returns NaN if no valid numeric ID is found at the beginning.
 */
export function parseProductIdFromSlug(param: string | null | undefined): number {
  if (!param) {
    return NaN;
  }

  const match = /^(\d+)/.exec(param.trim());
  return match ? parseInt(match[1], 10) : NaN;
}
