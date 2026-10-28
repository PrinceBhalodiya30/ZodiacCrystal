import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CleansingGuideService, CleansingGuideTab } from '../../services/cleansing-guide.service';

export interface MineralCareGuideItem {
  name: string;
  waterSafe: boolean;
  waterNote: string;
  sunSafe: boolean;
  sunNote: string;
  bestCleanser: string;
  chakra: string;
  element: string;
  affirmation: string;
}

export const MINERAL_CARE_ITEMS: MineralCareGuideItem[] = [
  {
    name: 'Amethyst',
    waterSafe: true,
    waterNote: 'Safe for gentle cool water rinses.',
    sunSafe: false,
    sunNote: 'Avoid prolonged direct sun (may fade deep violet tones over time).',
    bestCleanser: 'Full Moonlight & Selenite Charging Plates',
    chakra: 'Third Eye & Crown',
    element: 'Air & Water',
    affirmation: 'I am calm, peaceful, and aligned with my highest inner wisdom.'
  },
  {
    name: 'Rose Quartz',
    waterSafe: true,
    waterNote: 'Safe for brief clean water rinses.',
    sunSafe: false,
    sunNote: 'Avoid intense midday sun to protect delicate pale pink tones.',
    bestCleanser: 'Lavender smoke & morning indirect sunlight',
    chakra: 'Heart Chakra',
    element: 'Water & Earth',
    affirmation: 'I open my heart to give and receive unconditional compassion.'
  },
  {
    name: 'Selenite',
    waterSafe: false,
    waterNote: 'DO NOT WET — Water soluble gypsum mineral that degrades & loses luster in moisture.',
    sunSafe: true,
    sunNote: 'Radiates under indirect sun & brilliant full moonlight.',
    bestCleanser: 'Sacred Sage smoke or Sound Bowls (Self-clearing mineral)',
    chakra: 'Crown & Soul Star',
    element: 'Air & Light',
    affirmation: 'Divine light pours through my spirit, clearing all lower density.'
  },
  {
    name: 'Pyrite (Fool’s Gold)',
    waterSafe: false,
    waterNote: 'AVOID WATER — High iron content leads to oxidation and surface rusting.',
    sunSafe: true,
    sunNote: 'Thrives in warm solar radiance and dry sunlight.',
    bestCleanser: 'Dry Sage smudging & Golden morning sun',
    chakra: 'Solar Plexus',
    element: 'Fire & Earth',
    affirmation: 'I am a magnetic conduit for prosperity, confidence, and golden opportunity.'
  },
  {
    name: 'Malachite',
    waterSafe: false,
    waterNote: 'DO NOT SUBMERGE — Copper carbonate reacts with water; moisture releases hazardous particles.',
    sunSafe: false,
    sunNote: 'Avoid harsh direct sunlight which causes cracking.',
    bestCleanser: 'Selenite slabs or Sound frequency tuning (432 Hz)',
    chakra: 'Heart & Solar Plexus',
    element: 'Earth & Fire',
    affirmation: 'I release past trauma and boldly step into transformative growth.'
  },
  {
    name: 'Clear Quartz',
    waterSafe: true,
    waterNote: '100% Water safe — Excellent for running stream cleansing.',
    sunSafe: true,
    sunNote: 'Loves direct sunlight (Master amplifier of solar & lunar energy).',
    bestCleanser: 'Running water, Moonlight, and Sound bells',
    chakra: 'All 7 Chakras',
    element: 'Ether & All Elements',
    affirmation: 'My mind is lucid, focused, and attuned to the universe.'
  },
  {
    name: 'Black Tourmaline',
    waterSafe: true,
    waterNote: 'Safe for brief rinses (dry immediately with a soft cloth).',
    sunSafe: true,
    sunNote: 'Safe for sunlight; charges deeply in natural light.',
    bestCleanser: 'Mother Earth burial & Frankincense smoke',
    chakra: 'Root Chakra',
    element: 'Earth',
    affirmation: 'I am firmly grounded, shielded from negativity, and completely safe.'
  },
  {
    name: 'Black Obsidian',
    waterSafe: true,
    waterNote: 'Water safe — Natural volcanic glass impervious to water.',
    sunSafe: true,
    sunNote: 'Safe in direct sun and full moonlight.',
    bestCleanser: 'Cool running stream water & Full Moonlight',
    chakra: 'Root Chakra',
    element: 'Fire & Earth',
    affirmation: 'I dissolve shadow patterns and reclaim my inner truth and power.'
  },
  {
    name: 'Citrine',
    waterSafe: true,
    waterNote: 'Safe for cool water rinses.',
    sunSafe: true,
    sunNote: 'Loves golden sunlight (Premier stone of solar abundance).',
    bestCleanser: 'Morning sunlight & running water',
    chakra: 'Solar Plexus & Sacral',
    element: 'Fire',
    affirmation: 'Wealth, success, and joyful vitality flow to me effortlessly.'
  },
  {
    name: 'Rainbow Fluorite',
    waterSafe: false,
    waterNote: 'CAUTION — Soft mineral (Mohs 4); water degrades finish and causes microscopic fissures.',
    sunSafe: false,
    sunNote: 'Avoid direct sun (colors can bleach rapidly).',
    bestCleanser: 'Selenite charging plate or acoustic singing bowls',
    chakra: 'Heart, Third Eye & Crown',
    element: 'Air & Water',
    affirmation: 'My thoughts are organized, sharp, and anchored in higher clarity.'
  },
  {
    name: 'Lapis Lazuli',
    waterSafe: false,
    waterNote: 'AVOID WATER — Porous rock with calcite inclusions; water dulls protective polish.',
    sunSafe: false,
    sunNote: 'Limit direct sun to preserve vivid deep ultramarine blues.',
    bestCleanser: 'Sacred Palo Santo smoke & gentle Moonlight',
    chakra: 'Third Eye & Throat',
    element: 'Water & Air',
    affirmation: 'I speak my sacred truth with wisdom, authority, and grace.'
  },
  {
    name: 'Moonstone',
    waterSafe: true,
    waterNote: 'Safe for brief gentle rinses.',
    sunSafe: false,
    sunNote: 'Prefers cool moonlight over harsh dehydrating sunlight.',
    bestCleanser: 'Full Moonlight immersion (overnight on window sill)',
    chakra: 'Crown & Third Eye',
    element: 'Water & Ether',
    affirmation: 'I surrender to divine life cycles and welcome new beginnings.'
  },
  {
    name: 'Carnelian',
    waterSafe: true,
    waterNote: 'Water safe — Durable quartz variety.',
    sunSafe: true,
    sunNote: 'Thrives in bright afternoon sunlight.',
    bestCleanser: 'Direct warm sun & clear running water',
    chakra: 'Sacral Chakra',
    element: 'Fire',
    affirmation: 'I am filled with creative passion, courage, and unstoppable drive.'
  },
  {
    name: 'Golden Tiger’s Eye',
    waterSafe: true,
    waterNote: 'Water safe — Polished quartz family.',
    sunSafe: true,
    sunNote: 'Safe and empowered by solar rays.',
    bestCleanser: 'Sunlight charging & Sage smoke',
    chakra: 'Solar Plexus & Root',
    element: 'Earth & Fire',
    affirmation: 'I walk with fearlessness, discernment, and steady confidence.'
  },
  {
    name: 'Smoky Quartz',
    waterSafe: true,
    waterNote: 'Water safe — Durable crystalline quartz.',
    sunSafe: false,
    sunNote: 'Avoid prolonged intense midday sun to prevent color fading.',
    bestCleanser: 'Burying in soil for 24 hours & running water',
    chakra: 'Root Chakra',
    element: 'Earth',
    affirmation: 'I surrender all anxiety and ground into emotional stability.'
  },
  {
    name: 'Green Aventurine & Jade',
    waterSafe: true,
    waterNote: 'Water safe — Enjoys cool fresh water baths.',
    sunSafe: true,
    sunNote: 'Safe in gentle morning sunlight.',
    bestCleanser: 'Fresh water rinse & green plant proximity',
    chakra: 'Heart Chakra',
    element: 'Earth',
    affirmation: 'I welcome good fortune, lucky synchronicity, and new ventures.'
  }
];

@Component({
  selector: 'app-cleansing-guide-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './cleansing-guide-modal.html',
  styleUrl: './cleansing-guide-modal.css'
})
export class CleansingGuideModal {
  guideService = inject(CleansingGuideService);

  isOpen = this.guideService.isOpen;
  activeTab = this.guideService.activeTab;
  searchQuery = signal('');
  safetyFilter = signal<'all' | 'safe' | 'sensitive'>('all');

  readonly minerals = MINERAL_CARE_ITEMS;

  filteredMinerals = computed(() => {
    let items = this.minerals;
    const query = (this.searchQuery() || this.guideService.searchMineral()).trim().toLowerCase();
    if (query) {
      items = items.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.chakra.toLowerCase().includes(query) ||
        m.element.toLowerCase().includes(query)
      );
    }

    const filter = this.safetyFilter();
    if (filter === 'safe') {
      items = items.filter(m => m.waterSafe);
    } else if (filter === 'sensitive') {
      items = items.filter(m => !m.waterSafe);
    }

    return items;
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  setTab(tab: CleansingGuideTab): void {
    this.guideService.setTab(tab);
  }

  close(): void {
    this.guideService.close();
  }

  setSafetyFilter(filter: 'all' | 'safe' | 'sensitive'): void {
    this.safetyFilter.set(filter);
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.guideService.searchMineral.set(value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.guideService.searchMineral.set('');
  }
}
