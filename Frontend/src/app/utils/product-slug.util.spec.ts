import { describe, it, expect } from 'vitest';
import { slugify, getProductSlug, parseProductIdFromSlug } from './product-slug.util';

describe('product-slug.util', () => {
  describe('slugify', () => {
    it('converts product names into lower-case hyphenated slugs', () => {
      expect(slugify('Amethyst Tumbled Stone')).toBe('amethyst-tumbled-stone');
    });

    it('strips apostrophes without hyphenation', () => {
      expect(slugify("Golden Tiger's Eye Palm Stone")).toBe('golden-tigers-eye-palm-stone');
      expect(slugify('Fool’s Gold Pyrite')).toBe('fools-gold-pyrite');
    });

    it('replaces special symbols and consecutive spaces with a single hyphen', () => {
      expect(slugify('Moroccan Selenite & Quartz (Limited edition!)')).toBe('moroccan-selenite-quartz-limited-edition');
    });

    it('handles empty or null inputs safely', () => {
      expect(slugify('')).toBe('');
      expect(slugify(null)).toBe('');
      expect(slugify(undefined)).toBe('');
    });
  });

  describe('getProductSlug', () => {
    it('generates hybrid ID-slug format', () => {
      expect(getProductSlug({ productId: 1, name: 'Amethyst Tumbled Stone' })).toBe('1-amethyst-tumbled-stone');
      expect(getProductSlug({ productId: 43, name: 'Rainbow Labradorite Tower' })).toBe('43-rainbow-labradorite-tower');
    });

    it('falls back to numeric ID if name is missing', () => {
      expect(getProductSlug({ productId: 5 })).toBe('5');
    });

    it('returns empty string if product is null', () => {
      expect(getProductSlug(null)).toBe('');
    });
  });

  describe('parseProductIdFromSlug', () => {
    it('extracts product ID from hybrid slug', () => {
      expect(parseProductIdFromSlug('1-amethyst-tumbled-stone')).toBe(1);
      expect(parseProductIdFromSlug('43-rainbow-labradorite-tower')).toBe(43);
    });

    it('extracts product ID from plain numeric string', () => {
      expect(parseProductIdFromSlug('1')).toBe(1);
      expect(parseProductIdFromSlug('123')).toBe(123);
    });

    it('returns NaN for non-numeric input', () => {
      expect(parseProductIdFromSlug('amethyst-tumbled-stone')).toBeNaN();
      expect(parseProductIdFromSlug('')).toBeNaN();
      expect(parseProductIdFromSlug(null)).toBeNaN();
    });
  });
});
