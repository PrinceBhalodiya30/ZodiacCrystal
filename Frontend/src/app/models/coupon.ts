export type CouponDiscountType = 'Percentage' | 'Fixed';

export interface Coupon {
  couponId: number;
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumOrderAmount: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  usedCount: number;
  maxUsesPerUser?: number | null;
  isActive: boolean;
  createdAt: string;
  notifiedAt?: string | null;
}

export interface CreateCouponRequest {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumOrderAmount: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  maxUsesPerUser?: number | null;
  isActive: boolean;
}

export interface UpdateCouponRequest {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumOrderAmount: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  maxUsesPerUser?: number | null;
  isActive: boolean;
}

export interface ValidateCouponRequest {
  code: string;
  orderAmount: number;
}

export interface CouponValidationResult {
  valid: boolean;
  code: string | null;
  discountAmount: number;
  message: string;
}

export interface PublicCoupon {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumOrderAmount: number;
  endDate: string;
}
