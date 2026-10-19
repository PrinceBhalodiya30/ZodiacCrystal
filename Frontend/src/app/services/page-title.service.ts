import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { SeoService } from './seo.service';

const SITE_NAME = 'Zodiac Crystals';
const HOME_TITLE = 'Zodiac Crystals – Healing Crystals for Every Zodiac Sign';

// Browser tab titles: each route's `title` becomes "<title> | Zodiac Crystals".
// Also resets the search/social tags on every navigation from the route's
// `data.description` / `data.noindex`. Pages whose title depends on loaded
// data (a product, a zodiac sign) call setPageTitle() once it arrives.
@Injectable({ providedIn: 'root' })
export class PageTitleService extends TitleStrategy {
  private title = inject(Title);
  private seo = inject(SeoService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const data = deepestChild(snapshot.root).data;
    const fullTitle = this.setPageTitle(this.buildTitle(snapshot));

    this.seo.setJsonLd(null);
    this.seo.update(
      { title: fullTitle, description: data['description'], noindex: data['noindex'] === true },
      snapshot.url
    );
  }

  // Returns the full tab title so callers can reuse it for social tags.
  setPageTitle(name?: string | null): string {
    const fullTitle = name ? `${name} | ${SITE_NAME}` : HOME_TITLE;
    this.title.setTitle(fullTitle);
    return fullTitle;
  }
}

function deepestChild(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  while (route.firstChild) {
    route = route.firstChild;
  }
  return route;
}
