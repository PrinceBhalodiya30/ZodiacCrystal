export interface Zodiac {
  zodiacId: number;
  name: string;
  rashiName?: string;
  displayName?: string;
  symbol?: string;
  description?: string;
  imageUrl?: string;
}

export interface ZodiacRequest {
  name: string;
  rashiName?: string;
  symbol?: string;
  description?: string;
  imageUrl?: string;
}
