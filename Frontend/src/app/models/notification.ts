export type NotificationType =
  | 'OrderPlaced'
  | 'OrderStatusChanged'
  | 'LowStock'
  | 'ReturnUpdated'
  | 'Welcome'
  | 'Coupon'
  | 'BackInStock'
  | 'PriceDrop'
  | 'TicketUpdated'
  | 'SupportTicket';

export interface AppNotification {
  notificationId: number;
  orderId?: number | null;
  couponCode?: string | null;
  // Back-in-stock and price-drop notifications open this product.
  productId?: number | null;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}
