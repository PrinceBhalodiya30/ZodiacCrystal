import { Pipe, PipeTransform } from '@angular/core';

// ₹ amounts with Indian digit grouping (₹1,00,000.00), matching the count-up stats.
export function formatInr(value: number | null | undefined, decimals = 2): string {
  const amount = Number(value ?? 0);
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

// {{ order.totalAmount | inr }}  ->  ₹1,23,456.00
// {{ kpi.value | inr:0 }}        ->  ₹1,23,456
@Pipe({ name: 'inr', standalone: true })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 2): string {
    return formatInr(value, decimals);
  }
}
