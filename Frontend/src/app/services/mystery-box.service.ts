import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { CreateMysteryBoxOrderRequest, MysteryBoxInfo } from '../models/mystery-box';
import { Order } from '../models/order';
import { API_BASE_URL } from './api-config';
import { StoreSettingsService } from './store-settings.service';

@Injectable({ providedIn: 'root' })
export class MysteryBoxService {
  private readonly http = inject(HttpClient);
  private readonly storeSettings = inject(StoreSettingsService);
  private readonly baseUrl = `${API_BASE_URL}/mysterybox`;

  getInfo(): Observable<MysteryBoxInfo> {
    const config = typeof this.storeSettings?.mysteryBoxSettings === 'function'
      ? this.storeSettings.mysteryBoxSettings()
      : undefined;

    return of({
      itemCount: config?.itemCount ?? 3,
      minimumValue: config?.minimumValue ?? 2500,
      price: config?.price ?? 1499,
      enabled: config?.enabled ?? true,
      title: config?.title ?? 'Mystery Crystal Box',
      subtitle: config?.subtitle ?? '',
      badgeText: config?.badgeText ?? 'Curator Guaranteed Value'
    });
  }

  purchase(request: CreateMysteryBoxOrderRequest): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/purchase`, request);
  }
}
