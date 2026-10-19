import { inject } from '@angular/core';
import { RenderMode, ServerRoute } from '@angular/ssr';
import { firstValueFrom } from 'rxjs';
import { GUIDES } from './data/guides.data';
import { ZodiacService } from './services/zodiac.service';

// Which pages get static HTML at build time (outputMode "static" in
// angular.json). Only public, content-style pages are prerendered so search
// engines and link previews see real text; everything else stays a normal
// client-rendered page.
//
// Pages that load data (home, zodiac, categories) call the API during the
// build, so the API must be running and reachable from Node when you run
// `ng build` - otherwise they are prerendered without their data.
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'zodiac', renderMode: RenderMode.Prerender },
  {
    path: 'zodiac/:id',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      try {
        const signs = await firstValueFrom(inject(ZodiacService).getZodiacSigns());
        return signs.map(sign => ({ id: String(sign.zodiacId) }));
      } catch {
        // API unreachable at build time: these pages fall back to client rendering.
        return [];
      }
    }
  },
  { path: 'categories', renderMode: RenderMode.Prerender },
  { path: 'guides', renderMode: RenderMode.Prerender },
  {
    path: 'guides/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return GUIDES.map(guide => ({ slug: guide.slug }));
    }
  },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'faq', renderMode: RenderMode.Prerender },
  { path: 'contact', renderMode: RenderMode.Prerender },
  { path: 'shipping-returns', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: 'terms', renderMode: RenderMode.Prerender },
  { path: 'mystery-box', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client }
];
