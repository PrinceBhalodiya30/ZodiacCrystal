import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MysteryBoxService } from '../../services/mystery-box.service';
import { ZodiacService } from '../../services/zodiac.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { Spinner } from '../../components/spinner/spinner';
import { MysteryBoxInfo } from '../../models/mystery-box';
import { Zodiac } from '../../models/zodiac';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { InrPipe } from '../../pipes/inr.pipe';
import { VedicZodiacPipe } from '../../pipes/vedic-zodiac.pipe';
import { ZodiacIcon } from '../../components/zodiac-icon/zodiac-icon';

@Component({
  selector: 'app-mystery-box',
  standalone: true,
  imports: [InrPipe, Spinner, ImgFallbackDirective, VedicZodiacPipe, ZodiacIcon],
  templateUrl: './mystery-box.html',
  styleUrl: './mystery-box.css'
})
export class MysteryBox implements OnInit {
  private mysteryBoxService = inject(MysteryBoxService);
  private zodiacService = inject(ZodiacService);
  private authService = inject(AuthService);
  private cartService = inject(CartService);
  private router = inject(Router);

  zodiacSigns = signal<Zodiac[]>([]);
  selectedZodiacId = signal<number | null>(null);
  selectedZodiac = computed(() => this.zodiacSigns().find(z => z.zodiacId === this.selectedZodiacId()) ?? null);

  info = signal<MysteryBoxInfo | null>(null);
  isLoadingInfo = signal(true);
  infoError = signal('');

  ngOnInit(): void {
    this.loadInfo();
    this.loadZodiacSigns();
  }

  selectZodiac(zodiacId: number): void {
    this.selectedZodiacId.set(zodiacId);
  }

  private loadZodiacSigns(): void {
    this.zodiacService.getZodiacSigns().subscribe({
      next: signs => {
        this.zodiacSigns.set(signs);
        if (signs.length > 0 && !this.selectedZodiacId()) {
          this.selectedZodiacId.set(signs[0].zodiacId);
        }
      },
      error: () => {}
    });
  }

  private loadInfo(): void {
    this.isLoadingInfo.set(true);
    this.infoError.set('');

    this.mysteryBoxService.getInfo().subscribe({
      next: info => {
        this.info.set(info);
        this.isLoadingInfo.set(false);
      },
      error: () => {
        this.infoError.set('Unable to load the Mystery Crystal Box right now.');
        this.isLoadingInfo.set(false);
      }
    });
  }

  startPurchase(): void {
    const info = this.info();
    if (!info) {
      return;
    }

    const zodiac = this.selectedZodiac();
    this.cartService.setBuyNowMysteryBox({
      zodiacId: zodiac?.zodiacId,
      zodiacName: zodiac?.name,
      zodiacImageUrl: zodiac?.imageUrl,
      price: info.price,
      itemCount: info.itemCount,
      minimumValue: info.minimumValue
    });

    this.router.navigate(['/checkout']);
  }
}
