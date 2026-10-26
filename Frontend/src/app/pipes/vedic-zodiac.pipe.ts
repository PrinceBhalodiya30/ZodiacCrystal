import { Pipe, PipeTransform } from '@angular/core';
import {
  formatZodiacDual,
  formatZodiacCompact,
  getRashiWithDevanagari,
  getRashiSimple
} from '../utils/zodiac-names.util';

@Pipe({
  name: 'vedicZodiac',
  standalone: true
})
export class VedicZodiacPipe implements PipeTransform {
  transform(
    target: string | { name?: string; rashiName?: string } | null | undefined,
    mode: 'dual' | 'compact' | 'rashi' | 'simple' = 'dual',
    rashiOverride?: string | null
  ): string {
    if (!target) return '';

    let name = '';
    let customRashi: string | null | undefined = rashiOverride;

    if (typeof target === 'string') {
      name = target;
    } else if (typeof target === 'object') {
      name = target.name || '';
      customRashi = customRashi ?? target.rashiName;
    }

    if (!name) return '';

    switch (mode) {
      case 'compact':
        return formatZodiacCompact(name, customRashi);
      case 'rashi':
        return getRashiWithDevanagari(name, customRashi);
      case 'simple':
        return getRashiSimple(name, customRashi);
      case 'dual':
      default:
        return formatZodiacDual(name, customRashi);
    }
  }
}

