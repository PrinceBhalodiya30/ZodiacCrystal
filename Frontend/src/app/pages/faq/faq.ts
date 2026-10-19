import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './faq.html',
  styleUrl: './faq.css'
})
export class Faq {
  faqs: FaqItem[] = [
    {
      question: 'How do I choose a crystal?',
      answer: 'Start with what you are drawn to visually, or browse by your zodiac sign to see crystals commonly associated with it. Each product page includes a description to help you decide.'
    },
    {
      question: 'What are tumbled crystals?',
      answer: 'Tumbled crystals are stones that have been polished smooth and rounded, usually in a rotating tumbler. They\'re smooth to the touch and popular for carrying, gifting, or display.'
    },
    {
      question: 'What are raw crystals?',
      answer: 'Raw crystals are left in their natural, unpolished form as they were found or cut, keeping their original texture and shape rather than being smoothed or shaped.'
    },
    {
      question: 'How do zodiac collections work?',
      answer: 'Visit the Zodiac Signs page and select your sign to see a curated list of crystals commonly associated with it. This is a discovery tool to help you browse, not a guarantee of any particular effect.'
    },
    {
      question: 'How do I place an order?',
      answer: 'Add products to your cart, then go to checkout. You\'ll need to be logged in with a shipping address saved (or entered at checkout) to complete your purchase.'
    },
    {
      question: 'How can I track my order?',
      answer: 'Go to My Orders after logging in to see every order you\'ve placed. Opening an order shows its current status: Placed, Confirmed, Shipped, or Delivered.'
    },
    {
      question: 'Can I cancel an order?',
      answer: 'Yes - you can cancel an order from its order details page as long as it is still Pending or Confirmed and has not shipped yet.'
    },
    {
      question: 'What happens if an item is out of stock?',
      answer: 'Out-of-stock items are clearly marked and cannot be added to your cart or purchased. Check back later, as stock is updated when items are restocked.'
    },
    {
      question: 'How do coupons work?',
      answer: 'If you have a coupon code, you can enter it at checkout to apply its discount to your order total, subject to that coupon\'s own conditions (such as a minimum order value or expiry date).'
    },
    {
      question: 'How can I contact support?',
      answer: 'Visit the Contact page for our support email and hours. Please include your order number if your question is about an existing order.'
    }
  ];

  openIndex = signal<number | null>(null);

  toggle(index: number): void {
    this.openIndex.set(this.openIndex() === index ? null : index);
  }
}
