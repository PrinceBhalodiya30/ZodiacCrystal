import { Directive, ElementRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { prefersReducedMotion } from '../utils/motion.util';

// Animates a stat number counting up from its previous value to the new one
// whenever the bound value changes - used on admin dashboard/report stat
// cards so numbers feel alive on load instead of just appearing.
@Directive({
  selector: '[countUp]',
  standalone: true
})
export class CountUpDirective implements OnChanges {
  @Input('countUp') value: number | null = null;
  @Input() countUpPrefix = '';
  @Input() countUpDecimals = 0;
  @Input() countUpDuration = 700;

  private readonly el = inject(ElementRef<HTMLElement>);
  private frame: number | null = null;
  private displayedValue = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['value']) {
      return;
    }

    const target = this.value;
    if (target === null || target === undefined || Number.isNaN(target)) {
      this.el.nativeElement.textContent = '—';
      return;
    }

    if (prefersReducedMotion()) {
      this.displayedValue = target;
      this.el.nativeElement.textContent = this.format(target);
      return;
    }

    this.animate(this.displayedValue, target);
  }

  private animate(from: number, to: number): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
    }

    const start = performance.now();
    const duration = this.countUpDuration;

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;

      this.displayedValue = progress === 1 ? to : current;
      this.el.nativeElement.textContent = this.format(this.displayedValue);

      if (progress < 1) {
        this.frame = requestAnimationFrame(step);
      } else {
        this.frame = null;
      }
    };

    this.frame = requestAnimationFrame(step);
  }

  private format(value: number): string {
    return `${this.countUpPrefix}${value.toLocaleString('en-IN', {
      minimumFractionDigits: this.countUpDecimals,
      maximumFractionDigits: this.countUpDecimals
    })}`;
  }
}
