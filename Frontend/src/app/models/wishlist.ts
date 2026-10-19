export interface WishlistItem {
  productId: number;
  productName: string;
  price: number;
  primaryImageUrl?: string | null;
  stockQuantity: number;
  isActive: boolean;
  addedAt: string;
}
