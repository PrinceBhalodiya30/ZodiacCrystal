import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GUIDES } from '../../data/guides.data';
import { Guide } from '../../models/guide';
import { SeoService } from '../../services/seo.service';
import { SITE_URL } from '../../services/api-config';

@Component({
  selector: 'app-guide-detail',
  standalone: true,
  imports: [Breadcrumbs, RouterLink],
  templateUrl: './guide-detail.html',
  styleUrl: './guide-detail.css'
})
export class GuideDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);

  guide = signal<Guide | null>(null);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    const guide = GUIDES.find(g => g.slug === slug) ?? null;
    this.guide.set(guide);

    if (guide) {
      this.seo.update({ title: `${guide.title} | Zodiac Crystals`, description: guide.shortDescription, type: 'article' });
      this.seo.setJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: guide.title,
        description: guide.shortDescription,
        url: `${SITE_URL}/guides/${guide.slug}`,
        publisher: { '@type': 'Organization', name: 'Zodiac Crystals', logo: `${SITE_URL}/logo.svg` }
      });
    }
  }
}
