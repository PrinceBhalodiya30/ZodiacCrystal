import { Product } from '../models/product';

export interface ActivationRitual {
  cleanse: string;
  program: string;
  anchor: string;
}

export interface CrystalSpecs {
  waterSafe: string;
  sunlightExposure: string;
  chakra: string;
  element: string;
  affirmation: string;
  activationRitual: ActivationRitual;
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
      element: 'Air & Water',
      affirmation: 'I am calm, peaceful, and aligned with my highest intuition and inner wisdom.',
      activationRitual: {
        cleanse: 'Bathe under full moonlight or place atop a Selenite charging plate to reset its frequency.',
        program: 'Hold in both palms over your Heart or Third Eye. Inhale tranquility, exhale tension, and speak your affirmation aloud 3 times.',
        anchor: 'Place on your bedside table or meditation space to promote deep restorative peace and sound sleep.'
      }
    }
  },
  {
    keywords: ['rose quartz'],
    specs: {
      waterSafe: 'Yes (Safe for short gentle water cleanses)',
      sunlightExposure: 'Avoid prolonged direct sun (may fade delicate pink hue)',
      chakra: 'Heart Chakra',
      element: 'Water & Earth',
      affirmation: 'I open my heart to give, receive, and nurture unconditional love and compassion.',
      activationRitual: {
        cleanse: 'Rinse briefly under cool fresh water or cleanse with sacred lavender/sage smoke.',
        program: 'Rest the stone over your Heart Chakra. Inhale self-compassion, exhale doubt, and repeat your affirmation 3 times.',
        anchor: 'Display on your vanity, nightstand, or living space to radiate gentle, loving warmth.'
      }
    }
  },
  {
    keywords: ['selenite'],
    specs: {
      waterSafe: 'No (Water soluble — Selenite dissolves & degrades in water)',
      sunlightExposure: 'Safe (Charges brilliantly in indirect sunlight & moonlight)',
      chakra: 'Crown & Soul Star Chakra',
      element: 'Air & Light',
      affirmation: 'I am pure light, elevated in clarity, and liberated from all heavy energy.',
      activationRitual: {
        cleanse: 'Keep dry at all times. Selenite is self-cleansing — rest under moonlight to magnify its glow.',
        program: 'Slowly wave the tower or wand through your aura from crown to root while repeating your mantra.',
        anchor: 'Set near your home entryway or sacred altar to continuously cleanse all surrounding crystals.'
      }
    }
  },
  {
    keywords: ['clear quartz'],
    specs: {
      waterSafe: 'Yes (Highly durable & water safe for all cleansing rituals)',
      sunlightExposure: 'Safe (Magnifies natural sunlight and ambient light)',
      chakra: 'All Chakras (Master Healer)',
      element: 'All Elements (Storm, Fire, Air, Earth, Water)',
      affirmation: 'My mind is crystal clear, my vision is focused, and my intentions manifest with ease.',
      activationRitual: {
        cleanse: 'Wash in flowing water or ring a singing bowl near it to tune its crystalline structure.',
        program: 'Point the crystal termination upward toward the cosmos. Speak your clearest, highest goal into the crystal 3 times.',
        anchor: 'Position at the center of your desk or room as a master energy amplifier.'
      }
    }
  },
  {
    keywords: ['citrine'],
    specs: {
      waterSafe: 'Yes (Safe for gentle cool water rinses)',
      sunlightExposure: 'Avoid harsh direct midday sun (thrives in soft morning light)',
      chakra: 'Solar Plexus & Sacral Chakra',
      element: 'Fire',
      affirmation: 'I joyfully welcome boundless abundance, creative spark, and golden success.',
      activationRitual: {
        cleanse: 'Expose to soft morning sunrise for 30 minutes to absorb vital solar fire energy.',
        program: 'Hold over your Solar Plexus. Visualize golden solar light radiating through your body as you affirm your abundance.',
        anchor: 'Place in the wealth corner of your space (far-left corner from front door) or beside your business register.'
      }
    }
  },
  {
    keywords: ['pyrite'],
    specs: {
      waterSafe: 'No (Iron disulfide — will oxidize and rust in water)',
      sunlightExposure: 'Safe (Loves golden solar rays for charging abundance)',
      chakra: 'Solar Plexus Chakra',
      element: 'Fire & Earth',
      affirmation: 'I am worthy of wealth, unstoppable confidence, and golden prosperous opportunities.',
      activationRitual: {
        cleanse: 'Never use water. Clear with sacred Palo Santo smoke or rest atop dry Himalayan salt crystals.',
        program: 'Grip the metallic specimen in your dominant hand. Feel its grounding weight and declare your financial sovereignty.',
        anchor: 'Keep on your work desk, beside your financial books, or where business decisions are made.'
      }
    }
  },
  {
    keywords: ['malachite'],
    specs: {
      waterSafe: 'No (Toxic copper carbonate — keep strictly dry)',
      sunlightExposure: 'Avoid strong sun (keep out of direct heat and moisture)',
      chakra: 'Heart & Throat Chakra',
      element: 'Earth',
      affirmation: 'I welcome positive transformation, emotional rebirth, and fierce protection of my heart.',
      activationRitual: {
        cleanse: 'Keep dry. Place on a Selenite slab or smudge with sweetgrass to transmute absorbed energies.',
        program: 'Place near your heart. Trace its concentric bands with your eyes and declare your willingness to evolve.',
        anchor: 'Display in your office or living room to encourage bold breakthroughs and shield against negativity.'
      }
    }
  },
  {
    keywords: ['obsidian'],
    specs: {
      waterSafe: 'Yes (Volcanic glass — durable and safe in water)',
      sunlightExposure: 'Safe (Strong grounding energy unaffected by sun)',
      chakra: 'Root Chakra',
      element: 'Earth & Fire',
      affirmation: 'I am deeply anchored, protected from all negativity, and secure in my sacred boundary.',
      activationRitual: {
        cleanse: 'Rinse under cold running water or bury in garden soil overnight for deep planetary reset.',
        program: 'Hold firmly at your root center. State with authority: "Negative energy has no home here."',
        anchor: 'Position near your entryway, front door, or windowsill to block external intrusive energies.'
      }
    }
  },
  {
    keywords: ['tourmaline'],
    specs: {
      waterSafe: 'Yes (Safe for brief rinses; dry thoroughly)',
      sunlightExposure: 'Safe (Excellent grounding stone in all light conditions)',
      chakra: 'Root Chakra',
      element: 'Earth',
      affirmation: 'I am shielded in an impenetrable cloak of protective light and grounded serenity.',
      activationRitual: {
        cleanse: 'Smudge with sage smoke or sound with a singing bowl; dry completely after brief rinses.',
        program: 'Hold the striated stone in both hands. Visualize roots traveling from your feet deep into the earth.',
        anchor: 'Keep beside computers, Wi-Fi routers, or at the entrance of your home sanctuary.'
      }
    }
  },
  {
    keywords: ['moonstone'],
    specs: {
      waterSafe: 'Yes (Safe for quick cool water cleansing)',
      sunlightExposure: 'Avoid harsh midday heat (charges best under full moonlight)',
      chakra: 'Third Eye & Sacral Chakra',
      element: 'Water',
      affirmation: 'I honor my cyclical intuition, emotional wisdom, and sacred new beginnings.',
      activationRitual: {
        cleanse: 'Place on a windowsill or outdoor altar under the waxing or full moon.',
        program: 'Gaze into its mystical blue or rainbow sheen. Whisper your heartfelt dreams 3 times.',
        anchor: 'Keep beneath your pillow or on your vanity to inspire lucid dreams and intuitive insight.'
      }
    }
  },
  {
    keywords: ['labradorite'],
    specs: {
      waterSafe: 'Yes (Brief gentle rinses; avoid harsh salt water)',
      sunlightExposure: 'Safe (Flashes iridescent spectral hues in natural light)',
      chakra: 'Throat & Third Eye Chakra',
      element: 'Water & Air',
      affirmation: 'I awaken my inner magic, trust divine synchronicities, and transcend all limits.',
      activationRitual: {
        cleanse: 'Cleanse with cedar or sage smoke; charge under twilight or starry night skies.',
        program: 'Turn the stone until its iridescent labradorescence flashes. Focus on your third eye and state your vision.',
        anchor: 'Place in your creative studio or altar to ignite limitless inspiration and synchronicity.'
      }
    }
  },
  {
    keywords: ['amazonite'],
    specs: {
      waterSafe: 'Yes (Safe for quick gentle water cleanses)',
      sunlightExposure: 'Avoid direct prolonged sun (maintain turquoise vibrancy)',
      chakra: 'Heart & Throat Chakra',
      element: 'Water & Earth',
      affirmation: 'I communicate with courageous truth, calm confidence, and loving grace.',
      activationRitual: {
        cleanse: 'Rinse briefly in fresh cool water; charge in dappled shade under leafy trees.',
        program: 'Hold to your heart and throat simultaneously to connect your genuine inner feelings to speech.',
        anchor: 'Keep beside your phone, journal, or desk to foster honest and soothing expression.'
      }
    }
  },
  {
    keywords: ['tiger eye', "tiger's eye"],
    specs: {
      waterSafe: 'Yes (Dense quartz variety — safe in running water)',
      sunlightExposure: 'Safe (Charges enthusiastically in golden morning sunlight)',
      chakra: 'Solar Plexus & Root Chakra',
      element: 'Fire & Earth',
      affirmation: 'I am bold, courageous, grounded in willpower, and clear in my purpose.',
      activationRitual: {
        cleanse: 'Rinse in cool water, then charge in morning golden sunlight for 1 hour.',
        program: 'Hold in both palms, feeling the tiger-stripe chatoyancy. Channel unwavering solar willpower.',
        anchor: 'Keep in your briefcase, car dashboard, or office to inspire confident decision-making.'
      }
    }
  },
  {
    keywords: ['carnelian'],
    specs: {
      waterSafe: 'Yes (Safe in cool water; avoid harsh salts)',
      sunlightExposure: 'Safe (Thrives under revitalizing solar energy)',
      chakra: 'Sacral & Root Chakra',
      element: 'Fire',
      affirmation: 'My creative fire burns brightly, fueling my passion, stamina, and zest for life.',
      activationRitual: {
        cleanse: 'Rinse under running water; re-energize in vibrant daylight.',
        program: 'Rest over your Sacral Chakra (below the navel). Inhale vital warmth and speak your creative pledge.',
        anchor: 'Keep in your workout space, studio, or kitchen to cultivate vibrant, joyful momentum.'
      }
    }
  },
  {
    keywords: ['lapis', 'lapis lazuli'],
    specs: {
      waterSafe: 'Caution (Contains porous calcite/pyrite — brief damp wipe only)',
      sunlightExposure: 'Avoid intense heat or prolonged direct sun',
      chakra: 'Third Eye & Throat Chakra',
      element: 'Air & Water',
      affirmation: 'I speak my truth with calm clarity, royal authenticity, and boundless wisdom.',
      activationRitual: {
        cleanse: 'Wipe gently with a soft dry cloth; charge under starlight or crescent moon.',
        program: 'Hold near your throat. Speak aloud with clarity the truths and visions you wish to express.',
        anchor: 'Place in your study, library, or communications hub to elevate thoughtful dialogue.'
      }
    }
  },
  {
    keywords: ['jade'],
    specs: {
      waterSafe: 'Yes (Highly durable — thoroughly safe in fresh water)',
      sunlightExposure: 'Safe (Enjoys natural gentle morning sunlight)',
      chakra: 'Heart Chakra',
      element: 'Earth & Wood',
      affirmation: 'I live in harmony, attracting good fortune, vitality, and serene longevity.',
      activationRitual: {
        cleanse: 'Rinse in flowing natural water; let air dry in gentle green morning garden light.',
        program: 'Hold while breathing in peace and exhaling anxiety; whisper your prayer for abundance.',
        anchor: 'Place in your living space or meditation nook to invite calming auspicious harmony.'
      }
    }
  },
  {
    keywords: ['fluorite'],
    specs: {
      waterSafe: 'Caution (Soft mineral Mohs 4 — avoid soaking in water)',
      sunlightExposure: 'Avoid direct sun (vibrant colors can fade)',
      chakra: 'Third Eye & Heart Chakra',
      element: 'Air & Water',
      affirmation: 'My mind is organized, my focus is sharp, and I absorb knowledge effortlessly.',
      activationRitual: {
        cleanse: 'Cleanse with sound bowls or gentle sage; avoid water soaking and direct heat.',
        program: 'Touch the point or tower to your forehead before beginning work or deep study.',
        anchor: 'Place between your keyboard and monitor to banish brain fog and mental chaos.'
      }
    }
  },
  {
    keywords: ['smoky quartz', 'smokey quartz'],
    specs: {
      waterSafe: 'Yes (Durable quartz — safe for running water cleansing)',
      sunlightExposure: 'Avoid intense direct midday sun to prevent bleaching',
      chakra: 'Root & Solar Plexus Chakra',
      element: 'Earth',
      affirmation: 'I release what no longer serves me and ground into peaceful emotional stability.',
      activationRitual: {
        cleanse: 'Wash with fresh water or bury in natural soil for an afternoon to discharge tension.',
        program: 'Exhale heavy thoughts into the stone; affirm: "I surrender doubt and choose peace."',
        anchor: 'Place on your lower desk or living room floor to dissolve ambient environmental stress.'
      }
    }
  }
];

export const DEFAULT_SPECS: CrystalSpecs = {
  waterSafe: 'Safe for gentle cool water cleansing',
  sunlightExposure: 'Best charged in indirect sunlight or moonlight',
  chakra: 'Universal Energy Alignment',
  element: 'Earth & Ether',
  affirmation: 'I am attuned to the healing frequency of nature, balanced in body, mind, and spirit.',
  activationRitual: {
    cleanse: 'Cleanse with sacred smoke, sound, or gentle moonlight to clear prior energies.',
    program: 'Hold the specimen quietly in both hands, breathe deeply, and state your personal intention 3 times.',
    anchor: 'Place in your sacred living space, meditation altar, or workspace to anchor harmony.'
  }
};

/**
 * Resolves crystal healing, affirmation, activation rituals and care specifications for a product.
 *
 * 1. Checks if explicit custom specs exist in the product record (e.g. from Admin).
 * 2. If any field is missing, attempts to match against known mineral archetypes by name or description.
 * 3. Returns null if the item is not a crystal or has no identifiable mineral properties.
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

  const fallback = matchedArchetype?.specs ?? DEFAULT_SPECS;

  return {
    waterSafe: product.waterSafe?.trim() || fallback.waterSafe,
    sunlightExposure: product.sunlightExposure?.trim() || fallback.sunlightExposure,
    chakra: product.chakra?.trim() || fallback.chakra,
    element: product.element?.trim() || fallback.element,
    affirmation: fallback.affirmation,
    activationRitual: fallback.activationRitual
  };
}
