import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReviewPhotoPicker, PickedPhoto } from '../../../../components/review-photos/review-photo-picker';
import { ReviewPhotoThumbs, ThumbPhoto } from '../../../../components/review-photos/review-photo-thumbs';
import { PhotoEligibility, Review } from '../../../../models/review';
import { getStars as getStarsUtil } from '../../../../utils/rating.util';

@Component({
  selector: 'app-product-reviews',
  standalone: true,
  imports: [DatePipe, ReviewPhotoPicker, ReviewPhotoThumbs],
  templateUrl: './product-reviews.html',
  styleUrl: './product-reviews.css'
})
export class ProductReviews {
  @Input({ required: true }) productId!: number;
  @Input({ required: true }) siteName!: string;
  @Input() isLoggedIn = false;
  @Input() hasReviewed = false;
  @Input() reviews: Review[] = [];
  @Input() averageRating = 0;
  @Input() reviewCount = 0;
  @Input() reviewsLoading = false;
  @Input() reviewsError = '';
  @Input() photoEligibility: PhotoEligibility | null = null;
  @Input() customerPhotos: ThumbPhoto[] = [];
  @Input() reviewRating = 0;
  @Input() reviewComment = '';
  @Input() reviewPhotos: PickedPhoto[] = [];
  @Input() isSubmittingReview = false;
  @Input() canDeleteReviewFn: (review: Review) => boolean = () => false;

  @Output() readonly retry = new EventEmitter<number>();
  @Output() readonly ratingChange = new EventEmitter<number>();
  @Output() readonly commentChange = new EventEmitter<string>();
  @Output() readonly photosChange = new EventEmitter<PickedPhoto[]>();
  @Output() readonly submitReview = new EventEmitter<void>();
  @Output() readonly deleteReview = new EventEmitter<Review>();
  @Output() readonly openPhoto = new EventEmitter<{ photos: ThumbPhoto[]; index: number; caption: string }>();

  getStars(rating: number): string {
    return getStarsUtil(rating);
  }

  canDeleteReview(review: Review): boolean {
    return this.canDeleteReviewFn(review);
  }

  reviewThumbs(review: Review): ThumbPhoto[] {
    return (review.images ?? []).map(photo => ({
      imageUrl: photo.imageUrl,
      pending: photo.status === 'Pending',
      alt: `Photo by ${review.userName}`
    }));
  }

  onPhotosUpdated(photos: PickedPhoto[]): void {
    this.photosChange.emit(photos);
  }

  triggerOpenPhoto(photos: ThumbPhoto[], index: number, caption: string): void {
    this.openPhoto.emit({ photos, index, caption });
  }
}
