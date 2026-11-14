import { Component, OnInit, OnDestroy, ElementRef, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QuizService } from '../../../../services/quiz.service';
import { StoreSettingsService, MarqueeElementItem, DEFAULT_MARQUEE_ITEMS } from '../../../../services/store-settings.service';
import { ImgFallbackDirective } from '../../../../directives/img-fallback.directive';
import { SITE_NAME } from '../../../../services/page-title.service';

export type CosmicElementItem = MarqueeElementItem;

export interface IntentionItem {
  id: string;
  label: string;
  sub: string;
  image: string;
  queryParam: string;
}

@Component({
  selector: 'app-home-hero',
  standalone: true,
  imports: [RouterLink, ImgFallbackDirective],
  templateUrl: './home-hero.html',
  styleUrl: './home-hero.css'
})
export class HomeHero implements OnInit, OnDestroy {
  readonly siteName = SITE_NAME;
  private readonly quizService = inject(QuizService);
  private readonly storeSettingsService = inject(StoreSettingsService);

  @ViewChild('herowave', { static: true }) waveCanvasRef!: ElementRef<HTMLCanvasElement>;

  private animationFrameId: number | null = null;
  private isDestroyed = false;

  get cosmicElements(): CosmicElementItem[] {
    const items = typeof this.storeSettingsService?.marqueeItems === 'function'
      ? this.storeSettingsService.marqueeItems()
      : undefined;
    return items && items.length > 0 ? items : DEFAULT_MARQUEE_ITEMS;
  }

  get marqueeElements(): CosmicElementItem[] {
    const items = this.cosmicElements;
    return [...items, ...items];
  }

  getElementSearchTerm(elem: CosmicElementItem): string {
    return elem.name.split(' ')[0].toLowerCase();
  }

  readonly intentions: IntentionItem[] = [
    {
      id: 'wealth',
      label: 'Wealth',
      sub: 'Pyrite & Citrine',
      image: '/intentions/wealth.webp',
      queryParam: 'wealth'
    },
    {
      id: 'protection',
      label: 'Protection',
      sub: 'Smoky Quartz & Obsidian',
      image: '/intentions/protection.webp',
      queryParam: 'protection'
    },
    {
      id: 'love',
      label: 'Love',
      sub: 'Rose Quartz',
      image: '/intentions/love.jpg',
      queryParam: 'love'
    },
    {
      id: 'clarity',
      label: 'Clarity',
      sub: 'Clear Quartz',
      image: '/intentions/clarity.webp',
      queryParam: 'intuition'
    },
    {
      id: 'calm',
      label: 'Calm',
      sub: 'Amethyst & Selenite',
      image: '/intentions/calm.jpg',
      queryParam: 'peace'
    },
    {
      id: 'all',
      label: 'All Crystals',
      sub: 'Explore Collection',
      image: '/intentions/all-crystals.webp',
      queryParam: ''
    }
  ];

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.initSineWave();
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  openQuiz(): void {
    this.quizService.open();
  }

  private initSineWave(): void {
    const canvas = this.waveCanvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight * 0.75;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let step = 0;
    const render = () => {
      if (this.isDestroyed) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Subtle harmonic golden energy wave
      ctx.beginPath();
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = 'rgba(232, 177, 131, 0.28)';

      const midY = height * 0.62;
      for (let x = 0; x < width; x += 3) {
        const y = midY + Math.sin((x * 0.0035) + step) * 22 + Math.cos((x * 0.007) - (step * 0.5)) * 12;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Second harmonic overtone
      ctx.beginPath();
      ctx.lineWidth = 0.85;
      ctx.strokeStyle = 'rgba(200, 150, 62, 0.18)';
      for (let x = 0; x < width; x += 4) {
        const y = midY + Math.sin((x * 0.005) - (step * 1.2)) * 16 + Math.sin((x * 0.002) + step) * 8;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      step += 0.012;
      this.animationFrameId = requestAnimationFrame(render);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Draw static single line for reduced motion
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(232, 177, 131, 0.2)';
      ctx.moveTo(0, canvas.height * 0.62);
      ctx.lineTo(canvas.width, canvas.height * 0.62);
      ctx.stroke();
    } else {
      this.animationFrameId = requestAnimationFrame(render);
    }
  }
}
