export interface NewsletterSubscriber {
  newsletterSubscriberId: number;
  email: string;
  subscribedAt: string;
  isActive: boolean;
  unsubscribedAt: string | null;
  // The email also belongs to a customer account.
  isCustomer: boolean;
}

export interface NewsletterStats {
  active: number;
  newThisMonth: number;
  unsubscribedThisMonth: number;
}

export type NewsletterStatusFilter = 'active' | 'unsubscribed' | 'all';
