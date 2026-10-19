import { PaymentMethod, PaymentStatus, ReturnStatus } from './order';

export type ReturnReason = 'Damaged' | 'WrongItem' | 'NotAsDescribed' | 'ChangedMind' | 'Other';

export const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'Damaged', label: 'Item arrived damaged' },
  { value: 'WrongItem', label: 'Received the wrong item' },
  { value: 'NotAsDescribed', label: 'Not as described' },
  { value: 'ChangedMind', label: 'Changed my mind' },
  { value: 'Other', label: 'Other' }
];

export interface ReturnRequest {
  returnRequestId: number;
  orderId: number;
  reason: ReturnReason;
  reasonLabel: string;
  details?: string | null;
  status: ReturnStatus;
  adminNote?: string | null;
  restocked: boolean;
  createdAt: string;
  resolvedAt?: string | null;
  orderTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  customerName: string;
  customerEmail: string;
}

export interface CreateReturnRequest {
  orderId: number;
  reason: ReturnReason;
  details?: string;
}
