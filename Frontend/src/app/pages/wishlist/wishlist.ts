import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WishlistService } from '../../services/wishlist.service';
import { WishlistItem } from '../../models/wishlist';
import { Product } from '../../models/product';
import { ProductCardSkeleton } from '../../components/product-card-skeleton/product-card-skeleton';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [ProductCardSkeleton, RouterLink, ProductCard],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css'
})
export class Wishlist implements OnInit {
  wishlistService = inject(WishlistService);

  ngOnInit(): void {
    this.wishlistService.loadWishlist();
  }

  toProduct(item: WishlistItem): Product {
    return {
      productId: item.productId,
      sku: '',
      name: item.productName,
      price: item.price,
      stockQuantity: item.stockQuantity,
      categoryId: 0,
      isActive: item.isActive,
      createdAt: item.addedAt,
      images: item.primaryImageUrl
        ? [
            {
              productImageId: 0,
              productId: item.productId,
              imageUrl: item.primaryImageUrl,
              isPrimary: true
            }
          ]
        : [],
      zodiacs: []
    };
  }
}
