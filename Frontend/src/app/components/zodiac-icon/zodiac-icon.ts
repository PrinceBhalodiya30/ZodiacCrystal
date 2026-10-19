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

// Maps a zodiac sign name (as free-typed by an admin, e.g. "Aries", "aries ")
// to one of the 12 known signs, falling back to a neutral sparkle glyph for
// anything unrecognized instead of breaking the layout.
export function resolveZodiacIconKey(name: string | undefined | null): ZodiacIconKey {
  if (!name) {
    return 'unknown';
  }

  const normalized = name.trim().toLowerCase();
  return KNOWN_SIGNS.find(sign => normalized.includes(sign)) ?? 'unknown';
}

@Component({
  selector: 'app-zodiac-icon',
  standalone: true,
  templateUrl: './zodiac-icon.html',
  styleUrl: './zodiac-icon.css'
})
export class ZodiacIcon {
  @Input({ required: true }) sign!: string;
  // Extra outline around the glyph (24-unit grid); raise it for bold, emoji-like tiles.
  @Input() strokeWidth = 0;

  get glyph(): string {
    // U+FE0E asks for the plain text glyph, so no browser swaps in an emoji.
    return SIGN_GLYPHS[resolveZodiacIconKey(this.sign)] + '︎';
  }
}
