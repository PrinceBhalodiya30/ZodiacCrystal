import { Component, OnInit, inject, signal } from '@angular/core';
import { ZodiacService } from '../../services/zodiac.service';
import { Zodiac } from '../../models/zodiac';
import { ZodiacCard } from '../../components/zodiac-card/zodiac-card';
import { Spinner } from '../../components/spinner/spinner';

@Component({
  selector: 'app-zodiac-page',
  standalone: true,
  imports: [Spinner, ZodiacCard],
  templateUrl: './zodiac.html',
  styleUrl: './zodiac.css'
})
export class ZodiacPage implements OnInit {
  private zodiacService = inject(ZodiacService);

  zodiacSigns = signal<Zodiac[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

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
