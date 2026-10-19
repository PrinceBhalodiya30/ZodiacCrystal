import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Zodiac } from '../../models/zodiac';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { ZodiacIcon } from '../zodiac-icon/zodiac-icon';

@Component({
  selector: 'app-zodiac-card',
  standalone: true,
  imports: [RouterLink, ImgFallbackDirective, ZodiacIcon],
  templateUrl: './zodiac-card.html',
  styleUrl: './zodiac-card.css'
})
export class ZodiacCard {
  @Input({ required: true }) zodiac!: Zodiac;
  @Input() showButton = false;
}
