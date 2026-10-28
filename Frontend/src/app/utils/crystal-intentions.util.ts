import { Product } from '../models/product';

export interface SacredIntention {
  id: string;
  name: string;
  tagline: string;
  description: string;
  alignedCrystals: string;
  badge: string;
  keywords: string[];
}

export const SACRED_INTENTIONS: SacredIntention[] = [
  {
    id: 'wealth',
    name: 'Wealth & Success',
    tagline: 'Abundance, Financial Prosperity & Magnetism',
    description: 'Attune your vibration to limitless abundance, business breakthrough, and confidence to claim your highest wealth.',
    alignedCrystals: 'Pyrite · Citrine · Green Jade · Tiger’s Eye · Aventurine',
    badge: 'Solar Abundance',
    keywords: ['pyrite', 'citrine', 'jade', 'tiger', 'aventurine', 'malachite', 'money', 'prosperity', 'abundance', 'wealth', 'success']
  },
  {
    id: 'love',
    name: 'Love & Harmony',
    tagline: 'Compassion, Heart Awakening & Soul Resonance',
    description: 'Open the sacred heart chakra to attract pure love, cultivate tender self-compassion, and foster family harmony.',
    alignedCrystals: 'Rose Quartz · Moonstone · Rhodonite · Malachite · Kunzite',
    badge: 'Heart Resonance',
    keywords: ['rose quartz', 'rose', 'moonstone', 'rhodonite', 'kunzite', 'emerald', 'unconditional love', 'heart chakra', 'compassion', 'love']
  },
  {
    id: 'protection',
    name: 'Protection & Grounding',
    tagline: 'Aura Defense, EMF Shielding & Energy Clearing',
    description: 'Anchor yourself in deep stability, deflect environmental negativity, and cleanse heavy unwanted frequencies.',
    alignedCrystals: 'Black Tourmaline · Black Obsidian · Smoky Quartz · Hematite',
    badge: 'Aura Armor',
    keywords: ['tourmaline', 'obsidian', 'smoky', 'smokey', 'shungite', 'hematite', 'shield', 'grounding', 'psychic protection', 'protection']
  },
  {
    id: 'peace',
    name: 'Peace & Sleep',
    tagline: 'Calmness, Restorative Rest & Anxiety Relief',
    description: 'Still a busy mind, dissolve emotional turbulence, and welcome deep restorative sleep within your sacred sanctuary.',
    alignedCrystals: 'Amethyst · Selenite · Blue Quartz · Celestite · Lepidolite',
    badge: 'Restorative Serenity',
    keywords: ['amethyst', 'selenite', 'celestite', 'lepidolite', 'howlite', 'calm', 'restorative', 'peaceful sleep', 'peace', 'sleep']
  },
  {
    id: 'intuition',
    name: 'Clarity & Intuition',
    tagline: 'Third Eye Insight, Wisdom & Spiritual Awakening',
    description: 'Clear brain fog, sharpen spiritual discernment, and unlock the sacred whisper of your highest inner guidance.',
    alignedCrystals: 'Clear Quartz · Lapis Lazuli · Rainbow Fluorite · Labradorite',
    badge: 'Third Eye Vision',
    keywords: ['clear quartz', 'lapis', 'labradorite', 'sodalite', 'fluorite', 'third eye', 'insight', 'mental order', 'intuition', 'clarity']
  },
  {
    id: 'energy',
    name: 'Vitality & Energy',
    tagline: 'Passion, Motivation, Creative Fire & Stamina',
    description: 'Reignite sluggish motivation, stimulate the sacral creative waters, and infuse your spirit with bold courageous drive.',
    alignedCrystals: 'Carnelian · Red Jasper · Sunstone · Almandine Garnet',
    badge: 'Pranic Fire',
    keywords: ['carnelian', 'jasper', 'sunstone', 'garnet', 'bloodstone', 'vitality', 'sacral', 'fire sign', 'motivation', 'passion']
  }
];

export function getIntentionById(id: string | null | undefined): SacredIntention | null {
  if (!id) return null;
  const normalized = id.trim().toLowerCase();
  return SACRED_INTENTIONS.find(i => i.id === normalized || i.name.toLowerCase().includes(normalized)) ?? null;
}

export function productMatchesIntention(product: Product, intention: SacredIntention): boolean {
  const searchText = `${product.name} ${product.description ?? ''} ${product.chakra ?? ''} ${product.categoryName ?? ''}`.toLowerCase();
  return intention.keywords.some(kw => searchText.includes(kw));
}

