import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ProductImageService } from '../../../services/product-image.service';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product';
import { ProductImage } from '../../../models/product-image';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { ToastService } from '../../../services/toast.service';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';

@Component({
  selector: 'app-image-manager-modal',
  standalone: true,
  imports: [FormsModule, ImgFallbackDirective],
  templateUrl: './image-manager-modal.html',
  styleUrls: ['../../admin-shared.css', './image-manager-modal.css']
})
export class ImageManagerModal implements OnChanges {
  private productImageService = inject(ProductImageService);
  private productService = inject(ProductService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  @Input({ required: true }) product!: Product;
  @Output() closed = new EventEmitter<void>();
  @Output() productUpdated = new EventEmitter<Product>();

  images = signal<ProductImage[]>([]);
  newImageUrl = '';
  imageError = signal('');
  isSavingImage = signal(false);

  selectedFile: File | null = null;
  isUploadingImage = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product']) {
      this.images.set(this.product.images);
      this.newImageUrl = '';
      this.selectedFile = null;
      this.imageError.set('');
    }
  }

  // Only rendered while open, so no open check needed; defer to a confirm dialog on top.
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmDialog.request()) {
      return;
    }
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  private refresh(): void {
    this.productService.getProduct(this.product.productId).subscribe({
      next: updated => {
        this.images.set(updated.images);
        this.productUpdated.emit(updated);
      }
    });
  }

  addImage(): void {
    const url = this.newImageUrl.trim();

    if (!url) {
      return;
    }

    this.isSavingImage.set(true);
    this.imageError.set('');

    this.productImageService
      .createImage({
        productId: this.product.productId,
        imageUrl: url,
        isPrimary: this.images().length === 0
      })
      .subscribe({
        next: () => {
          this.isSavingImage.set(false);
          this.newImageUrl = '';
          this.toast.success('Image added.');
          this.refresh();
        },
        error: (error: HttpErrorResponse) => {
          this.isSavingImage.set(false);
          this.imageError.set(error.error?.message || 'Unable to add this image.');
        }
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    this.imageError.set('');
  }

  uploadImage(): void {
    const file = this.selectedFile;

    if (!file) {
      return;
    }

    this.isUploadingImage.set(true);
    this.imageError.set('');

    this.productImageService
      .uploadImage(this.product.productId, file, this.images().length === 0)
      .subscribe({
        next: () => {
          this.isUploadingImage.set(false);
          this.selectedFile = null;
          this.toast.success('Image uploaded.');
          this.refresh();
        },
        error: (error: HttpErrorResponse) => {
          this.isUploadingImage.set(false);
          this.imageError.set(error.error?.message || 'Unable to upload this image.');
        }
      });
  }

  setPrimaryImage(image: ProductImage): void {
    if (image.isPrimary) {
      return;
    }

    this.imageError.set('');

    this.productImageService.setPrimary(image.productImageId).subscribe({
      next: () => {
        this.toast.success('Primary image updated.');
        this.refresh();
      },
      error: (error: HttpErrorResponse) => {
        this.imageError.set(error.error?.message || 'Unable to set this image as primary.');
      }
    });
  }

  async deleteImage(image: ProductImage): Promise<void> {
    const confirmed = await this.confirmDialog.confirm('Delete this image?', {
      confirmLabel: 'Delete',
      danger: true
    });

    if (!confirmed) {
      return;
    }

    this.imageError.set('');

    this.productImageService.deleteImage(image.productImageId).subscribe({
      next: () => {
        this.refresh();
        this.toast.success('Image deleted.');
      },
      error: (error: HttpErrorResponse) => {
        const message = error.error?.message || 'Unable to delete this image.';
        this.imageError.set(message);
        this.toast.error(message);
      }
    });
  }
}
