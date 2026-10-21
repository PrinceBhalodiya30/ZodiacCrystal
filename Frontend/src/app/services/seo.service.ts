import { DOCUMENT, Injectable, Injector, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { SITE_URL } from './api-config';

export const DEFAULT_DESCRIPTION =
  'Shop healing crystals matched to your zodiac sign. Rose quartz, amethyst, citrine and more, with crystal guides, mystery boxes and fast delivery across India.';
const DEFAULT_IMAGE = '/og-image.png';
const JSON_LD_ID = 'page-json-ld';

export interface PageMeta {
  title: string;
  description?: string | null;
  image?: string | null;
  type?: 'website' | 'product' | 'article';
  noindex?: boolean;
}

// Search/social tags for the current page: description, canonical link,
// Open Graph + Twitter card and an optional JSON-LD block. PageTitleService
// sets route-level defaults on every navigation; pages with loaded data
// (a product, a zodiac sign, a guide) call update()/setJsonLd() afterwards.
@Injectable({ providedIn: 'root' })
export class SeoService {
  private meta = inject(Meta);
  private document = inject(DOCUMENT);
  // Router is looked up on use, not injected: the Router itself depends on
  // PageTitleService -> SeoService, so injecting it here is a cycle (NG0200).
  private injector = inject(Injector);

  // `path` is passed during navigation, before router.url has caught up.
  update(page: PageMeta, path?: string): void {
    const description = truncate(page.description || DEFAULT_DESCRIPTION, 160);
    const url = this.canonicalUrl(path ?? this.injector.get(Router).url);
    const image = absoluteUrl(page.image || DEFAULT_IMAGE);

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: page.noindex ? 'noindex, nofollow' : 'index, follow' });
    this.meta.updateTag({ property: 'og:site_name', content: 'Crystal Studio' });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: page.type ?? 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: page.title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: image });
    this.setCanonical(url);
  }

  // Replaces the page's structured data; null removes it.
  setJsonLd(data: object | null): void {
    this.document.getElementById(JSON_LD_ID)?.remove();
    if (!data) {
      return;
    }
    const script = this.document.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    // "<" escaped so text from the database can't close the script tag.
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    this.document.head.appendChild(script);
  }

  // Canonical URL ignores query strings (filters, paging, tracking params).
  private canonicalUrl(url: string): string {
    const path = url.split(/[?#]/)[0] || '/';
    return SITE_URL + (path === '/' ? '/' : path.replace(/\/$/, ''));
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
  }
}

// Social crawlers need absolute image URLs; uploaded images are already
// absolute (API host), site assets are made absolute against SITE_URL.
export function absoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : SITE_URL + (url.startsWith('/') ? url : `/${url}`);
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}
