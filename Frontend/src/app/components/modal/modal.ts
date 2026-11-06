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
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.html',
  styleUrl: './modal.css'
})
export class Modal implements OnChanges {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() maxWidth = '640px';
  @Input() closeOnBackdrop = true;
  @Input() closeOnEsc = true;
  @Input() showCloseButton = true;
  @Input() ariaLabel = '';

  @Output() closed = new EventEmitter<void>();

  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private previousActiveElement: HTMLElement | null = null;
  private modalContainer = viewChild<ElementRef<HTMLElement>>('dialogEl');

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

    const dialog = this.modalContainer()?.nativeElement;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(
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
          const dialog = this.modalContainer()?.nativeElement;
          if (dialog) {
            const firstFocusable = dialog.querySelector<HTMLElement>(
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
