import { Component, Input } from '@angular/core';

export type ZodiacIconKey =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces'
  | 'unknown';

const KNOWN_SIGNS: ZodiacIconKey[] = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
];

// The real, standard Unicode glyph per sign. It is drawn with the Noto Sans
// Symbols web font (loaded in index.html) rather than whatever the device has,
// so every browser shows the exact standard shape - never a purple emoji tile.
const SIGN_GLYPHS: Record<ZodiacIconKey, string> = {
  aries: '\u2648',
  taurus: '\u2649',
  gemini: '\u264A',
  cancer: '\u264B',
  leo: '\u264C',
  virgo: '\u264D',
  libra: '\u264E',
  scorpio: '\u264F',
  sagittarius: '\u2650',
  capricorn: '\u2651',
  aquarius: '\u2652',
  pisces: '\u2653',
  unknown: '\u2726'
};

const RASHI_ALIASES: Record<string, ZodiacIconKey> = {
  mesha: 'aries',
  mesh: 'aries',
  vrishabha: 'taurus',
  vrishabh: 'taurus',
  mithuna: 'gemini',
  mithun: 'gemini',
  karka: 'cancer',
  kark: 'cancer',
  simha: 'leo',
  singh: 'leo',
  kanya: 'virgo',
  tula: 'libra',
  vrishchika: 'scorpio',
  vrishchik: 'scorpio',
  dhanu: 'sagittarius',
  makara: 'capricorn',
  makar: 'capricorn',
  kumbha: 'aquarius',
  kumbh: 'aquarius',
  meena: 'pisces',
  meen: 'pisces'
};

export const ZODIAC_PATHS: Record<ZodiacIconKey, string> = {
  aries: 'M 4.5,9.5 C 4.5,6.5 6.5,4.5 9,4.5 C 11.2,4.5 12,6.8 12,19.5 M 12,19.5 C 12,6.8 12.8,4.5 15,4.5 C 17.5,4.5 19.5,6.5 19.5,9.5',
  taurus: 'M 5.5,5 C 6.5,8.5 9,10.5 12,10.5 C 15,10.5 17.5,8.5 18.5,5 M 12,10.5 A 5.5,5.5 0 1,0 12,21.5 A 5.5,5.5 0 1,0 12,10.5',
  gemini: 'M 4.5,4.5 C 8,6 16,6 19.5,4.5 M 4.5,19.5 C 8,18 16,18 19.5,19.5 M 8.5,5.5 L 8.5,18.5 M 15.5,5.5 L 15.5,18.5',
  cancer: 'M 3,12 A 3,3 0 1,0 9,12 A 3,3 0 1,0 3,12 M 15,12 A 3,3 0 1,0 21,12 A 3,3 0 1,0 15,12 M 3,12 A 10,6.5 0 0,1 17,5.5 M 21,12 A 10,6.5 0 0,1 7,18.5',
  leo: 'M 4,15 A 2.5,2.5 0 1,0 9,15 A 2.5,2.5 0 1,0 4,15 M 6.5,12.5 C 6.5,7 10,4.5 14,4.5 C 18,4.5 19.5,7.5 19,12 C 18.5,16 16,17.5 17.5,19.5 C 18.5,20.5 20,19.5 20.5,18',
  virgo: 'M 4,18 L 4,7 C 4,5 5.5,4.5 7,4.5 C 8.5,4.5 10,5.5 10,7.5 L 10,18 M 10,7.5 C 10,5.5 11.5,4.5 13,4.5 C 14.5,4.5 16,5.5 16,7.5 L 16,16 C 16,19 13.5,19.5 13,16.5 C 12.5,13.5 15,13 17,13 L 20,19',
  libra: 'M 4.5,19 L 19.5,19 M 4.5,14 L 8.5,14 A 3.5,3.5 0 0,1 15.5,14 L 19.5,14',
  scorpio: 'M 3.5,18 L 3.5,7 C 3.5,5 5,4.5 6.5,4.5 C 8,4.5 9.5,5.5 9.5,7.5 L 9.5,18 M 9.5,7.5 C 9.5,5.5 11,4.5 12.5,4.5 C 14,4.5 15.5,5.5 15.5,7.5 L 15.5,15.5 C 15.5,18.5 18,19 19.5,16.5 L 21,14.5 M 17,14.5 L 21,14.5 L 21,18.5',
  sagittarius: 'M 5.5,18.5 L 18.5,5.5 M 13.5,5.5 L 18.5,5.5 L 18.5,10.5 M 8.5,11.5 L 12.5,15.5',
  capricorn: 'M 4,6 L 7.5,15 L 11,5 C 11.5,4.5 12.5,4.5 13,5 C 14,6 14,8 14,11 L 14,15 C 14,18.5 16.5,19.5 18,18 C 19.5,16.5 19,14 17,13.5 C 15,13 14,15 15,17 L 17.5,20',
  aquarius: 'M 4.5,8.5 L 7.5,6 L 10.5,8.5 L 13.5,6 L 16.5,8.5 L 19.5,6 M 4.5,15.5 L 7.5,13 L 10.5,15.5 L 13.5,13 L 16.5,15.5 L 19.5,13',
  pisces: 'M 7,4.5 C 9,8.5 9,15.5 7,19.5 M 17,4.5 C 15,8.5 15,15.5 17,19.5 M 4.5,12 L 19.5,12',
  unknown: 'M 12,3 L 14,9 L 20,12 L 14,15 L 12,21 L 10,15 L 4,12 L 10,9 Z'
};

// Maps a zodiac sign name (as free-typed by an admin, e.g. "Aries", "aries ", "Mesha")
// to one of the 12 known signs, falling back to a neutral sparkle glyph for
// anything unrecognized instead of breaking the layout.
export function resolveZodiacIconKey(name: string | undefined | null): ZodiacIconKey {
  if (!name) {
    return 'unknown';
  }

  const normalized = name.trim().toLowerCase();
  const directMatch = KNOWN_SIGNS.find(sign => normalized.includes(sign));
  if (directMatch) return directMatch;

  for (const [rashi, sign] of Object.entries(RASHI_ALIASES)) {
    if (normalized.includes(rashi)) return sign;
  }

  return 'unknown';
}

@Component({
  selector: 'app-zodiac-icon',
  standalone: true,
  templateUrl: './zodiac-icon.html',
  styleUrl: './zodiac-icon.css'
})
export class ZodiacIcon {
  @Input({ required: true }) sign!: string;
  @Input() strokeWidth = 1.85;
  @Input() variant: 'glyph' | 'medallion' = 'glyph';

  get iconKey(): ZodiacIconKey {
    return resolveZodiacIconKey(this.sign);
  }

  get path(): string {
    return ZODIAC_PATHS[this.iconKey] || ZODIAC_PATHS.unknown;
  }

  get glyph(): string {
    return SIGN_GLYPHS[this.iconKey] + '︎';
  }
}
