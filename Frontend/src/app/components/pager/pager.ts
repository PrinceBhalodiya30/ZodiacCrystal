import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pager',
  standalone: true,
  templateUrl: './pager.html',
  styleUrl: './pager.css'
})
export class Pager {
  @Input() page = 1;
  @Input() totalPages = 1;
  // Optional: when given, a "Showing 1–20 of 45" line is always shown - even on
  // a single page - so a short list reads as complete rather than unpaged.
  @Input() totalCount?: number;
  @Input() pageSize = 20;
  @Output() pageChange = new EventEmitter<number>();

  get rangeStart(): number {
    return this.totalCount ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.pageSize, this.totalCount ?? 0);
  }

  // Numbered buttons with gaps, always at most 7 slots:
  //   1 2 3 4 5 … 30   |   1 … 14 15 16 … 30   |   1 … 26 27 28 29 30
  get pageItems(): (number | 'gap')[] {
    const total = this.totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (this.page <= 4) {
      return [1, 2, 3, 4, 5, 'gap', total];
    }
    if (this.page >= total - 3) {
      return [1, 'gap', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, 'gap', this.page - 1, this.page, this.page + 1, 'gap', total];
  }

  goTo(page: number | 'gap'): void {
    if (page === 'gap' || page < 1 || page > this.totalPages || page === this.page) {
      return;
    }
    this.pageChange.emit(page);
  }
}
