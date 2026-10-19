export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

const LOW_STOCK_THRESHOLD = 5;

export function getStockStatus(stockQuantity: number): StockStatus {
  if (stockQuantity <= 0) {
    return 'out-of-stock';
  }
  if (stockQuantity <= LOW_STOCK_THRESHOLD) {
    return 'low-stock';
  }
  return 'in-stock';
}

export function getStockLabel(stockQuantity: number): string {
  switch (getStockStatus(stockQuantity)) {
    case 'out-of-stock':
      return 'Out of Stock';
    case 'low-stock':
      return `Only ${stockQuantity} left`;
    default:
      return 'In Stock';
  }
}
