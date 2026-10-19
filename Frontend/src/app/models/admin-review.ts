export type ReviewStatus = 'Approved' | 'Rejected';
export type ReviewPhotoStatus = 'Pending' | 'Approved' | 'Rejected';
// '' = all reviews, 'any' = with photos, 'pending' = photos awaiting approval.
export type ReviewPhotoFilter = '' | 'any' | 'pending';

export interface AdminReviewPhoto {
  reviewImageId: number;
  imageUrl: string;
  status: ReviewPhotoStatus;
}

export interface AdminReview {
  reviewId: number;
  productId: number;
  productName: string;
  userId: number;
  userName: string;
  rating: number;
  comment?: string;
  createdAt: string;
  status: ReviewStatus;
  adminReply?: string;
  adminReplyAt?: string;
  images: AdminReviewPhoto[];
}
