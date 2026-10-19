import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

// Fades/slides a section in the first time it enters the viewport - used on
// homepage sections so a long static scroll has some life to it. Falls back
// to always-visible when IntersectionObserver isn't available.
@Directive({
  selector: '[scrollReveal]',
  standalone: true
})
export class ScrollRevealDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const element = this.el.nativeElement;
    element.classList.add('scroll-reveal');

    if (typeof IntersectionObserver === 'undefined') {
      element.classList.add('scroll-reveal-visible');
      return;
    }

    this.observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            element.classList.add('scroll-reveal-visible');
            this.observer?.unobserve(element);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    this.observer.observe(element);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
