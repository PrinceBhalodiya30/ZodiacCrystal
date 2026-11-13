import { Component, OnInit, inject, signal } from '@angular/core';
import { ZodiacService } from '../../services/zodiac.service';
import { Zodiac } from '../../models/zodiac';
import { ZodiacCard } from '../../components/zodiac-card/zodiac-card';
import { BirthdaySignFinder } from '../../components/birthday-sign-finder/birthday-sign-finder';

@Component({
  selector: 'app-zodiac-page',
  standalone: true,
  imports: [ZodiacCard, BirthdaySignFinder],
  templateUrl: './zodiac.html',
  styleUrl: './zodiac.css'
})
export class ZodiacPage implements OnInit {
  private readonly zodiacService = inject(ZodiacService);

  readonly zodiacSigns = signal<Zodiac[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.loadZodiacSigns();
  }

  loadZodiacSigns(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.zodiacService.getZodiacSigns().subscribe({
      next: signs => {
        this.zodiacSigns.set(signs);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load zodiac signs.');
        this.isLoading.set(false);
      }
    });
  }
}
