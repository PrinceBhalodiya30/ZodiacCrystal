import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ZodiacService } from '../../services/zodiac.service';
import { Zodiac } from '../../models/zodiac';
import { Product } from '../../models/product';
import { ZodiacIcon } from '../zodiac-icon/zodiac-icon';
import { InrPipe } from '../../pipes/inr.pipe';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import {
  getZodiacSignByBirthday,
  BirthdaySignResult,
  MONTH_OPTIONS
} from '../../utils/zodiac-finder.util';
import { getProductSlug } from '../../utils/product-slug.util';

@Component({
  selector: 'app-birthday-sign-finder',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ZodiacIcon, InrPipe, ImgFallbackDirective],
  templateUrl: './birthday-sign-finder.html',
  styleUrl: './birthday-sign-finder.css'
})
export class BirthdaySignFinder implements OnInit {
  private zodiacService = inject(ZodiacService);

  readonly months = MONTH_OPTIONS;

  selectedMonth = signal<number | null>(null);
  selectedDay = signal<number | null>(null);

  zodiacSigns = signal<Zodiac[]>([]);
  attunedCrystals = signal<Product[]>([]);
  isLoadingCrystals = signal(false);

  // Available days dynamically calculated based on selected month (28-31)
  availableDays = computed<number[]>(() => {
    const monthVal = this.selectedMonth();
    if (!monthVal) {
      return Array.from({ length: 31 }, (_, i) => i + 1);
    }
    const found = this.months.find(m => m.value === monthVal);
    const maxDays = found ? found.maxDays : 31;
    return Array.from({ length: maxDays }, (_, i) => i + 1);
  });

  // Astrological result revealed on button click
  signResult = signal<BirthdaySignResult | null>(null);

  // Matched DB Zodiac entity (with ID for routing)
  matchedZodiac = computed<Zodiac | null>(() => {
    const res = this.signResult();
    if (!res) return null;
    const signs = this.zodiacSigns();
    return signs.find(s => s.name.toLowerCase() === res.signName.toLowerCase()) ?? null;
  });

  ngOnInit(): void {
    this.zodiacService.getZodiacSigns().subscribe({
      next: signs => {
        this.zodiacSigns.set(signs);
        const res = this.signResult();
        if (res) {
          this.fetchAttunedCrystals(res);
        }
      },
      error: () => {}
    });
  }

  onMonthChange(m: number | null): void {
    this.selectedMonth.set(m != null ? Number(m) : null);
    // Adjust day if current selection exceeds month limit (e.g., Feb 30)
    const currentDay = this.selectedDay();
    if (m && currentDay) {
      const monthObj = this.months.find(x => x.value === Number(m));
      if (monthObj && currentDay > monthObj.maxDays) {
        this.selectedDay.set(monthObj.maxDays);
      }
    }
    // Result is only revealed when clicking "Find My Sign"
    this.signResult.set(null);
    this.attunedCrystals.set([]);
  }

  onDayChange(d: number | null): void {
    this.selectedDay.set(d != null ? Number(d) : null);
    // Result is only revealed when clicking "Find My Sign"
    this.signResult.set(null);
    this.attunedCrystals.set([]);
  }

  get todayMonthName(): string {
    const m = new Date().getMonth() + 1;
    return this.months.find(x => x.value === m)?.name ?? '';
  }

  get todayDay(): number {
    return new Date().getDate();
  }

  setToday(): void {
    const today = new Date();
    this.selectedMonth.set(today.getMonth() + 1);
    this.selectedDay.set(today.getDate());
    this.findMySign();
  }

  reset(): void {
    this.selectedMonth.set(null);
    this.selectedDay.set(null);
    this.signResult.set(null);
    this.attunedCrystals.set([]);
  }

  findMySign(): void {
    const m = this.selectedMonth();
    const d = this.selectedDay();
    if (!m || !d) return;

    try {
      const monthNum = Number(m);
      const dayNum = Number(d);
      const res = getZodiacSignByBirthday(monthNum, dayNum);
      this.signResult.set(res);
      this.fetchAttunedCrystals(res);
    } catch (err) {
      console.error('Error finding zodiac sign:', err);
      this.signResult.set(null);
      this.attunedCrystals.set([]);
    }
  }

  // Alias for backwards-compatibility with any cached templates
  fetchAttunedCrystalsIfReady(): void {
    this.findMySign();
  }

  private fetchAttunedCrystals(res: BirthdaySignResult): void {
    const signs = this.zodiacSigns();
    const matched = signs.find(s => s.name.toLowerCase() === res.signName.toLowerCase());
    if (matched) {
      this.isLoadingCrystals.set(true);
      this.zodiacService.getProductsByZodiac(matched.zodiacId).subscribe({
        next: products => {
          // Preview top 3 attuned crystals
          this.attunedCrystals.set(products.slice(0, 3));
          this.isLoadingCrystals.set(false);
        },
        error: () => {
          this.isLoadingCrystals.set(false);
        }
      });
    } else {
      this.attunedCrystals.set([]);
    }
  }

  getProductSlug(product: Product): string {
    return getProductSlug(product);
  }
}
