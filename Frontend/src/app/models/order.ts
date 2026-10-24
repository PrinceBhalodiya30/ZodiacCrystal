export type PaymentMethod = 'Card' | 'COD';
export type PaymentStatus = 'Pending' | 'Paid' | 'Refunded' | 'Cancelled';

// What the customer chose at checkout. For 'Card', paymentNonce is the one-time
// token from the Braintree Drop-in - card details never reach our backend.
export interface PaymentDetails {
  paymentMethod: PaymentMethod;
  paymentNonce?: string;
  deviceData?: string;
}

export interface OrderItemInput {
  productId: number;
  quantity: number;
}

export interface CreateOrderRequest extends PaymentDetails {
  items: OrderItemInput[];
  shippingName: string;
  shippingEmail: string;
  shippingAddress: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  deliveryInstructions?: string | null;
  latitude?: number;
  longitude?: number;
  couponCode?: string;
  isGiftWrap?: boolean;
  giftRecipient?: string;
  giftMessage?: string;
  // One per checkout attempt; a retry with the same key returns the order already placed.
  idempotencyKey?: string;
}

export interface OrderItem {
  orderItemId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  orderId: number;
  orderDate: string;
  totalAmount: number;
  status: string;
  shippingName: string;
  shippingEmail: string;
  shippingAddress: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  deliveryInstructions?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  items: OrderItem[];
  couponCode?: string | null;
  discountAmount?: number;
  shippingFee: number;
  isGiftWrap?: boolean;
  giftFee?: number;
  giftRecipient?: string | null;
  giftMessage?: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAt?: string | null;
  confirmedAt?: string | null;
  shippedAt?: string | null;
  courierName?: string | null;
  trackingNumber?: string | null;
  deliveredAt?: string | null;
  // Calculated by the server; null once delivered or cancelled.
  estimatedDeliveryFrom?: string | null;
  estimatedDeliveryTo?: string | null;
  cancellationReason?: string | null;
  // Returns: status of an existing request (null if none) and whether one can
  // still be requested - both decided by the backend's return policy.
  returnStatus?: ReturnStatus | null;
  returnAdminNote?: string | null;
  canRequestReturn: boolean;
  returnWindowEndsAt?: string | null;
}

// Same list as the backend's CancellationReasons.
export const CANCELLATION_REASONS = [
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Delivery is taking too long',
  'Want to change items or address',
  'No longer needed',
  'Other'
];

export type ReturnStatus = 'Requested' | 'Approved' | 'Rejected' | 'Refunded';

export interface OrderSummary {
  orderId: number;
  orderDate: string;
  totalAmount: number;
  status: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  trackingNumber?: string | null;
  deliveredAt?: string | null;
  shippedAt?: string | null;
  productNames?: string[];
  items?: OrderSummaryItem[];
}

export interface OrderSummaryItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl?: string | null;
}

export interface AdminOrder {
  orderId: number;
  customerName: string;
  customerEmail: string;
  orderDate: string;
  totalAmount: number;
  status: string;
  couponCode?: string | null;
  discountAmount?: number;
  shippingFee?: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  isGiftWrap?: boolean;
}

// Admin order drawer: the order (same shape the customer sees) plus who placed
// it, what has happened to it, and which status changes are still allowed.
export type OrderTimelineKind = 'placed' | 'paid' | 'status' | 'cancelled' | 'return' | 'refund';

export interface OrderTimelineEvent {
  at: string | null;
  title: string;
  detail?: string | null;
  kind: OrderTimelineKind;
}

export interface AdminOrderDetail {
  order: Order;
  customerUserId: number;
  customerName: string;
  customerEmail: string;
  allowedNextStatuses: string[];
  timeline: OrderTimelineEvent[];
}
