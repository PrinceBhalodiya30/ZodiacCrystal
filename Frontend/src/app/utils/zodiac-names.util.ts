export interface VedicZodiacInfo {
  english: string;
  rashi: string;
  devanagari: string;
  element: string;
  graha: string;
}

export const VEDIC_ZODIAC_DATA: Record<string, VedicZodiacInfo> = {
  Aries: { english: 'Aries', rashi: 'Mesha', devanagari: 'मेष', element: 'Agni (Fire)', graha: 'Mangal (Mars)' },
  Taurus: { english: 'Taurus', rashi: 'Vrishabha', devanagari: 'वृषभ', element: 'Prithvi (Earth)', graha: 'Shukra (Venus)' },
  Gemini: { english: 'Gemini', rashi: 'Mithuna', devanagari: 'मिथुन', element: 'Vayu (Air)', graha: 'Budha (Mercury)' },
  Cancer: { english: 'Cancer', rashi: 'Karka', devanagari: 'कर्क', element: 'Jala (Water)', graha: 'Chandra (Moon)' },
  Leo: { english: 'Leo', rashi: 'Simha', devanagari: 'सिंह', element: 'Agni (Fire)', graha: 'Surya (Sun)' },
  Virgo: { english: 'Virgo', rashi: 'Kanya', devanagari: 'कन्या', element: 'Prithvi (Earth)', graha: 'Budha (Mercury)' },
  Libra: { english: 'Libra', rashi: 'Tula', devanagari: 'तुला', element: 'Vayu (Air)', graha: 'Shukra (Venus)' },
  Scorpio: { english: 'Scorpio', rashi: 'Vrishchika', devanagari: 'वृश्चिक', element: 'Jala (Water)', graha: 'Mangal (Mars)' },
  Sagittarius: { english: 'Sagittarius', rashi: 'Dhanu', devanagari: 'धनु', element: 'Agni (Fire)', graha: 'Guru (Jupiter)' },
  Capricorn: { english: 'Capricorn', rashi: 'Makara', devanagari: 'मकर', element: 'Prithvi (Earth)', graha: 'Shani (Saturn)' },
  Aquarius: { english: 'Aquarius', rashi: 'Kumbha', devanagari: 'कुंभ', element: 'Vayu (Air)', graha: 'Shani (Saturn)' },
  Pisces: { english: 'Pisces', rashi: 'Meena', devanagari: 'मीन', element: 'Jala (Water)', graha: 'Guru (Jupiter)' }
};

export function getVedicZodiacInfo(name: string | null | undefined): VedicZodiacInfo | null {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  for (const [key, value] of Object.entries(VEDIC_ZODIAC_DATA)) {
    if (
      key.toLowerCase() === normalized ||
      value.rashi.toLowerCase() === normalized ||
      normalized.includes(key.toLowerCase()) ||
      normalized.includes(value.rashi.toLowerCase())
    ) {
      return value;
    }
  }
  return null;
}

/**
 * Full dual format for cards & headers:
 * e.g. "Aries · Mesha (मेष)"
 */
export function formatZodiacDual(name: string | null | undefined, customRashi?: string | null): string {
  if (!name) return '';
  if (customRashi && customRashi.trim()) {
    return `${name} · ${customRashi.trim()}`;
  }
  const info = getVedicZodiacInfo(name);
  if (!info) return name;
  return `${info.english} · ${info.rashi} (${info.devanagari})`;
}

/**
 * Compact dual format for tags, dropdowns & admin:
 * e.g. "Aries (Mesha)"
 */
export function formatZodiacCompact(name: string | null | undefined, customRashi?: string | null): string {
  if (!name) return '';
  if (customRashi && customRashi.trim()) {
    return `${name} (${customRashi.trim()})`;
  }
  const info = getVedicZodiacInfo(name);
  if (!info) return name;
  return `${info.english} (${info.rashi})`;
}

/**
 * Rashi with Devanagari:
 * e.g. "Mesha (मेष)"
 */
export function getRashiWithDevanagari(name: string | null | undefined, customRashi?: string | null): string {
  if (customRashi && customRashi.trim()) {
    return customRashi.trim();
  }
  if (!name) return '';
  const info = getVedicZodiacInfo(name);
  if (!info) return '';
  return `${info.rashi} (${info.devanagari})`;
}

/**
 * Simple English Rashi word:
 * e.g. "Mesha"
 */
export function getRashiSimple(name: string | null | undefined, customRashi?: string | null): string {
  if (customRashi && customRashi.trim()) {
    return customRashi.trim().split(/[\s(]/)[0];
  }
  if (!name) return '';
  const info = getVedicZodiacInfo(name);
  if (!info) return '';
  return info.rashi;
}

