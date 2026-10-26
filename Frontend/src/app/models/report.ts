export interface ReportSummary {
  totalRevenue: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  // collectedRevenue + pendingCodRevenue = totalRevenue
  collectedRevenue: number;
  pendingCodRevenue: number;
  refundedAmount: number;
}

export interface TopProduct {
  productId: number;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface CategorySales {
  categoryId: number;
  categoryName: string;
  quantitySold: number;
  revenue: number;
}

export interface DailySales {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface ZodiacSales {
  zodiacId: number;
  zodiacName: string;
  vedicRashi?: string;
  displayName?: string;
  symbol?: string | null;
  quantitySold: number;
  revenue: number;
}

export interface CouponPerformance {
  code: string;
  orderCount: number;
  discountGiven: number;
  sales: number;
  isActive: boolean;
}

export interface UnsoldProduct {
  productId: number;
  productName: string;
  sku: string;
  categoryName: string;
  stockQuantity: number;
  price: number;
}

export interface UnsoldProducts {
  totalCount: number;
  items: UnsoldProduct[];
}

// Dashboard "Store insights" - orders placed in the range.
export interface OrderInsights {
  statusCounts: { status: string; count: number }[];
  paymentMethods: { method: string; orders: number; revenue: number }[];
  cancellationReasons: { reason: string; count: number }[];
  // Not range-bound: still Shipped well past the delivery estimate.
  overdueDeliveries: number;
}

// Reports page "Operations" - orders placed in the range.
export interface ReasonCount {
  reason: string;
  count: number;
}

export interface ReportOperations {
  fulfilment: {
    hoursToConfirm: number | null;
    hoursToShip: number | null;
    hoursToDeliver: number | null;
    hoursEndToEnd: number | null;
    deliveredCount: number;
  };
  returns: {
    requested: number;
    approved: number;
    rejected: number;
    refunded: number;
    deliveredOrders: number;
    returnRate: number;
    refundedAmount: number;
    reasons: ReasonCount[];
    topProducts: { productId: number; productName: string; returnCount: number; unitsReturned: number }[];
  };
  cancellations: {
    cancelled: number;
    totalOrders: number;
    cancellationRate: number;
    byCustomer: number;
    byAdmin: number;
    cardCancellationRate: number;
    codCancellationRate: number;
    reasons: ReasonCount[];
  };
  customers: {
    customers: number;
    newCustomers: number;
    returningCustomers: number;
    repeatRate: number;
    topCustomers: { userId: number; name: string; email: string; orders: number; spent: number }[];
  };
  states: { state: string; orders: number; revenue: number }[];
}
