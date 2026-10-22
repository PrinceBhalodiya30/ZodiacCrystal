export interface BirthdaySignResult {
  signName: string;
  dateRange: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  rulingPlanet: string;
  traits: string[];
  description: string;
}

/**
 * Calculates the Western Astrological Sun Sign based on birth month and day.
 * Month: 1 (Jan) - 12 (Dec)
 * Day: 1 - 31
 */
export function getZodiacSignByBirthday(month: number, day: number): BirthdaySignResult {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid birth date: month=${month}, day=${day}`);
  }

  switch (month) {
    case 1: // January
      return day <= 19
        ? {
            signName: 'Capricorn',
            dateRange: 'Dec 22 – Jan 19',
            element: 'Earth',
            rulingPlanet: 'Saturn',
            traits: ['Disciplined', 'Ambitious', 'Grounded'],
            description: 'Patient and strategic, Capricorns thrive with stones that support endurance, focus, and abundance.'
          }
        : {
            signName: 'Aquarius',
            dateRange: 'Jan 20 – Feb 18',
            element: 'Air',
            rulingPlanet: 'Uranus',
            traits: ['Visionary', 'Independent', 'Humanitarian'],
            description: 'Innovative and free-spirited, Aquarians resonate with stones that awaken higher vision and inner truth.'
          };

    case 2: // February
      return day <= 18
        ? {
            signName: 'Aquarius',
            dateRange: 'Jan 20 – Feb 18',
            element: 'Air',
            rulingPlanet: 'Uranus',
            traits: ['Visionary', 'Independent', 'Humanitarian'],
            description: 'Innovative and free-spirited, Aquarians resonate with stones that awaken higher vision and inner truth.'
          }
        : {
            signName: 'Pisces',
            dateRange: 'Feb 19 – Mar 20',
            element: 'Water',
            rulingPlanet: 'Neptune',
            traits: ['Intuitive', 'Empathetic', 'Dreamer'],
            description: 'Deeply compassionate and mystical, Pisceans benefit from serene crystals that protect aura energy and ground emotion.'
          };

    case 3: // March
      return day <= 20
        ? {
            signName: 'Pisces',
            dateRange: 'Feb 19 – Mar 20',
            element: 'Water',
            rulingPlanet: 'Neptune',
            traits: ['Intuitive', 'Empathetic', 'Dreamer'],
            description: 'Deeply compassionate and mystical, Pisceans benefit from serene crystals that protect aura energy and ground emotion.'
          }
        : {
            signName: 'Aries',
            dateRange: 'Mar 21 – Apr 19',
            element: 'Fire',
            rulingPlanet: 'Mars',
            traits: ['Pioneering', 'Courageous', 'Passionate'],
            description: 'Bold trailblazers, Ariens thrive with vitalizing stones that channel dynamic willpower and calm fiery impulses.'
          };

    case 4: // April
      return day <= 19
        ? {
            signName: 'Aries',
            dateRange: 'Mar 21 – Apr 19',
            element: 'Fire',
            rulingPlanet: 'Mars',
            traits: ['Pioneering', 'Courageous', 'Passionate'],
            description: 'Bold trailblazers, Ariens thrive with vitalizing stones that channel dynamic willpower and calm fiery impulses.'
          }
        : {
            signName: 'Taurus',
            dateRange: 'Apr 20 – May 20',
            element: 'Earth',
            rulingPlanet: 'Venus',
            traits: ['Steadfast', 'Sensual', 'Abundant'],
            description: 'Lovers of beauty and security, Taureans harmonize with grounding crystals that attract prosperity and open heart energy.'
          };

    case 5: // May
      return day <= 20
        ? {
            signName: 'Taurus',
            dateRange: 'Apr 20 – May 20',
            element: 'Earth',
            rulingPlanet: 'Venus',
            traits: ['Steadfast', 'Sensual', 'Abundant'],
            description: 'Lovers of beauty and security, Taureans harmonize with grounding crystals that attract prosperity and open heart energy.'
          }
        : {
            signName: 'Gemini',
            dateRange: 'May 21 – Jun 20',
            element: 'Air',
            rulingPlanet: 'Mercury',
            traits: ['Curious', 'Expressive', 'Adaptable'],
            description: 'Quick-witted and versatile, Geminis connect with stones that clear mental chatter and amplify joyful communication.'
          };

    case 6: // June
      return day <= 20
        ? {
            signName: 'Gemini',
            dateRange: 'May 21 – Jun 20',
            element: 'Air',
            rulingPlanet: 'Mercury',
            traits: ['Curious', 'Expressive', 'Adaptable'],
            description: 'Quick-witted and versatile, Geminis connect with stones that clear mental chatter and amplify joyful communication.'
          }
        : {
            signName: 'Cancer',
            dateRange: 'Jun 21 – Jul 22',
            element: 'Water',
            rulingPlanet: 'Moon',
            traits: ['Nurturing', 'Intuitive', 'Protective'],
            description: 'Sensitive caretakers, Cancers thrive with gentle moon-aligned stones that provide emotional sanctuary and self-love.'
          };

    case 7: // July
      return day <= 22
        ? {
            signName: 'Cancer',
            dateRange: 'Jun 21 – Jul 22',
            element: 'Water',
            rulingPlanet: 'Moon',
            traits: ['Nurturing', 'Intuitive', 'Protective'],
            description: 'Sensitive caretakers, Cancers thrive with gentle moon-aligned stones that provide emotional sanctuary and self-love.'
          }
        : {
            signName: 'Leo',
            dateRange: 'Jul 23 – Aug 22',
            element: 'Fire',
            rulingPlanet: 'Sun',
            traits: ['Radiant', 'Confident', 'Warm-hearted'],
            description: 'Sun-blessed and magnetic, Leos shine brighter with solar crystals that fuel creativity, leadership, and generous spirit.'
          };

    case 8: // August
      return day <= 22
        ? {
            signName: 'Leo',
            dateRange: 'Jul 23 – Aug 22',
            element: 'Fire',
            rulingPlanet: 'Sun',
            traits: ['Radiant', 'Confident', 'Warm-hearted'],
            description: 'Sun-blessed and magnetic, Leos shine brighter with solar crystals that fuel creativity, leadership, and generous spirit.'
          }
        : {
            signName: 'Virgo',
            dateRange: 'Aug 23 – Sep 22',
            element: 'Earth',
            rulingPlanet: 'Mercury',
            traits: ['Analytical', 'Pure', 'Harmonizing'],
            description: 'Thoughtful perfectionists, Virgos resonate with cleansing stones that ease anxious overthinking and ground practical wisdom.'
          };

    case 9: // September
      return day <= 22
        ? {
            signName: 'Virgo',
            dateRange: 'Aug 23 – Sep 22',
            element: 'Earth',
            rulingPlanet: 'Mercury',
            traits: ['Analytical', 'Pure', 'Harmonizing'],
            description: 'Thoughtful perfectionists, Virgos resonate with cleansing stones that ease anxious overthinking and ground practical wisdom.'
          }
        : {
            signName: 'Libra',
            dateRange: 'Sep 23 – Oct 22',
            element: 'Air',
            rulingPlanet: 'Venus',
            traits: ['Harmonious', 'Diplomatic', 'Graceful'],
            description: 'Seekers of balance and peace, Librans thrive with heart-opening stones that promote fair discernment and romantic harmony.'
          };

    case 10: // October
      return day <= 22
        ? {
            signName: 'Libra',
            dateRange: 'Sep 23 – Oct 22',
            element: 'Air',
            rulingPlanet: 'Venus',
            traits: ['Harmonious', 'Diplomatic', 'Graceful'],
            description: 'Seekers of balance and peace, Librans thrive with heart-opening stones that promote fair discernment and romantic harmony.'
          }
        : {
            signName: 'Scorpio',
            dateRange: 'Oct 23 – Nov 21',
            element: 'Water',
            rulingPlanet: 'Pluto & Mars',
            traits: ['Transformative', 'Magnetic', 'Intuitive'],
            description: 'Fiercely perceptive and profound, Scorpios harness protective grounding crystals that support shadow-work and rebirth.'
          };

    case 11: // November
      return day <= 21
        ? {
            signName: 'Scorpio',
            dateRange: 'Oct 23 – Nov 21',
            element: 'Water',
            rulingPlanet: 'Pluto & Mars',
            traits: ['Transformative', 'Magnetic', 'Intuitive'],
            description: 'Fiercely perceptive and profound, Scorpios harness protective grounding crystals that support shadow-work and rebirth.'
          }
        : {
            signName: 'Sagittarius',
            dateRange: 'Nov 22 – Dec 21',
            element: 'Fire',
            rulingPlanet: 'Jupiter',
            traits: ['Adventurous', 'Philosophical', 'Optimistic'],
            description: 'Truth-seeking explorers, Sagittarians benefit from stones that bring safe travels, lucky abundance, and expansive insight.'
          };

    case 12: // December
    default:
      return day <= 21
        ? {
            signName: 'Sagittarius',
            dateRange: 'Nov 22 – Dec 21',
            element: 'Fire',
            rulingPlanet: 'Jupiter',
            traits: ['Adventurous', 'Philosophical', 'Optimistic'],
            description: 'Truth-seeking explorers, Sagittarians benefit from stones that bring safe travels, lucky abundance, and expansive insight.'
          }
        : {
            signName: 'Capricorn',
            dateRange: 'Dec 22 – Jan 19',
            element: 'Earth',
            rulingPlanet: 'Saturn',
            traits: ['Disciplined', 'Ambitious', 'Grounded'],
            description: 'Patient and strategic, Capricorns thrive with stones that support endurance, focus, and abundance.'
          };
  }
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
