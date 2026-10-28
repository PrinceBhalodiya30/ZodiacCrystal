import { Injectable, signal } from '@angular/core';

export type CleansingGuideTab = 'cleansing' | 'charging' | 'checker' | 'ritual';

@Injectable({ providedIn: 'root' })
export class CleansingGuideService {
  isOpen = signal(false);
  activeTab = signal<CleansingGuideTab>('cleansing');
  searchMineral = signal('');

  open(tab: CleansingGuideTab = 'cleansing', mineralName?: string): void {
    this.activeTab.set(tab);
    if (mineralName) {
      this.searchMineral.set(mineralName);
    }
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  setTab(tab: CleansingGuideTab): void {
    this.activeTab.set(tab);
  }
}
