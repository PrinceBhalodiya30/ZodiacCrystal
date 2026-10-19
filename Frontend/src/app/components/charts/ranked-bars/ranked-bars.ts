import { Component, Input } from '@angular/core';

export interface RankedBarItem {
  id: number | string;
  label: string;
  // What the bar length and ordering are based on.
  value: number;
  // Shown on the right, e.g. "₹12,400" or "38 units".
  valueText: string;
  // Shown under the name, e.g. "38 units · 24% of sales".
  detail?: string;
}

// Ranked horizontal bars - the usual "top products / top categories" view:
// full names, the value on every row, bars relative to the #1 item.
@Component({
  selector: 'app-ranked-bars',
  standalone: true,
  templateUrl: './ranked-bars.html',
  styleUrl: './ranked-bars.css'
})
export class RankedBars {
  @Input() items: RankedBarItem[] = [];
  @Input() emptyMessage = 'No data for this range.';
  @Input() ariaLabel = 'Ranking';

  get maxValue(): number {
    return Math.max(...this.items.map(i => i.value), 0);
  }

  barScale(item: RankedBarItem): number {
    const max = this.maxValue;
    // Keep a sliver visible for tiny values so the row doesn't look empty.
    return max > 0 ? Math.max(item.value / max, 0.015) : 0;
  }
}
