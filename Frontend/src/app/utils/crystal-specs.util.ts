import { Product } from '../models/product';

export interface CrystalSpecs {
  waterSafe: string;
  sunlightExposure: string;
  chakra: string;
  element: string;
}

interface MineralArchetype {
  keywords: string[];
  specs: CrystalSpecs;
}

const MINERAL_ARCHETYPES: MineralArchetype[] = [
  {
    keywords: ['amethyst'],
    specs: {
      waterSafe: 'Yes (Rinse gently under running water)',
      sunlightExposure: 'Avoid direct sun (may fade deep purple tones over time)',
      chakra: 'Third Eye & Crown Chakra',
      element: 'Air & Water'
    }
  },
  {
    keywords: ['rose quartz'],
    specs: {
      waterSafe: 'Yes (Safe for short gentle water cleanses)',
      sunlightExposure: 'Avoid prolonged direct sun (may fade delicate pink hue)',
      chakra: 'Heart Chakra',
      element: 'Water & Earth'
    }
  },
  {
    keywords: ['selenite'],
    specs: {
      waterSafe: 'No (Water soluble — Selenite dissolves & degrades in water)',
      sunlightExposure: 'Safe (Charges brilliantly in indirect sunlight & moonlight)',
      chakra: 'Crown & Soul Star Chakra',
      element: 'Air & Light'
    }
  },
  {
    keywords: ['clear quartz'],
    specs: {
      waterSafe: 'Yes (Highly durable & water safe for all cleansing rituals)',
      sunlightExposure: 'Safe (Magnifies natural sunlight and ambient light)',
      chakra: 'All Chakras (Master Healer)',
      element: 'All Elements (Storm, Fire, Air, Earth, Water)'
    }
  },
  {
    keywords: ['citrine'],
    specs: {
      waterSafe: 'Yes (Safe for gentle cool water rinses)',
      sunlightExposure: 'Avoid harsh direct midday sun (thrives in soft morning light)',
      chakra: 'Solar Plexus & Sacral Chakra',
      element: 'Fire'
    }
  },
  {
    keywords: ['pyrite'],
    specs: {
      waterSafe: 'No (Iron disulfide — will oxidize and rust in water)',
      sunlightExposure: 'Safe (Loves golden solar rays for charging abundance)',
      chakra: 'Solar Plexus Chakra',
      element: 'Fire & Earth'
    }
  },
  {
    keywords: ['malachite'],
    specs: {
      waterSafe: 'No (Toxic copper carbonate — keep strictly dry)',
      sunlightExposure: 'Avoid strong sun (keep out of direct heat and moisture)',
      chakra: 'Heart & Throat Chakra',
      element: 'Earth'
    }
  },
  {
    keywords: ['obsidian'],
    specs: {
      waterSafe: 'Yes (Volcanic glass — durable and safe in water)',
      sunlightExposure: 'Safe (Strong grounding energy unaffected by sun)',
      chakra: 'Root Chakra',
      element: 'Earth & Fire'
    }
  },
  {
    keywords: ['tourmaline'],
    specs: {
      waterSafe: 'Yes (Safe for brief rinses; dry thoroughly)',
      sunlightExposure: 'Safe (Excellent grounding stone in all light conditions)',
      chakra: 'Root Chakra',
      element: 'Earth'
    }
  },
  {
    keywords: ['moonstone'],
    specs: {
      waterSafe: 'Yes (Safe for quick cool water cleansing)',
      sunlightExposure: 'Avoid harsh midday heat (charges best under full moonlight)',
      chakra: 'Third Eye & Sacral Chakra',
      element: 'Water'
    }
  },
  {
    keywords: ['labradorite'],
    specs: {
      waterSafe: 'Yes (Brief gentle rinses; avoid harsh salt water)',
      sunlightExposure: 'Safe (Flashes iridescent spectral hues in natural light)',
      chakra: 'Throat & Third Eye Chakra',
      element: 'Water & Air'
    }
  },
  {
    keywords: ['amazonite'],
    specs: {
      waterSafe: 'Yes (Safe for quick gentle water cleanses)',
      sunlightExposure: 'Avoid direct prolonged sun (maintain turquoise vibrancy)',
      chakra: 'Heart & Throat Chakra',
      element: 'Water & Earth'
    }
  },
  {
    keywords: ['tiger eye', "tiger's eye"],
    specs: {
      waterSafe: 'Yes (Dense quartz variety — safe in running water)',
      sunlightExposure: 'Safe (Charges enthusiastically in golden morning sunlight)',
      chakra: 'Solar Plexus & Root Chakra',
      element: 'Fire & Earth'
    }
  },
  {
    keywords: ['carnelian'],
    specs: {
      waterSafe: 'Yes (Safe in cool water; avoid harsh salts)',
      sunlightExposure: 'Safe (Thrives under revitalizing solar energy)',
      chakra: 'Sacral & Root Chakra',
      element: 'Fire'
    }
  },
  {
    keywords: ['lapis', 'lapis lazuli'],
    specs: {
      waterSafe: 'Caution (Contains porous calcite/pyrite — brief damp wipe only)',
      sunlightExposure: 'Avoid intense heat or prolonged direct sun',
      chakra: 'Third Eye & Throat Chakra',
      element: 'Air & Water'
    }
  },
  {
    keywords: ['jade'],
    specs: {
      waterSafe: 'Yes (Highly durable — thoroughly safe in fresh water)',
      sunlightExposure: 'Safe (Enjoys natural gentle morning sunlight)',
      chakra: 'Heart Chakra',
      element: 'Earth & Wood'
    }
  },
  {
    keywords: ['fluorite'],
    specs: {
      waterSafe: 'Caution (Soft mineral Mohs 4 — avoid soaking in water)',
      sunlightExposure: 'Avoid direct sun (vibrant colors can fade)',
      chakra: 'Third Eye & Heart Chakra',
      element: 'Air & Water'
    }
  },
  {
    keywords: ['smoky quartz', 'smokey quartz'],
    specs: {
      waterSafe: 'Yes (Durable quartz — safe for running water cleansing)',
      sunlightExposure: 'Avoid intense direct midday sun to prevent bleaching',
      chakra: 'Root & Solar Plexus Chakra',
      element: 'Earth'
    }
  }
];

/**
 * Resolves crystal healing and care specifications for a product.
 *
 * 1. Checks if explicit custom specs exist in the product record (e.g. from Admin).
 * 2. If any field is missing, attempts to match against known mineral archetypes by name or description.
 * 3. Returns null if the item is not a crystal or has no identifiable mineral properties,
 *    allowing non-crystal products (pouches, books, incense) to cleanly omit the accordion.
 */
export function getProductCrystalSpecs(product: Product | null | undefined): CrystalSpecs | null {
  if (!product) {
    return null;
  }

  const hasCustom =
    Boolean(product.waterSafe?.trim()) ||
    Boolean(product.sunlightExposure?.trim()) ||
    Boolean(product.chakra?.trim()) ||
    Boolean(product.element?.trim());

  // Search for an archetype match based on product name and description
  const searchText = `${product.name} ${product.description ?? ''} ${product.categoryName ?? ''}`.toLowerCase();
  const matchedArchetype = MINERAL_ARCHETYPES.find(arch =>
    arch.keywords.some(kw => searchText.includes(kw))
  );

  if (!hasCustom && !matchedArchetype) {
    return null;
  }

  const fallback = matchedArchetype?.specs ?? {
    waterSafe: 'Safe for gentle cool water cleansing',
    sunlightExposure: 'Best charged in indirect sunlight or moonlight',
    chakra: 'Universal Energy Alignment',
    element: 'Earth & Ether'
  };

  return {
    waterSafe: product.waterSafe?.trim() || fallback.waterSafe,
    sunlightExposure: product.sunlightExposure?.trim() || fallback.sunlightExposure,
    chakra: product.chakra?.trim() || fallback.chakra,
    element: product.element?.trim() || fallback.element
  };
}
