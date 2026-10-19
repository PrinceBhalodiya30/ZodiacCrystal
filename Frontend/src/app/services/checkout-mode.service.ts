import { Injectable, signal } from '@angular/core';

// Lets a page that runs its own inline checkout (e.g. the Mystery Box, which
// takes address + payment without leaving /mystery-box) switch the navbar to
// the focused "Secure checkout" header, same as the /checkout page gets.
@Injectable({ providedIn: 'root' })
export class CheckoutModeService {
  readonly active = signal(false);
}
