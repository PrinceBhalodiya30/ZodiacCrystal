import { ProductImage } from './product-image';
import { Zodiac } from './zodiac';

export interface Product {
  productId: number;
  sku: string;
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
  categoryId: number;
  categoryName?: string;
  isActive: boolean;
  createdAt: string;
  averageRating?: number | null;
  reviewCount?: number;
  images: ProductImage[];
  zodiacs: Zodiac[];
}

export interface ProductRequest {
  sku: string;
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
  categoryId: number;
  isActive: boolean;
  zodiacIds: number[];
}
