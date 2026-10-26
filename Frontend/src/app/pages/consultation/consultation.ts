import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { CompareService } from '../../services/compare.service';
import { QuizService } from '../../services/quiz.service';
import { Product } from '../../models/product';
import { getPrimaryImageUrl } from '../../utils/product-image.util';
import { getProductSlug } from '../../utils/product-slug.util';
import { InrPipe } from '../../pipes/inr.pipe';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { ZodiacIcon } from '../../components/zodiac-icon/zodiac-icon';
import { Breadcrumbs, Crumb } from '../../components/breadcrumbs/breadcrumbs';

export interface QuizIntention {
  id: string;
  label: string;
  icon: string;
  desc: string;
  keywords: string[];
}

export interface QuizForm {
  id: string;
  label: string;
  icon: string;
  desc: string;
  keywords: string[];
}

export interface CrystalMatch {
  product: Product;
  matchScore: number;
  reason: string;
}

@Component({
  selector: 'app-consultation',
  standalone: true,
  imports: [RouterLink, InrPipe, ImgFallbackDirective, ZodiacIcon, Breadcrumbs],
  templateUrl: './consultation.html',
  styleUrl: './consultation.css'
})
export class Consultation implements OnInit {
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private compareService = inject(CompareService);
  private quizService = inject(QuizService);
  private router = inject(Router);

  breadcrumbs: Crumb[] = [
    { label: 'Home', link: '/' },
    { label: 'Crystal Consultation' }
  ];

  currentStep = signal<number>(1);
  isLoading = signal<boolean>(false);
  products = signal<Product[]>([]);

  selectedIntention = signal<QuizIntention | null>(null);
  selectedZodiac = signal<string | null>(null);
  selectedForm = signal<QuizForm | null>(null);

  matchedCrystals = signal<CrystalMatch[]>([]);
  addedProductId = signal<number | null>(null);
  activeConsultationId = signal<string | null>(null);

  readonly intentions: QuizIntention[] = [
    {
      id: 'calm',
      label: 'Calm & Inner Peace',
      icon: 'calm',
      desc: 'Soothe emotional stress, quiet overthinking, and invite deep tranquility.',
      keywords: ['amethyst', 'selenite', 'calm', 'peace', 'soothe', 'serenity', 'lepidolite', 'blue lace', 'relax', 'stress', 'soothing']
    },
    {
      id: 'love',
      label: 'Love & Heart Healing',
      icon: 'love',
      desc: 'Open heart chakra, deepen emotional bonds, and nurture unconditional self-love.',
      keywords: ['rose quartz', 'rhodonite', 'love', 'heart', 'compassion', 'relationship', 'moonstone', 'emotional', 'healing', 'harmony']
    },
    {
      id: 'protect',
      label: 'Protection & Grounding',
      icon: 'protect',
      desc: 'Shield against negative energies, cleanse electromagnetic smog, and anchor your aura.',
      keywords: ['tourmaline', 'obsidian', 'protection', 'grounding', 'shield', 'smoky quartz', 'black', 'shielding', 'negative', 'anchor']
    },
    {
      id: 'focus',
      label: 'Focus, Clarity & Wisdom',
      icon: 'focus',
      desc: 'Sharpen mental acuity, boost study and meditation, and open your third-eye intuition.',
      keywords: ['fluorite', 'clear quartz', 'focus', 'clarity', 'wisdom', 'lapis', 'sodalite', 'intuition', 'mind', 'intellect', 'vision']
    },
    {
      id: 'abundance',
      label: 'Abundance & Prosperity',
      icon: 'abundance',
      desc: 'Attract wealth, unlock opportunities, build confidence, and manifest high intentions.',
      keywords: ['citrine', 'pyrite', 'aventurine', 'abundance', 'prosperity', 'wealth', 'money', 'luck', 'success', 'manifestation', 'fortune']
    },
    {
      id: 'energy',
      label: 'Vitality & Courage',
      icon: 'energy',
      desc: 'Ignite creative fire, awaken physical stamina, and conquer hesitation with bold confidence.',
      keywords: ['carnelian', 'tiger', 'vitality', 'energy', 'courage', 'motivation', 'red jasper', 'passion', 'fire', 'action', 'stamina']
    }
  ];

  readonly zodiacSigns = [
    { name: 'Aries', rashi: 'Mesha (मेष)', element: 'Agni (Fire)', dates: 'Apr 14 – May 14' },
    { name: 'Taurus', rashi: 'Vrishabha (वृषभ)', element: 'Prithvi (Earth)', dates: 'May 15 – Jun 14' },
    { name: 'Gemini', rashi: 'Mithuna (मिथुन)', element: 'Vayu (Air)', dates: 'Jun 15 – Jul 15' },
    { name: 'Cancer', rashi: 'Karka (कर्क)', element: 'Jala (Water)', dates: 'Jul 16 – Aug 16' },
    { name: 'Leo', rashi: 'Simha (सिंह)', element: 'Agni (Fire)', dates: 'Aug 17 – Sep 16' },
    { name: 'Virgo', rashi: 'Kanya (कन्या)', element: 'Prithvi (Earth)', dates: 'Sep 17 – Oct 16' },
    { name: 'Libra', rashi: 'Tula (तुला)', element: 'Vayu (Air)', dates: 'Oct 17 – Nov 15' },
    { name: 'Scorpio', rashi: 'Vrishchika (वृश्चिक)', element: 'Jala (Water)', dates: 'Nov 16 – Dec 15' },
    { name: 'Sagittarius', rashi: 'Dhanu (धनु)', element: 'Agni (Fire)', dates: 'Dec 16 – Jan 13' },
    { name: 'Capricorn', rashi: 'Makara (मकर)', element: 'Prithvi (Earth)', dates: 'Jan 14 – Feb 12' },
    { name: 'Aquarius', rashi: 'Kumbha (कुंभ)', element: 'Vayu (Air)', dates: 'Feb 13 – Mar 13' },
    { name: 'Pisces', rashi: 'Meena (मीन)', element: 'Jala (Water)', dates: 'Mar 14 – Apr 13' }
  ];

  readonly forms: QuizForm[] = [
    {
      id: 'raw',
      label: 'Raw Clusters & Geodes',
      icon: 'raw',
      desc: 'Pure, untouched earth vibration directly from nature.',
      keywords: ['raw', 'cluster', 'geode', 'rough', 'specimen', 'natural']
    },
    {
      id: 'polished',
      label: 'Towers, Spheres & Points',
      icon: 'polished',
      desc: 'Sculpted crystalline geometries to direct energy and anchor altars.',
      keywords: ['tower', 'point', 'sphere', 'wand', 'pyramid', 'palm', 'polished']
    },
    {
      id: 'jewelry',
      label: 'Wearable Jewelry & Talismans',
      icon: 'jewelry',
      desc: 'Keep healing vibrations in contact with your pulse throughout the day.',
      keywords: ['bracelet', 'pendant', 'necklace', 'ring', 'bead', 'jewelry']
    },
    {
      id: 'any',
      label: 'Intuitive Specimen / Any Form',
      icon: 'any',
      desc: 'Let fate guide the ideal physical shape into your hands.',
      keywords: []
    }
  ];

  ngOnInit(): void {
    this.productService.getProducts().subscribe({
      next: prods => this.products.set(prods),
      error: () => this.products.set([])
    });
  }

  selectIntention(intent: QuizIntention): void {
    this.selectedIntention.set(intent);
    this.currentStep.set(2);
    this.scrollToQuiz();
  }

  selectZodiac(sign: string): void {
    this.selectedZodiac.set(sign);
    this.currentStep.set(3);
    this.scrollToQuiz();
  }

  selectForm(form: QuizForm): void {
    this.selectedForm.set(form);
    this.calculateMatches();
    this.scrollToQuiz();
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= 4) {
      this.currentStep.set(step);
      this.scrollToQuiz();
    }
  }

  startOver(): void {
    this.selectedIntention.set(null);
    this.selectedZodiac.set(null);
    this.selectedForm.set(null);
    this.matchedCrystals.set([]);
    this.currentStep.set(1);
    this.scrollToQuiz(true);
  }

  private scrollToQuiz(force: boolean = false): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    const target = document.querySelector('.consultation-stepper') || document.querySelector('.consultation-card-wrapper');
    if (!target) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const navbarOffset = 90; // comfortable breathing room below sticky header

    // If the stepper/quiz header is already nicely visible in the upper viewport, don't jump/scroll
    const isComfortablyInView = rect.top >= 40 && rect.top <= window.innerHeight * 0.45;
    if (!force && isComfortablyInView) {
      return;
    }

    const targetY = window.scrollY + rect.top - navbarOffset;
    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth'
    });
  }

  getImage(product: Product): string | null {
    return getPrimaryImageUrl(product);
  }

  isCompared(product: Product): boolean {
    return this.compareService.isCompared(product.productId);
  }

  toggleCompare(product: Product): void {
    this.compareService.toggle(product);
  }

  addToCart(product: Product): void {
    this.cartService.addToCart(product, 1);
    this.addedProductId.set(product.productId);
    if (this.activeConsultationId()) {
      this.quizService.markAddedToCart(this.activeConsultationId()!);
    }
    setTimeout(() => this.addedProductId.set(null), 2000);
  }

  navigateToProduct(productOrId: Product | number): void {
    if (typeof productOrId === 'object') {
      this.router.navigate(['/products', getProductSlug(productOrId)]);
    } else {
      const match = this.products().find(p => p.productId === productOrId);
      this.router.navigate(['/products', match ? getProductSlug(match) : productOrId]);
    }
  }

  private calculateMatches(): void {
    this.isLoading.set(true);
    this.currentStep.set(4);

    const prods = this.products();
    const intention = this.selectedIntention();
    const zodiac = this.selectedZodiac();
    const form = this.selectedForm();

    setTimeout(() => {
      if (!prods || prods.length === 0) {
        this.isLoading.set(false);
        return;
      }

      const scored = prods.map(prod => {
        let score = 50;

        if (zodiac && zodiac !== 'any') {
          const hasZodiac = prod.zodiacs?.some(z => z.name.toLowerCase() === zodiac.toLowerCase());
          if (hasZodiac) {
            score += 35;
          } else if (prod.description?.toLowerCase().includes(zodiac.toLowerCase())) {
            score += 20;
          }
        } else {
          score += 15;
        }

        if (intention) {
          const text = `${prod.name} ${prod.description || ''} ${prod.categoryName || ''}`.toLowerCase();
          const matchCount = intention.keywords.filter(kw => text.includes(kw.toLowerCase())).length;
          score += Math.min(35, matchCount * 12);
        }

        if (form && form.keywords.length > 0) {
          const text = `${prod.name} ${prod.categoryName || ''}`.toLowerCase();
          const matchesForm = form.keywords.some(kw => text.includes(kw.toLowerCase()));
          if (matchesForm) {
            score += 20;
          }
        } else {
          score += 10;
        }

        if (prod.stockQuantity > 0) {
          score += 10;
        }

        const matchScore = Math.min(99, Math.max(68, score));
        const reason = this.generateReason(prod, intention, zodiac);

        return { product: prod, matchScore, reason };
      });

      scored.sort((a, b) => b.matchScore - a.matchScore);
      const topMatches = scored.slice(0, 3);

      this.matchedCrystals.set(topMatches);
      const consId = this.quizService.logConsultation(
        intention?.label || 'Calm & Inner Peace',
        zodiac || 'All Signs',
        form?.label || 'Raw Natural Specimen',
        topMatches.length
      );
      this.activeConsultationId.set(consId);
      this.isLoading.set(false);
    }, 450);
  }

  private generateReason(product: Product, intention: QuizIntention | null, zodiac: string | null): string {
    const zodiacText = zodiac && zodiac !== 'any' ? `${zodiac} energy` : 'your birth chart';
    const goalText = intention ? intention.label.toLowerCase() : 'holistic well-being';

    if (product.zodiacs && product.zodiacs.length > 0 && zodiac && zodiac !== 'any') {
      const matchZod = product.zodiacs.find(z => z.name.toLowerCase() === zodiac.toLowerCase());
      if (matchZod) {
        return `Naturally resonates with ${matchZod.name} to cultivate ${goalText} while balancing emotional equilibrium.`;
      }
    }

    return `Harmonizes beautifully with ${zodiacText}, amplifying positive intentions for ${goalText}.`;
  }
}
