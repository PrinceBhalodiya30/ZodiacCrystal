import { PaymentMethod, PaymentStatus, ReturnStatus } from './order';

export type TicketStatus = 'Open' | 'AwaitingCustomer' | 'Resolved' | 'Closed';

export type TicketCategory = 'OrderStatus' | 'DamagedOrWrong' | 'Payment' | 'CancelOrChange' | 'Product' | 'Account' | 'Other';

export const TICKET_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'OrderStatus', label: 'Where is my order?' },
  { value: 'DamagedOrWrong', label: 'Damaged, wrong or missing item' },
  { value: 'Payment', label: 'Payment or refund' },
  { value: 'CancelOrChange', label: 'Cancel or change my order' },
  { value: 'Product', label: 'Product question' },
  { value: 'Account', label: 'My account' },
  { value: 'Other', label: 'Something else' }
];

// Matches SupportPolicy on the server.
export const SUPPORT_REPLY_WITHIN_HOURS = 24;
export const SUPPORT_MAX_PHOTOS = 3;

export interface TicketMessage {
  ticketMessageId: number;
  isFromAdmin: boolean;
  isInternal: boolean;
  senderName: string;
  body: string;
  attachments: string[];
  createdAt: string;
  isEdited: boolean;
  isDeleted: boolean;
  // Admin view: this admin may edit / delete it now.
  canModify: boolean;
  // Admin view: end of the edit window for a reply (null for notes / not editable).
  editableUntil?: string | null;
}

export interface TicketOrderContext {
  orderId: number;
  orderDate: string;
  status: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  trackingNumber?: string | null;
  courierName?: string | null;
  deliveredAt?: string | null;
  returnStatus?: ReturnStatus | null;
  canRequestReturn: boolean;
  productNames: string[];
}

export interface SupportTicket {
  supportTicketId: number;
  reference: string;
  orderId?: number | null;
  category: TicketCategory;
  categoryLabel: string;
  subject: string;
  status: TicketStatus;
  statusLabel: string;
  unread: boolean;
  isOverdue: boolean;
  rating?: number | null;
  ratingComment?: string | null;
  createdAt: string;
  lastMessageAt: string;
  resolvedAt?: string | null;
  lastMessagePreview?: string | null;
  customerName: string;
  customerEmail: string;
  messages?: TicketMessage[];
  order?: TicketOrderContext | null;
}

export interface CreateTicket {
  orderId?: number | null;
  category: TicketCategory;
  subject: string;
  message: string;
  files?: File[];
}

export interface TicketCounts {
  open: number;
  unread: number;
  overdue: number;
}
