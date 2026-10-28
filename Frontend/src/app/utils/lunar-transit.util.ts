import { VEDIC_ZODIAC_DATA } from './zodiac-names.util';

export interface MoonSignInfo {
  name: string;
  symbol: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  rashi: string;
  devanagari: string;
  graha: string;
  transitEnergy: string;
  dailyFocus: string;
}

export interface CrystalRecommendation {
  name: string;
  benefit: string;
  intention: string;
  searchTerm: string;
  ritualTip: string;
}

export interface LunarTransitData {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  phaseName: string;
  phaseIcon: string;
  phaseEssence: string;
  illuminationPct: number;
  sign: MoonSignInfo;
  crystal: CrystalRecommendation;
  tickerText: string;
}

// 12 Zodiac transit attributes and crystal alignments
const ZODIAC_TRANSIT_PROFILES: Record<string, {
  transitEnergy: string;
  dailyFocus: string;
  crystal: CrystalRecommendation;
}> = {
  Aries: {
    transitEnergy: 'Courage, Fresh Momentum & Vitality',
    dailyFocus: 'Igniting new projects and stepping forward with bold confidence',
    crystal: {
      name: 'Carnelian',
      benefit: 'Courage & Vitality',
      intention: 'Ignite passionate action and break through procrastination',
      searchTerm: 'Carnelian',
      ritualTip: 'Hold Carnelian over your sacral chakra and state your boldest goal for the week.'
    }
  },
  Taurus: {
    transitEnergy: 'Grounding, Sensuality & Emotional Harmony',
    dailyFocus: 'Slowing down, cultivating inner calm and honoring self-worth',
    crystal: {
      name: 'Rose Quartz',
      benefit: 'Inner Peace & Compassion',
      intention: 'Open your heart to unconditional self-love and soothing comfort',
      searchTerm: 'Rose Quartz',
      ritualTip: 'Rest Rose Quartz on your chest while taking three deep, calming breaths.'
    }
  },
  Gemini: {
    transitEnergy: 'Mental Balance, Curiosity & Articulate Expression',
    dailyFocus: 'Sharing ideas, clearing mental chatter, and embracing joyful learning',
    crystal: {
      name: 'Clear Quartz',
      benefit: 'Clarity & Focus',
      intention: 'Magnify mental clarity, articulate truth, and balance high mental energy',
      searchTerm: 'Clear Quartz',
      ritualTip: 'Hold Clear Quartz during journaling or planning to channel crisp mental clarity.'
    }
  },
  Cancer: {
    transitEnergy: 'Intuition, Emotional Depth & Sacred Rest',
    dailyFocus: 'Listening to your gut instincts, nurturing home, and gentle emotional release',
    crystal: {
      name: 'Moonstone',
      benefit: 'Intuition & Emotional Healing',
      intention: 'Deepen intuitive dreams, soothe sensitive emotions, and honor cycles of change',
      searchTerm: 'Moonstone',
      ritualTip: 'Place Moonstone near your bedside to awaken vivid, guiding dreams tonight.'
    }
  },
  Leo: {
    transitEnergy: 'Radiance, Creative Fire & Self-Expression',
    dailyFocus: 'Sharing your authentic light, celebrating achievements, and inspiring others',
    crystal: {
      name: 'Pyrite',
      benefit: 'Confidence & Abundance',
      intention: 'Channel golden solar vitality, attract prosperity, and radiate magnetic warmth',
      searchTerm: 'Pyrite',
      ritualTip: 'Place Pyrite in your workspace to attract lucrative opportunities and golden focus.'
    }
  },
  Virgo: {
    transitEnergy: 'Mindful Healing, Purification & Grounded Order',
    dailyFocus: 'Detoxifying thoughts, organizing your space, and nurturing personal wellness',
    crystal: {
      name: 'Amazonite',
      benefit: 'Calm & Heart-Mind Harmony',
      intention: 'Soothe nervous tension, silence overthinking, and speak heartfelt truth',
      searchTerm: 'Amazonite',
      ritualTip: 'Rub an Amazonite worry stone when perfectionism or busy thoughts arise.'
    }
  },
  Libra: {
    transitEnergy: 'Peaceful Balance, Beauty & Relational Harmony',
    dailyFocus: 'Harmonizing relationships, bringing aesthetic beauty to surroundings, and making peaceful choices',
    crystal: {
      name: 'Lapis Lazuli',
      benefit: 'Wisdom & Harmonious Truth',
      intention: 'Facilitate peaceful agreements, authentic self-expression, and mental serenity',
      searchTerm: 'Lapis Lazuli',
      ritualTip: 'Touch Lapis Lazuli to your third-eye center to align honest communication with kindness.'
    }
  },
  Scorpio: {
    transitEnergy: 'Transformation, Emotional Power & Mystic Insight',
    dailyFocus: 'Releasing old attachments, shedding emotional armor, and trusting rebirth',
    crystal: {
      name: 'Black Obsidian',
      benefit: 'Grounding & Energetic Shielding',
      intention: 'Cleanse dense heavy aura, transmute shadows, and ground deeply into strength',
      searchTerm: 'Black Obsidian',
      ritualTip: 'Hold Black Obsidian during evening meditation to absorb and dissolve lingering fatigue.'
    }
  },
  Sagittarius: {
    transitEnergy: 'Expansion, Spiritual Wisdom & Uplifting Optimism',
    dailyFocus: 'Broadening philosophical horizons, seeking truth, and welcoming serendipity',
    crystal: {
      name: 'Amethyst',
      benefit: 'Spiritual Vision & Serenity',
      intention: 'Awaken higher consciousness, calm an overactive mind, and protect your aura',
      searchTerm: 'Amethyst',
      ritualTip: 'Sit quietly with Amethyst during quiet evening reflection to invite spiritual clarity.'
    }
  },
  Capricorn: {
    transitEnergy: 'Structure, Perseverance & Steadfast Foundations',
    dailyFocus: 'Mastering long-term goals, honoring discipline, and grounding practical wisdom',
    crystal: {
      name: 'Black Tourmaline',
      benefit: 'Resilience & Deep Grounding',
      intention: 'Deflect stressful environmental vibrations and establish unbreakable boundaries',
      searchTerm: 'Black Tourmaline',
      ritualTip: 'Keep Black Tourmaline near your doorway or desk to anchor stable, peaceful energy.'
    }
  },
  Aquarius: {
    transitEnergy: 'Innovation, Higher Vision & Collective Awakening',
    dailyFocus: 'Thinking outside conventions, embracing individuality, and dreaming up the future',
    crystal: {
      name: 'Labradorite',
      benefit: 'Intuitive Insight & Magic',
      intention: 'Stimulate unexpected breakthroughs, synchronicities, and expand intuitive perception',
      searchTerm: 'Labradorite',
      ritualTip: 'Turn Labradorite in the natural light to activate its flash and spark creative ideas.'
    }
  },
  Pisces: {
    transitEnergy: 'Dreamwork, Spiritual Flow & Soul Compassion',
    dailyFocus: 'Meditative stillness, artistic flow, deep empathy, and connecting with divine source',
    crystal: {
      name: 'Aquamarine',
      benefit: 'Serene Flow & Soul Healing',
      intention: 'Release rigid resistance, ride emotional waves with grace, and quiet the spirit',
      searchTerm: 'Aquamarine',
      ritualTip: 'Cleanse Aquamarine with fresh cool water and visualize worries dissolving away.'
    }
  }
};

const ZODIAC_SIGNS_LIST: Array<{ name: string; symbol: string; element: 'Fire' | 'Earth' | 'Air' | 'Water' }> = [
  { name: 'Aries', symbol: '♈', element: 'Fire' },
  { name: 'Taurus', symbol: '♉', element: 'Earth' },
  { name: 'Gemini', symbol: '♊', element: 'Air' },
  { name: 'Cancer', symbol: '♋', element: 'Water' },
  { name: 'Leo', symbol: '♌', element: 'Fire' },
  { name: 'Virgo', symbol: '♍', element: 'Earth' },
  { name: 'Libra', symbol: '♎', element: 'Air' },
  { name: 'Scorpio', symbol: '♏', element: 'Water' },
  { name: 'Sagittarius', symbol: '♐', element: 'Fire' },
  { name: 'Capricorn', symbol: '♑', element: 'Earth' },
  { name: 'Aquarius', symbol: '♒', element: 'Air' },
  { name: 'Pisces', symbol: '♓', element: 'Water' }
];

/**
 * High-precision astronomical calculation of the Moon's phase and current
 * tropical zodiac transit, following standard Jean Meeus astronomical algorithms.
 * Runs instantly in pure JavaScript without any network roundtrips.
 */
export function getMoonPhaseAndTransit(date: Date = new Date()): LunarTransitData {
  const time = date.getTime();
  const JD = (time / 86400000) + 2440587.5;
  const T = (JD - 2451545.0) / 36525;
  const d2r = Math.PI / 180;

  // Moon's mean elements (degrees)
  const Lp = 218.3164477 + 481267.88128 * T;
  const D  = 297.8501921 + 445267.11140 * T;
  const M  = 357.5291092 + 35999.05029 * T;
  const Mp = 134.9633964 + 477198.86750 * T;
  const F  = 93.2720950 + 483202.01752 * T;

  // Periodic perturbation terms for Moon's true longitude
  let l = Lp 
    + 6.288774 * Math.sin(Mp * d2r)
    + 1.274027 * Math.sin((2 * D - Mp) * d2r)
    + 0.658309 * Math.sin(2 * D * d2r)
    + 0.213618 * Math.sin(2 * Mp * d2r)
    - 0.185116 * Math.sin(M * d2r)
    - 0.114332 * Math.sin(2 * F * d2r)
    + 0.058793 * Math.sin((2 * D - 2 * Mp) * d2r)
    + 0.057066 * Math.sin((2 * D - M - Mp) * d2r)
    + 0.053322 * Math.sin((2 * D + Mp) * d2r)
    + 0.045758 * Math.sin((2 * D - M) * d2r);

  l = ((l % 360) + 360) % 360;

  // Sun's true longitude approximation
  const Ls = 280.46646 + 36000.76983 * T;
  const sunLong = Ls + 1.914602 * Math.sin(M * d2r) + 0.019993 * Math.sin(2 * M * d2r);
  const elongation = ((l - sunLong) % 360 + 360) % 360;

  // Illumination percentage
  const illuminationPct = Math.round(((1 - Math.cos(elongation * d2r)) / 2) * 100);

  // Phase classification
  let phaseName = '';
  let phaseIcon = '';
  let phaseEssence = '';

  if (elongation >= 350 || elongation < 10) {
    phaseName = 'New Moon';
    phaseIcon = '🌑';
    phaseEssence = 'New Beginnings & Intention Setting';
  } else if (elongation < 80) {
    phaseName = 'Waxing Crescent';
    phaseIcon = '🌒';
    phaseEssence = 'Fresh Momentum & Planting Seeds';
  } else if (elongation < 100) {
    phaseName = 'First Quarter';
    phaseIcon = '🌓';
    phaseEssence = 'Overcoming Resistance & Focused Action';
  } else if (elongation < 170) {
    phaseName = 'Waxing Gibbous';
    phaseIcon = '🌔';
    phaseEssence = 'Refining Intentions & Cultivating Growth';
  } else if (elongation < 190) {
    phaseName = 'Full Moon';
    phaseIcon = '🌕';
    phaseEssence = 'Peak Illumination, Gratitude & Release';
  } else if (elongation < 260) {
    phaseName = 'Waning Gibbous';
    phaseIcon = '🌖';
    phaseEssence = 'Sharing Wisdom & Giving Thanks';
  } else if (elongation < 280) {
    phaseName = 'Last Quarter';
    phaseIcon = '🌗';
    phaseEssence = 'Forgiveness, Letting Go & Transition';
  } else {
    phaseName = 'Waning Crescent';
    phaseIcon = '🌘';
    phaseEssence = 'Deep Rest, Cleansing & Surrender';
  }

  // Zodiac sign
  const signIndex = Math.min(11, Math.max(0, Math.floor(l / 30)));
  const baseSign = ZODIAC_SIGNS_LIST[signIndex];
  const vedic = VEDIC_ZODIAC_DATA[baseSign.name] || {
    english: baseSign.name,
    rashi: baseSign.name,
    devanagari: '',
    element: baseSign.element,
    graha: ''
  };

  const profile = ZODIAC_TRANSIT_PROFILES[baseSign.name] || ZODIAC_TRANSIT_PROFILES['Taurus'];

  const signInfo: MoonSignInfo = {
    name: baseSign.name,
    symbol: baseSign.symbol,
    element: baseSign.element,
    rashi: vedic.rashi,
    devanagari: vedic.devanagari,
    graha: vedic.graha,
    transitEnergy: profile.transitEnergy,
    dailyFocus: profile.dailyFocus
  };

  // Date key for daily caching / dismissal
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;

  const tickerText = `${phaseIcon} ${phaseName} in ${signInfo.name} · Best Crystal Today: ${profile.crystal.name} for ${profile.crystal.benefit}`;

  return {
    date,
    dateKey,
    phaseName,
    phaseIcon,
    phaseEssence,
    illuminationPct,
    sign: signInfo,
    crystal: profile.crystal,
    tickerText
  };
}

