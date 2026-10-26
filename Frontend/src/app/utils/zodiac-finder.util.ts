export interface BirthdaySignResult {
  signName: string;
  rashiName: string; // Indian Vedic Rashi name (e.g. 'Mesha (मेष)')
  vedicRuler: string; // Vedic planetary ruler (e.g. 'Mangal (Mars)')
  vedicElement: string; // Vedic element (e.g. 'Agni (Fire)')
  dateRange: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  rulingPlanet: string;
  traits: string[];
  description: string;
}

export const ZODIAC_SIGNS: Record<string, BirthdaySignResult> = {
  Aries: {
    signName: 'Aries',
    rashiName: 'Mesha (मेष)',
    vedicRuler: 'Mangal (Mars)',
    vedicElement: 'Agni (Fire)',
    dateRange: 'Apr 14 – May 14',
    element: 'Fire',
    rulingPlanet: 'Mars',
    traits: ['Pioneering', 'Courageous', 'Passionate'],
    description: 'Bold trailblazers, Ariens (Mesha) thrive with vitalizing stones like Carnelian and Red Jasper that channel dynamic willpower and calm fiery impulses.'
  },
  Taurus: {
    signName: 'Taurus',
    rashiName: 'Vrishabha (वृषभ)',
    vedicRuler: 'Shukra (Venus)',
    vedicElement: 'Prithvi (Earth)',
    dateRange: 'May 15 – Jun 14',
    element: 'Earth',
    rulingPlanet: 'Venus',
    traits: ['Steadfast', 'Sensual', 'Abundant'],
    description: 'Lovers of beauty and security, Taureans (Vrishabha) harmonize with grounding crystals like Rose Quartz and Green Aventurine that attract prosperity and open heart energy.'
  },
  Gemini: {
    signName: 'Gemini',
    rashiName: 'Mithuna (मिथुन)',
    vedicRuler: 'Budha (Mercury)',
    vedicElement: 'Vayu (Air)',
    dateRange: 'Jun 15 – Jul 15',
    element: 'Air',
    rulingPlanet: 'Mercury',
    traits: ['Curious', 'Expressive', 'Adaptable'],
    description: 'Quick-witted and versatile, Geminis (Mithuna) connect with stones like Citrine and Clear Quartz that clear mental chatter and amplify joyful communication.'
  },
  Cancer: {
    signName: 'Cancer',
    rashiName: 'Karka (कर्क)',
    vedicRuler: 'Chandra (Moon)',
    vedicElement: 'Jala (Water)',
    dateRange: 'Jul 16 – Aug 16',
    element: 'Water',
    rulingPlanet: 'Moon',
    traits: ['Nurturing', 'Intuitive', 'Protective'],
    description: 'Sensitive caretakers, Cancers (Karka) thrive with gentle moon-aligned stones like Moonstone and Selenite that provide emotional sanctuary and self-love.'
  },
  Leo: {
    signName: 'Leo',
    rashiName: 'Simha (सिंह)',
    vedicRuler: 'Surya (Sun)',
    vedicElement: 'Agni (Fire)',
    dateRange: 'Aug 17 – Sep 16',
    element: 'Fire',
    rulingPlanet: 'Sun',
    traits: ['Radiant', 'Confident', 'Warm-hearted'],
    description: 'Sun-blessed and magnetic, Leos (Simha) shine brighter with solar crystals like Tiger Eye and Pyrite that fuel vitality, leadership, and generous spirit.'
  },
  Virgo: {
    signName: 'Virgo',
    rashiName: 'Kanya (कन्या)',
    vedicRuler: 'Budha (Mercury)',
    vedicElement: 'Prithvi (Earth)',
    dateRange: 'Sep 17 – Oct 16',
    element: 'Earth',
    rulingPlanet: 'Mercury',
    traits: ['Analytical', 'Pure', 'Harmonizing'],
    description: 'Thoughtful perfectionists, Virgos (Kanya) resonate with cleansing stones like Amazonite and Moss Agate that ease anxious overthinking and ground practical wisdom.'
  },
  Libra: {
    signName: 'Libra',
    rashiName: 'Tula (तुला)',
    vedicRuler: 'Shukra (Venus)',
    vedicElement: 'Vayu (Air)',
    dateRange: 'Oct 17 – Nov 15',
    element: 'Air',
    rulingPlanet: 'Venus',
    traits: ['Harmonious', 'Diplomatic', 'Graceful'],
    description: 'Seekers of balance and peace, Librans (Tula) thrive with heart-opening stones like Lapis Lazuli and Rose Quartz that promote fair discernment and romantic harmony.'
  },
  Scorpio: {
    signName: 'Scorpio',
    rashiName: 'Vrishchika (वृश्चिक)',
    vedicRuler: 'Mangal & Ketu (Pluto/Mars)',
    vedicElement: 'Jala (Water)',
    dateRange: 'Nov 16 – Dec 15',
    element: 'Water',
    rulingPlanet: 'Pluto & Mars',
    traits: ['Transformative', 'Magnetic', 'Intuitive'],
    description: 'Fiercely perceptive and profound, Scorpios (Vrishchika) harness protective grounding crystals like Black Tourmaline and Malachite that support shadow-work and rebirth.'
  },
  Sagittarius: {
    signName: 'Sagittarius',
    rashiName: 'Dhanu (धनु)',
    vedicRuler: 'Brihaspati / Guru (Jupiter)',
    vedicElement: 'Agni (Fire)',
    dateRange: 'Dec 16 – Jan 13',
    element: 'Fire',
    rulingPlanet: 'Jupiter',
    traits: ['Adventurous', 'Philosophical', 'Optimistic'],
    description: 'Truth-seeking explorers, Sagittarians (Dhanu) benefit from stones like Sodalite and Amethyst that bring safe travels, lucky abundance, and expansive insight.'
  },
  Capricorn: {
    signName: 'Capricorn',
    rashiName: 'Makara (मकर)',
    vedicRuler: 'Shani (Saturn)',
    vedicElement: 'Prithvi (Earth)',
    dateRange: 'Jan 14 – Feb 12',
    element: 'Earth',
    rulingPlanet: 'Saturn',
    traits: ['Disciplined', 'Ambitious', 'Grounded'],
    description: 'Patient and strategic, Capricorns (Makara) thrive with stones like Garnet and Smoky Quartz that support endurance, focus, and abundance.'
  },
  Aquarius: {
    signName: 'Aquarius',
    rashiName: 'Kumbha (कुंभ)',
    vedicRuler: 'Shani & Rahu (Uranus)',
    vedicElement: 'Vayu (Air)',
    dateRange: 'Feb 13 – Mar 13',
    element: 'Air',
    rulingPlanet: 'Uranus',
    traits: ['Visionary', 'Independent', 'Humanitarian'],
    description: 'Innovative and free-spirited, Aquarians (Kumbha) resonate with stones like Labradorite and Fluorite that awaken higher vision and inner truth.'
  },
  Pisces: {
    signName: 'Pisces',
    rashiName: 'Meena (मीन)',
    vedicRuler: 'Brihaspati / Guru (Jupiter) & Neptune',
    vedicElement: 'Jala (Water)',
    dateRange: 'Mar 14 – Apr 13',
    element: 'Water',
    rulingPlanet: 'Neptune',
    traits: ['Intuitive', 'Empathetic', 'Dreamer'],
    description: 'Deeply compassionate and mystical, Pisceans (Meena) benefit from serene crystals like Aquamarine and Amethyst that protect aura energy and ground emotion.'
  }
};

/**
 * Calculates the Vedic Astrological Rashi based on birth month and day (Indian Nirayana / Surya Sankranti calendar).
 * Month: 1 (Jan) - 12 (Dec)
 * Day: 1 - 31
 */
export function getZodiacSignByBirthday(month: number, day: number): BirthdaySignResult {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid birth date: month=${month}, day=${day}`);
  }

  let signKey: string;
  switch (month) {
    case 1: // January: Dhanu until Jan 13, Makara from Jan 14 (Makar Sankranti)
      signKey = day <= 13 ? 'Sagittarius' : 'Capricorn';
      break;
    case 2: // February: Makara until Feb 12, Kumbha from Feb 13
      signKey = day <= 12 ? 'Capricorn' : 'Aquarius';
      break;
    case 3: // March: Kumbha until Mar 13, Meena from Mar 14
      signKey = day <= 13 ? 'Aquarius' : 'Pisces';
      break;
    case 4: // April: Meena until Apr 13, Mesha from Apr 14 (Mesh Sankranti / Baisakhi)
      signKey = day <= 13 ? 'Pisces' : 'Aries';
      break;
    case 5: // May: Mesha until May 14, Vrishabha from May 15
      signKey = day <= 14 ? 'Aries' : 'Taurus';
      break;
    case 6: // June: Vrishabha until Jun 14, Mithuna from Jun 15
      signKey = day <= 14 ? 'Taurus' : 'Gemini';
      break;
    case 7: // July: Mithuna until Jul 15, Karka from Jul 16
      signKey = day <= 15 ? 'Gemini' : 'Cancer';
      break;
    case 8: // August: Karka until Aug 16, Simha from Aug 17
      signKey = day <= 16 ? 'Cancer' : 'Leo';
      break;
    case 9: // September: Simha until Sep 16, Kanya from Sep 17
      signKey = day <= 16 ? 'Leo' : 'Virgo';
      break;
    case 10: // October: Kanya until Oct 16, Tula from Oct 17
      signKey = day <= 16 ? 'Virgo' : 'Libra';
      break;
    case 11: // November: Tula until Nov 15, Vrishchika from Nov 16
      signKey = day <= 15 ? 'Libra' : 'Scorpio';
      break;
    case 12: // December: Vrishchika until Dec 15, Dhanu from Dec 16
    default:
      signKey = day <= 15 ? 'Scorpio' : 'Sagittarius';
      break;
  }

  return ZODIAC_SIGNS[signKey];
}

export const MONTH_OPTIONS = [
  { value: 1, name: 'January', maxDays: 31 },
  { value: 2, name: 'February', maxDays: 29 },
  { value: 3, name: 'March', maxDays: 31 },
  { value: 4, name: 'April', maxDays: 30 },
  { value: 5, name: 'May', maxDays: 31 },
  { value: 6, name: 'June', maxDays: 30 },
  { value: 7, name: 'July', maxDays: 31 },
  { value: 8, name: 'August', maxDays: 31 },
  { value: 9, name: 'September', maxDays: 30 },
  { value: 10, name: 'October', maxDays: 31 },
  { value: 11, name: 'November', maxDays: 30 },
  { value: 12, name: 'December', maxDays: 31 }
];
