import { Injectable, inject, signal } from '@angular/core';

export interface ConsultationRecord {
  id: string;
  timestamp: string; // ISO string e.g. "2026-10-22T12:30:00.000Z"
  dateKey: string;   // YYYY-MM-DD
  intention: string;
  zodiacSign: string;
  form: string;
  matchesCount: number;
  addedToCart: boolean;
}

export interface ConsultationInsights {
  totalCount: number;
  cartAddCount: number;
  conversionRate: number; // 0 - 100
  topIntention: string;
  topZodiac: string;
  intentions: { name: string; count: number; percent: number }[];
  zodiacSigns: { name: string; symbol: string; count: number; percent: number }[];
  forms: { name: string; count: number; percent: number }[];
  recentSessions: ConsultationRecord[];
}

const STORAGE_KEY = 'zodiac_consultation_logs';

const ZODIAC_SYMBOLS: Record<string, string> = {
  Aries: '♈',
  Taurus: '♉',
  Gemini: '♊',
  Cancer: '♋',
  Leo: '♌',
  Virgo: '♍',
  Libra: '♎',
  Scorpio: '♏',
  Sagittarius: '♐',
  Capricorn: '♑',
  Aquarius: '♒',
  Pisces: '♓',
  'All Signs': '✦'
};

import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private router = inject(Router);
  isOpen = signal(false);

  private consultations: ConsultationRecord[] = [];

  constructor() {
    this.loadFromStorage();
  }

  open(): void {
    this.isOpen.set(false);
    this.router.navigate(['/consultation']);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  /**
   * Records a completed customer consultation inquiry.
   */
  logConsultation(intention: string, zodiacSign: string, form: string, matchesCount: number): string {
    const now = new Date();
    const id = 'cons_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const record: ConsultationRecord = {
      id,
      timestamp: now.toISOString(),
      dateKey: now.toISOString().split('T')[0],
      intention: intention || 'Calm & Inner Peace',
      zodiacSign: zodiacSign && zodiacSign !== 'any' ? zodiacSign : 'All Signs',
      form: form && form !== 'any' ? form : 'Raw Natural Specimen',
      matchesCount: matchesCount || 3,
      addedToCart: false
    };

    this.consultations.unshift(record);
    // Keep max 500 recent records
    if (this.consultations.length > 500) {
      this.consultations = this.consultations.slice(0, 500);
    }
    this.saveToStorage();
    return id;
  }

  /**
   * Marks that a customer added a recommended product to their bag from this consultation session.
   */
  markAddedToCart(id: string): void {
    const item = this.consultations.find(c => c.id === id);
    if (item) {
      item.addedToCart = true;
      this.saveToStorage();
    }
  }

  /**
   * Computes aggregated insights for Admin Reports within an optional date range.
   */
  getInsights(from?: string, to?: string): ConsultationInsights {
    const filtered = this.filterByDate(this.consultations, from, to);
    const totalCount = filtered.length;
    const cartAddCount = filtered.filter(c => c.addedToCart).length;
    const conversionRate = totalCount > 0 ? Math.round((cartAddCount / totalCount) * 100) : 0;

    // Aggregate Intentions
    const intentionMap = new Map<string, number>();
    for (const c of filtered) {
      intentionMap.set(c.intention, (intentionMap.get(c.intention) ?? 0) + 1);
    }
    const intentions = Array.from(intentionMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percent: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Aggregate Zodiac Signs
    const zodiacMap = new Map<string, number>();
    for (const c of filtered) {
      zodiacMap.set(c.zodiacSign, (zodiacMap.get(c.zodiacSign) ?? 0) + 1);
    }
    const zodiacSigns = Array.from(zodiacMap.entries())
      .map(([name, count]) => ({
        name,
        symbol: ZODIAC_SYMBOLS[name] || '✦',
        count,
        percent: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Aggregate Forms
    const formMap = new Map<string, number>();
    for (const c of filtered) {
      formMap.set(c.form, (formMap.get(c.form) ?? 0) + 1);
    }
    const forms = Array.from(formMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percent: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    const topIntention = intentions[0]?.name || 'Calm & Inner Peace';
    const topZodiac = zodiacSigns[0]?.name ? `${zodiacSigns[0].name} ${zodiacSigns[0].symbol}` : 'Scorpio ♏';

    return {
      totalCount,
      cartAddCount,
      conversionRate,
      topIntention,
      topZodiac,
      intentions,
      zodiacSigns,
      forms,
      recentSessions: filtered.slice(0, 15)
    };
  }

  /**
   * Generates a downloadable CSV Blob for consultation data.
   */
  exportCsvBlob(from?: string, to?: string): Blob {
    const records = this.filterByDate(this.consultations, from, to);

    const headers = [
      'Session ID',
      'Date & Time (IST)',
      'Intention / Wellness Goal',
      'Zodiac Sign',
      'Preferred Mineral Form',
      'Crystals Matched',
      'Added To Bag'
    ];

    const escapeCsv = (val: string | number | boolean): string => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = records.map(r => [
      escapeCsv(r.id),
      escapeCsv(new Date(r.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })),
      escapeCsv(r.intention),
      escapeCsv(r.zodiacSign),
      escapeCsv(r.form),
      escapeCsv(r.matchesCount),
      escapeCsv(r.addedToCart ? 'Yes' : 'No')
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
    return new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  private filterByDate(list: ConsultationRecord[], from?: string, to?: string): ConsultationRecord[] {
    if (!from && !to) {
      return list;
    }
    return list.filter(item => {
      if (from && item.dateKey < from) {
        return false;
      }
      if (to && item.dateKey > to) {
        return false;
      }
      return true;
    });
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      this.consultations = this.generateSeedData();
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.consultations = parsed;
          return;
        }
      }
    } catch {
      // ignore JSON parse errors
    }

    // Initialize with seed data for instant richness
    this.consultations = this.generateSeedData();
    this.saveToStorage();
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.consultations));
    } catch {
      // ignore storage quota errors
    }
  }

  /**
   * Realistic initial trends across recent weeks so admin reports show comprehensive analytics.
   */
  private generateSeedData(): ConsultationRecord[] {
    const intentions = [
      'Calm & Inner Peace',
      'Abundance & Prosperity',
      'Protection & Grounding',
      'Love & Heart Healing',
      'Focus, Clarity & Wisdom',
      'Vitality & Courage'
    ];
    const zodiacs = ['Scorpio', 'Aries', 'Cancer', 'Taurus', 'Leo', 'Pisces', 'Virgo', 'Gemini', 'Libra', 'Sagittarius', 'Capricorn', 'Aquarius'];
    const forms = ['Raw Natural Specimen', 'Polished Crystal Tower', 'Celestial Crystal Bracelet', 'Pocket Palm Stone', 'Crystal Sphere'];

    const records: ConsultationRecord[] = [];
    const now = new Date();

    for (let i = 0; i < 78; i++) {
      // Days spread across the last 35 days
      const daysAgo = Math.floor(Math.random() * 32);
      const sessionDate = new Date(now.getTime() - daysAgo * 86400000 - Math.floor(Math.random() * 43200000));
      const intention = intentions[Math.floor(Math.random() * intentions.length)];
      const zodiac = zodiacs[Math.floor(Math.random() * zodiacs.length)];
      const form = forms[Math.floor(Math.random() * forms.length)];
      const addedToCart = Math.random() < 0.42; // ~42% conversion

      records.push({
        id: `cons_${i + 101}_${sessionDate.getTime()}`,
        timestamp: sessionDate.toISOString(),
        dateKey: sessionDate.toISOString().split('T')[0],
        intention,
        zodiacSign: zodiac,
        form,
        matchesCount: 3,
        addedToCart
      });
    }

    // Sort descending by timestamp
    return records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
}
