import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CrystalSpecs } from '../../../../utils/crystal-specs.util';

@Component({
  selector: 'app-product-cleansing-ritual',
  standalone: true,
  templateUrl: './product-cleansing-ritual.html',
  styleUrl: './product-cleansing-ritual.css'
})
export class ProductCleansingRitual {
  @Input({ required: true }) specs!: CrystalSpecs;
  @Input({ required: true }) productName!: string;
  @Input() copiedAffirmation = false;

  @Output() readonly copyAffirmation = new EventEmitter<string>();
  @Output() readonly openCleansingGuide = new EventEmitter<string>();

  readonly isHealingOpen = signal(true);
  readonly isCareOpen = signal(false);
  readonly isRitualOpen = signal(false);

  toggleHealingAccordion(): void {
    this.isHealingOpen.update(v => !v);
  }

  toggleCareAccordion(): void {
    this.isCareOpen.update(v => !v);
  }

  toggleRitualAccordion(): void {
    this.isRitualOpen.update(v => !v);
  }
}
