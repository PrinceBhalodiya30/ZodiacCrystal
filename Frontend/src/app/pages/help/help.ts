import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { SupportService } from '../../services/support.service';
import { ToastService } from '../../services/toast.service';
import { OrderSummary } from '../../models/order';
import { SUPPORT_MAX_PHOTOS, SUPPORT_REPLY_WITHIN_HOURS, TICKET_CATEGORIES, TicketCategory } from '../../models/support-ticket';
import { InrPipe } from '../../pipes/inr.pipe';
import { Spinner } from '../../components/spinner/spinner';

interface HelpArticle {
  question: string;
  answer: string;
  topic: TicketCategory;
}

// Short answers for the most common questions, searched on the page.
// The longer policy pages (FAQ, Shipping & Returns) are linked below them.
const ARTICLES: HelpArticle[] = [
  { topic: 'OrderStatus', question: 'When will my order arrive?', answer: 'Most orders are dispatched within 1-2 business days and arrive in 3-7 business days. Once shipped you\'ll get a tracking number by email and on the order page.' },
  { topic: 'OrderStatus', question: 'How do I track my package?', answer: 'Open My Orders, choose the order and tap "Track Package". The tracking number appears as soon as the courier collects it.' },
  { topic: 'DamagedOrWrong', question: 'My crystal arrived damaged or chipped', answer: 'We\'re sorry! If it was delivered in the last 7 days, start a return from the order page and choose "Item arrived damaged". A photo helps us sort it out faster.' },
  { topic: 'DamagedOrWrong', question: 'What is your return policy?', answer: 'You can request a return within 7 days of delivery for paid orders. Once approved, send the items back with your order number and we\'ll refund you when they arrive.' },
  { topic: 'Payment', question: 'When will I get my refund?', answer: 'Card refunds are issued through our payment provider as soon as your return is refunded and usually appear in 5-7 business days. Cash on Delivery refunds are paid out by our team.' },
  { topic: 'Payment', question: 'My payment failed but money was deducted', answer: 'Failed card payments are normally reversed by your bank automatically within a few days. If it hasn\'t been, contact us with your order number.' },
  { topic: 'CancelOrChange', question: 'Can I cancel or change my order?', answer: 'Orders can be cancelled from the order page until they are shipped. To change the address or items, contact us quickly - once dispatched we can\'t change it.' },
  { topic: 'Product', question: 'Are your crystals genuine?', answer: 'Yes. Every crystal is natural and hand-picked. Natural stones vary in colour, size and markings, so yours may look slightly different from the photo.' },
  { topic: 'Product', question: 'How do I cleanse and charge my crystal?', answer: 'Popular methods are moonlight, sound (a singing bowl or bell), smoke or resting on selenite. Avoid water and sunlight for soft or fading stones such as selenite and amethyst.' },
  { topic: 'Product', question: 'Which crystal suits my zodiac sign?', answer: 'Visit "Shop by Zodiac Sign" to see the crystals matched to your sign and what each one supports.' },
  { topic: 'Account', question: 'I forgot my password', answer: 'Use "Forgot password?" on the login page and we\'ll email you a code to reset it.' }
];

type Step = 'start' | 'issue' | 'answer' | 'form' | 'sent';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, InrPipe, Spinner],
  templateUrl: './help.html',
  styleUrl: './help.css'
})
export class Help implements OnInit {
  authService = inject(AuthService);
  private orderService = inject(OrderService);
  private supportService = inject(SupportService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly categories = TICKET_CATEGORIES;
  readonly replyWithinHours = SUPPORT_REPLY_WITHIN_HOURS;
  readonly maxPhotos = SUPPORT_MAX_PHOTOS;
  readonly returnWindowDays = 7;

  isCustomer = computed(() => this.authService.isLoggedIn() && !this.authService.isAdmin());

  // Search / browse
  searchTerm = signal('');
  openArticle = signal<string | null>(null);
  articles = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return ARTICLES.slice(0, 6);
    }
    return ARTICLES.filter(a => a.question.toLowerCase().includes(term) || a.answer.toLowerCase().includes(term));
  });

  // Guided flow
  step = signal<Step>('start');
  orders = signal<OrderSummary[]>([]);
  ordersLoading = signal(false);
  showAllOrders = signal(false);
  visibleOrders = computed(() => (this.showAllOrders() ? this.orders() : this.orders().slice(0, 4)));
  selectedOrder = signal<OrderSummary | null>(null);
  selectedTopic = signal<TicketCategory | null>(null);
  topicArticles = computed(() => ARTICLES.filter(a => a.topic === this.selectedTopic()));

  // Issues offered for an order depend on where the order is.
  orderIssues = computed(() => {
    const order = this.selectedOrder();
    if (!order) {
      return [];
    }
    const issues: TicketCategory[] = ['OrderStatus'];
    if (order.status === 'Delivered' || order.status === 'Shipped') {
      issues.push('DamagedOrWrong');
    }
    issues.push('Payment');
    if (order.status !== 'Delivered' && order.status !== 'Cancelled') {
      issues.push('CancelOrChange');
    }
    issues.push('Product', 'Other');
    return this.categories.filter(c => issues.includes(c.value));
  });

  // Contact form
  subject = '';
  message = '';
  files = signal<File[]>([]);
  isSubmitting = signal(false);
  formError = signal('');
  createdTicketId = signal<number | null>(null);
  createdReference = signal('');

  ngOnInit(): void {
    if (this.isCustomer()) {
      this.loadOrders();
    }
  }

  private loadOrders(): void {
    this.ordersLoading.set(true);
    this.orderService.getMyOrders().subscribe({
      next: orders => {
        this.orders.set(orders);
        this.ordersLoading.set(false);
        // /help?orderId=12 (the "Need help?" link on the order page) jumps straight to that order.
        const orderId = Number(this.route.snapshot.queryParamMap.get('orderId'));
        const preselected = orders.find(o => o.orderId === orderId);
        if (preselected) {
          this.chooseOrder(preselected);
        }
      },
      error: () => this.ordersLoading.set(false)
    });
  }

  toggleArticle(question: string): void {
    this.openArticle.set(this.openArticle() === question ? null : question);
  }

  chooseOrder(order: OrderSummary): void {
    this.selectedOrder.set(order);
    this.selectedTopic.set(null);
    this.step.set('issue');
    this.scrollToFlow();
  }

  // A topic without an order (product question, account, ...).
  chooseTopic(topic: TicketCategory): void {
    this.selectedOrder.set(null);
    this.selectedTopic.set(topic);
    this.step.set('answer');
    this.scrollToFlow();
  }

  chooseIssue(topic: TicketCategory): void {
    this.selectedTopic.set(topic);
    this.step.set('answer');
  }

  stillNeedHelp(): void {
    if (!this.isCustomer()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/help' } });
      return;
    }
    const order = this.selectedOrder();
    const topic = this.categories.find(c => c.value === this.selectedTopic());
    this.subject = topic ? (order ? `${topic.label} - Order #${order.orderId}` : topic.label) : '';
    this.message = '';
    this.files.set([]);
    this.formError.set('');
    this.step.set('form');
  }

  back(): void {
    const step = this.step();
    if (step === 'form') {
      this.step.set('answer');
    } else if (step === 'answer' && this.selectedOrder()) {
      this.step.set('issue');
    } else {
      this.reset();
    }
  }

  reset(): void {
    this.selectedOrder.set(null);
    this.selectedTopic.set(null);
    this.step.set('start');
  }

  topicLabel(topic: TicketCategory | null): string {
    return this.categories.find(c => c.value === topic)?.label ?? '';
  }

  // Same rule as ReturnPolicy on the server (delivered + paid + within 7 days).
  returnWindowOpen(order: OrderSummary): boolean {
    if (order.status !== 'Delivered' || order.paymentStatus !== 'Paid' || !order.deliveredAt) {
      return false;
    }
    const endsAt = new Date(order.deliveredAt).getTime() + this.returnWindowDays * 24 * 60 * 60 * 1000;
    return Date.now() <= endsAt;
  }

  orderLabel(order: OrderSummary): string {
    const names = order.productNames ?? order.items?.map(i => i.productName) ?? [];
    if (names.length === 0) {
      return `Order #${order.orderId}`;
    }
    return names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`;
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = '';
    const combined = [...this.files(), ...picked];
    if (combined.length > this.maxPhotos) {
      this.toast.error(`You can attach up to ${this.maxPhotos} photos.`);
    }
    this.files.set(combined.slice(0, this.maxPhotos));
  }

  removeFile(index: number): void {
    this.files.update(files => files.filter((_, i) => i !== index));
  }

  submit(): void {
    const topic = this.selectedTopic() ?? 'Other';
    if (this.isSubmitting() || this.subject.trim().length < 3 || this.message.trim().length < 5) {
      this.formError.set('Please add a short subject and describe the problem (at least a few words).');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    this.supportService
      .createTicket({
        orderId: this.selectedOrder()?.orderId ?? null,
        category: topic,
        subject: this.subject.trim(),
        message: this.message.trim(),
        files: this.files()
      })
      .subscribe({
        next: ticket => {
          this.isSubmitting.set(false);
          this.createdTicketId.set(ticket.supportTicketId);
          this.createdReference.set(ticket.reference);
          this.step.set('sent');
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.formError.set(error.error?.message || 'Unable to send your request. Please try again.');
        }
      });
  }

  private scrollToFlow(): void {
    setTimeout(() => document.getElementById('help-flow')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}
