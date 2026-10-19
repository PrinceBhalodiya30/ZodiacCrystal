import { PaymentDetails } from './order';

export interface MysteryBoxInfo {
  itemCount: number;
  minimumValue: number;
  price: number;
}

export interface CreateMysteryBoxOrderRequest extends PaymentDetails {
  shippingName: string;
  shippingEmail: string;
  shippingAddress: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  latitude?: number;
  longitude?: number;
  // One per checkout attempt; a retry with the same key returns the order already placed.
  idempotencyKey?: string;
}
