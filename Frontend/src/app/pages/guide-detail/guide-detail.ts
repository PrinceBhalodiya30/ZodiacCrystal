import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { GUIDES } from '../../data/guides.data';
import { Guide } from '../../models/guide';
import { SeoService } from '../../services/seo.service';
import { CleansingGuideService, CleansingGuideTab } from '../../services/cleansing-guide.service';
import { SITE_URL } from '../../services/api-config';
import { SITE_NAME } from '../../services/page-title.service';

@Component({
  selector: 'app-guide-detail',
  standalone: true,
  imports: [Breadcrumbs, RouterLink],
  templateUrl: './guide-detail.html',
  styleUrl: './guide-detail.css'
})
export class GuideDetail implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);
  private cleansingGuideService = inject(CleansingGuideService);
  private routeSub?: Subscription;

  guide = signal<Guide | null>(null);

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      const guide = GUIDES.find(g => g.slug === slug) ?? null;
      this.guide.set(guide);

      if (guide) {
        this.seo.update({ title: `${guide.title} | ${SITE_NAME}`, description: guide.shortDescription, type: 'article' });
        this.seo.setJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: guide.title,
          description: guide.shortDescription,
          url: `${SITE_URL}/guides/${guide.slug}`,
          publisher: { '@type': 'Organization', name: SITE_NAME, logo: `${SITE_URL}/logo.png` }
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  openCleansingModal(tab: CleansingGuideTab = 'cleansing'): void {
    this.cleansingGuideService.open(tab);
  }
}
