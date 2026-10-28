import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Home } from './home';
import { ZodiacService } from '../../services/zodiac.service';
import { ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { StoreSettingsService } from '../../services/store-settings.service';
import { QuizService } from '../../services/quiz.service';
import { CleansingGuideService } from '../../services/cleansing-guide.service';

import { Component } from '@angular/core';

@Component({ standalone: true, template: '' })
class DummyComponent {}

describe('Home Component Hero Carousel', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let quizService: QuizService;
  let cleansingGuideService: CleansingGuideService;

  beforeEach(async () => {
    const mockZodiacService = {
      getZodiacSigns: vi.fn().mockReturnValue(of([]))
    };
    const mockProductService = {
      getProductsPaged: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 8 }))
    };
    const mockCategoryService = {
      getCategories: vi.fn().mockReturnValue(of([])),
      getCategoryTiles: vi.fn().mockReturnValue(of([]))
    };
    const mockStoreSettingsService = {
      heroEyebrow: signal('Celestial Resonance'),
      heroTitle: signal('Wear Your Cosmic Frequency'),
      heroSubtitle: signal('Attune your daily energy')
    };

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: ZodiacService, useValue: mockZodiacService },
        { provide: ProductService, useValue: mockProductService },
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: StoreSettingsService, useValue: mockStoreSettingsService },
        QuizService,
        CleansingGuideService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    quizService = TestBed.inject(QuizService);
    cleansingGuideService = TestBed.inject(CleansingGuideService);
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('initializes with activeSlide 0 and total 4 carousel tabs', () => {
    expect(component.activeSlide()).toBe(0);
    expect(component.totalSlides).toBe(4);
    expect(component.carouselTabs.length).toBe(4);
  });

  it('cycles to next and previous slide accurately', () => {
    component.nextSlide();
    expect(component.activeSlide()).toBe(1);

    component.nextSlide();
    expect(component.activeSlide()).toBe(2);

    component.nextSlide();
    expect(component.activeSlide()).toBe(3);

    // wrap around
    component.nextSlide();
    expect(component.activeSlide()).toBe(0);

    // prev wrap around
    component.prevSlide();
    expect(component.activeSlide()).toBe(3);

    component.prevSlide();
    expect(component.activeSlide()).toBe(2);
  });

  it('navigates to specific slide using goToSlide', () => {
    component.goToSlide(2);
    expect(component.activeSlide()).toBe(2);

    component.goToSlide(1);
    expect(component.activeSlide()).toBe(1);
  });

  it('pauses and resumes carousel on interaction', () => {
    expect(component.isPaused()).toBe(false);

    component.pauseCarousel();
    expect(component.isPaused()).toBe(true);

    component.resumeCarousel();
    expect(component.isPaused()).toBe(false);
  });

  it('opens crystal quiz via openQuiz', () => {
    const spy = vi.spyOn(quizService, 'open');
    component.openQuiz();
    expect(spy).toHaveBeenCalled();
  });

  it('opens interactive cleansing guide via openCleansingGuide', () => {
    const spy = vi.spyOn(cleansingGuideService, 'open');
    component.openCleansingGuide('ritual');
    expect(spy).toHaveBeenCalledWith('ritual');
  });

  it('handles swipe gestures to cycle slides', () => {
    // Swipe left (diff > 40 => next slide)
    component.onTouchStart({ changedTouches: [{ clientX: 200 }] } as any);
    component.onTouchEnd({ changedTouches: [{ clientX: 100 }] } as any);
    expect(component.activeSlide()).toBe(1);

    // Swipe right (diff < -40 => prev slide)
    component.onTouchStart({ changedTouches: [{ clientX: 100 }] } as any);
    component.onTouchEnd({ changedTouches: [{ clientX: 200 }] } as any);
    expect(component.activeSlide()).toBe(0);
  });
});
