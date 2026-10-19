export interface Zodiac {
  zodiacId: number;
  name: string;
  symbol?: string;
  description?: string;
  imageUrl?: string;
}

export interface ZodiacRequest {
  name: string;
  symbol?: string;
  description?: string;
  imageUrl?: string;
}
