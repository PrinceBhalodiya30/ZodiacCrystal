import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ZodiacService } from '../../services/zodiac.service';
import { PageTitleService } from '../../services/page-title.service';
import { SeoService } from '../../services/seo.service';
import { Zodiac } from '../../models/zodiac';
import { Product } from '../../models/product';
import { ProductCard } from '../../components/product-card/product-card';
import { ProductCardSkeleton } from '../../components/product-card-skeleton/product-card-skeleton';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { ZodiacIcon } from '../../components/zodiac-icon/zodiac-icon';
import { VedicZodiacPipe } from '../../pipes/vedic-zodiac.pipe';
import { formatZodiacDual } from '../../utils/zodiac-names.util';

@Component({
  selector: 'app-zodiac-products',
  standalone: true,
  imports: [Breadcrumbs, ProductCardSkeleton, ProductCard, ImgFallbackDirective, ZodiacIcon, VedicZodiacPipe],
  templateUrl: './zodiac-products.html',
  styleUrl: './zodiac-products.css'
})
export class ZodiacProducts implements OnInit {
  private route = inject(ActivatedRoute);
  private zodiacService = inject(ZodiacService);
  private pageTitle = inject(PageTitleService);
  private seo = inject(SeoService);

  zodiac = signal<Zodiac | null>(null);
  products = signal<Product[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  ngOnInit(): void {
    this.loadZodiac();
  }

  loadZodiac(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.zodiacService.getZodiac(id).subscribe({
      next: zodiac => {
        this.zodiac.set(zodiac);
        const dualName = formatZodiacDual(zodiac.name);
        this.seo.update({
          title: this.pageTitle.setPageTitle(`${dualName} Crystals`),
          description: zodiac.description ? `${dualName} - ${zodiac.description}` : `Authentic healing crystals attuned to ${dualName}.`,
          image: zodiac.imageUrl
        });
        this.loadProducts(id);
      },
      error: () => {
        this.errorMessage.set('Unable to load zodiac sign.');
        this.isLoading.set(false);
      }
    });
  }

  private loadProducts(id: number): void {
    this.zodiacService.getProductsByZodiac(id).subscribe({
      next: products => {
        // Inactive products aren't for sale, so customers shouldn't see them.
        this.products.set(products.filter(product => product.isActive));
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load products for this zodiac sign.');
        this.isLoading.set(false);
      }
    });
  }
}
