import { getProductCrystalSpecs } from './crystal-specs.util';
import { Product } from '../models/product';

describe('crystal-specs.util', () => {
  const baseProduct: Product = {
    productId: 1,
    sku: 'TST-001',
    name: 'Sample',
    price: 499,
    stockQuantity: 10,
    categoryId: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    images: [],
    zodiacs: []
  };

  it('should return null when product is null or undefined', () => {
    expect(getProductCrystalSpecs(null)).toBeNull();
    expect(getProductCrystalSpecs(undefined)).toBeNull();
  });

  it('should return null for non-crystal products without specs', () => {
    const nonCrystal: Product = {
      ...baseProduct,
      name: 'Velvet Storage Pouch',
      description: 'Soft black velvet pouch with gold drawstring.'
    };
    expect(getProductCrystalSpecs(nonCrystal)).toBeNull();
  });

  it('should resolve archetype specs for Amethyst with affirmation and 3-step ritual', () => {
    const amethyst: Product = {
      ...baseProduct,
      name: 'Amethyst Raw Cluster',
      description: 'Natural soothing purple crystal.'
    };
    const specs = getProductCrystalSpecs(amethyst);
    expect(specs).not.toBeNull();
    expect(specs?.chakra).toContain('Crown');
    expect(specs?.waterSafe).toContain('Yes');
    expect(specs?.affirmation).toContain('intuition');
    expect(specs?.activationRitual.cleanse).toBeTruthy();
    expect(specs?.activationRitual.program).toContain('3 times');
    expect(specs?.activationRitual.anchor).toBeTruthy();
  });

  it('should resolve archetype specs for Selenite warning about water solubility', () => {
    const selenite: Product = {
      ...baseProduct,
      name: 'Selenite Charging Plate',
      description: 'High frequency cleansing stone.'
    };
    const specs = getProductCrystalSpecs(selenite);
    expect(specs).not.toBeNull();
    expect(specs?.waterSafe).toContain('No');
    expect(specs?.waterSafe).toContain('dissolves');
    expect(specs?.affirmation).toBeTruthy();
    expect(specs?.activationRitual).toBeDefined();
  });

  it('should prioritize custom product properties over archetype defaults', () => {
    const customAmethyst: Product = {
      ...baseProduct,
      name: 'Amethyst Raw Cluster',
      waterSafe: 'Special Cleansing Only',
      chakra: 'Custom Astral Chakra'
    };
    const specs = getProductCrystalSpecs(customAmethyst);
    expect(specs).not.toBeNull();
    expect(specs?.waterSafe).toBe('Special Cleansing Only');
    expect(specs?.chakra).toBe('Custom Astral Chakra');
    // Fallback archetype filled missing fields
    expect(specs?.element).toBe('Air & Water');
    expect(specs?.affirmation).toBeTruthy();
  });
});
