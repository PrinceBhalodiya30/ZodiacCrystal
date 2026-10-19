import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private http = inject(HttpClient);

  // Short-lived Braintree client token for the Drop-in UI.
  getClientToken(): Observable<{ clientToken: string; sandbox: boolean }> {
    return this.http.get<{ clientToken: string; sandbox: boolean }>(`${API_BASE_URL}/Payments/client-token`);
  }
}
