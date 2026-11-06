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

  @Output() copyAffirmation = new EventEmitter<string>();
  @Output() openCleansingGuide = new EventEmitter<string>();

  isHealingOpen = signal(true);
  isCareOpen = signal(false);
  isRitualOpen = signal(false);

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
