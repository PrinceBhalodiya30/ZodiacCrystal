import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  HostListener,
  OnChanges,
  SimpleChanges,
  inject,
  PLATFORM_ID,
  viewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-drawer',
  standalone: true,
  templateUrl: './drawer.html',
  styleUrl: './drawer.css'
})
export class Drawer implements OnChanges {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() placement: 'right' | 'left' = 'right';
  @Input() width = '480px';
  @Input() closeOnBackdrop = true;
  @Input() closeOnEsc = true;
  @Input() showCloseButton = true;
  @Input() backdropType: 'dim' | 'transparent' = 'dim';
  @Input() ariaLabel = '';

  @Output() closed = new EventEmitter<void>();

  private readonly platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private previousActiveElement: HTMLElement | null = null;
  private drawerPanel = viewChild<ElementRef<HTMLElement>>('drawerEl');

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.isOpen && this.closeOnEsc) {
      event.preventDefault();
      this.close();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen || event.key !== 'Tab') return;

    const drawer = this.drawerPanel()?.nativeElement;
    if (!drawer) return;

    const focusable = drawer.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isBrowser) return;

    if (changes['isOpen']) {
      if (this.isOpen) {
        this.previousActiveElement = document.activeElement as HTMLElement;
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
          const drawer = this.drawerPanel()?.nativeElement;
          if (drawer) {
            const firstFocusable = drawer.querySelector<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            firstFocusable?.focus();
          }
        }, 50);
      } else {
        document.body.style.overflow = '';
        if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
          this.previousActiveElement.focus();
        }
      }
    }
  }

  onBackdropClick(): void {
    if (this.closeOnBackdrop) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }
}
