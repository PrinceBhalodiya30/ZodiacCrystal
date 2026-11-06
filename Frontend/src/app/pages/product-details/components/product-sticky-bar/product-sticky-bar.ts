import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InrPipe } from '../../../../pipes/inr.pipe';
import { Product } from '../../../../models/product';

@Component({
  selector: 'app-product-sticky-bar',
  standalone: true,
  imports: [RouterLink, InrPipe],
  templateUrl: './product-sticky-bar.html',
  styleUrl: './product-sticky-bar.css'
})
export class ProductStickyBar {
  @Input({ required: true }) product!: Product;
  @Input() isOutOfStock = false;
  @Input() justAdded = false;
  @Input() cartQuantity = 0;

  @Output() addToCart = new EventEmitter<void>();
}

