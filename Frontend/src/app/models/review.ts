// status is only sent to the photo's own author ("Pending" until an admin approves it).
export interface ReviewPhoto {
  reviewImageId: number;
  imageUrl: string;
  status?: 'Pending' | 'Approved' | null;
}

export interface PhotoEligibility {
  canUploadPhotos: boolean;
  maxPhotos: number;
}

export interface Review {
  reviewId: number;
  productId: number;
  userId: number;
  userName: string;
  rating: number;
  comment?: string;
  createdAt: string;
  adminReply?: string;
  adminReplyAt?: string;
  images: ReviewPhoto[];
}

export interface ProductReviews {
  averageRating: number;
  reviewCount: number;
  reviews: Review[];
}

export interface CreateReviewRequest {
  rating: number;
  comment?: string;
}
