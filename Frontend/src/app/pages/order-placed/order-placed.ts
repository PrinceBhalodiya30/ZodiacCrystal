import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Order } from '../../models/order';
import { InrPipe } from '../../pipes/inr.pipe';

// Guest checkout confirmation. Guests have no My Orders page, so this shows
// the order returned by checkout (passed in navigation state). Refreshing the
// page loses that state - the confirmation email has the details.
@Component({
  selector: 'app-order-placed',
  standalone: true,
  imports: [RouterLink, InrPipe],
  templateUrl: './order-placed.html',
  styleUrl: './order-placed.css'
})
export class OrderPlaced {
  private state = inject(Router).getCurrentNavigation()?.extras.state
    ?? (typeof history !== 'undefined' ? history.state : null);

  order: Order | null = this.state?.order ?? null;
  email: string = this.state?.email ?? '';
}

