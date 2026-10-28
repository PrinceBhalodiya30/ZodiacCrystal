import { SACRED_INTENTIONS, getIntentionById, productMatchesIntention } from './crystal-intentions.util';
import { Product } from '../models/product';

describe('crystal-intentions.util', () => {
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

  it('should have 6 predefined sacred intentions', () => {
    expect(SACRED_INTENTIONS.length).toBe(6);
    expect(SACRED_INTENTIONS.map(i => i.id)).toEqual([
      'wealth',
      'love',
      'protection',
      'peace',
      'intuition',
      'energy'
    ]);
  });

  it('should resolve intentions by ID or name', () => {
    expect(getIntentionById('wealth')?.name).toBe('Wealth & Success');
    expect(getIntentionById('LOVE')?.id).toBe('love');
    expect(getIntentionById('Peace & Sleep')?.id).toBe('peace');
    expect(getIntentionById(null)).toBeNull();
    expect(getIntentionById('unknown')).toBeNull();
  });

  it('should match Pyrite to wealth intention', () => {
    const pyrite: Product = {
      ...baseProduct,
      name: 'Fool’s Gold Pyrite Cluster Specimen',
      description: 'Known for attracting financial wealth and abundance.'
    };
    const wealth = getIntentionById('wealth')!;
    expect(productMatchesIntention(pyrite, wealth)).toBe(true);
  });

  it('should match Rose Quartz to love intention', () => {
    const roseQuartz: Product = {
      ...baseProduct,
      name: 'Rose Quartz Tumbled Stone',
      description: 'The premier stone of unconditional love and compassion.'
    };
    const love = getIntentionById('love')!;
    expect(productMatchesIntention(roseQuartz, love)).toBe(true);
  });

  it('should not match Black Tourmaline to love intention', () => {
    const tourmaline: Product = {
      ...baseProduct,
      name: 'Black Tourmaline Bookends',
      description: 'Strong aura shielding and grounding.'
    };
    const love = getIntentionById('love')!;
    expect(productMatchesIntention(tourmaline, love)).toBe(false);
  });
});

