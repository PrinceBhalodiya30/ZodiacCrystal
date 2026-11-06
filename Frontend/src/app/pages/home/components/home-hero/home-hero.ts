import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StoreSettingsService } from '../../../../services/store-settings.service';
import { QuizService } from '../../../../services/quiz.service';
import { ImgFallbackDirective } from '../../../../directives/img-fallback.directive';
import { SITE_NAME } from '../../../../services/page-title.service';
import { HERO_IMAGE_URL } from '../../../../utils/hero-image.util';

@Component({
  selector: 'app-home-hero',
  standalone: true,
  imports: [RouterLink, ImgFallbackDirective],
  templateUrl: './home-hero.html',
  styleUrl: './home-hero.css'
})
export class HomeHero implements OnInit, OnDestroy {
  readonly siteName = SITE_NAME;
  private storeSettings = inject(StoreSettingsService);
  private quizService = inject(QuizService);

  readonly heroEyebrow = computed(() => this.storeSettings.heroEyebrow());
  readonly heroTitle = computed(() => this.storeSettings.heroTitle());
  readonly heroSubtitle = computed(() => this.storeSettings.heroSubtitle());

  readonly totalSlides = 4;
  activeSlide = signal(0);
  isPaused = signal(false);
  private timerId: ReturnType<typeof setInterval> | null = null;
  private touchStartX = 0;
  private touchEndX = 0;

  ngOnInit(): void {
    this.startCarouselTimer();
  }

  ngOnDestroy(): void {
    this.stopCarouselTimer();
  }

  heroImageUrl = signal<string | null>(HERO_IMAGE_URL);

  openQuiz(): void {
    this.quizService.open();
  }

  pauseCarousel(): void {
    this.isPaused.set(true);
    this.stopCarouselTimer();
  }

  resumeCarousel(): void {
    this.isPaused.set(false);
    this.startCarouselTimer();
  }

  nextSlide(): void {
    this.activeSlide.update(i => (i + 1) % this.totalSlides);
  }

  prevSlide(): void {
    this.activeSlide.update(i => (i - 1 + this.totalSlides) % this.totalSlides);
  }

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.changedTouches[0].screenX;
  }

  onTouchEnd(e: TouchEvent): void {
    this.touchEndX = e.changedTouches[0].screenX;
    const diff = this.touchStartX - this.touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) this.nextSlide();
      else this.prevSlide();
    }
  }

  private startCarouselTimer(): void {
    this.stopCarouselTimer();
    this.timerId = setInterval(() => {
      if (!this.isPaused()) {
        this.nextSlide();
      }
    }, 7000);
  }

  private stopCarouselTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
