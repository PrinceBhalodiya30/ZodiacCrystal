import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_NAME } from '../../services/page-title.service';
import { StoreSettingsService } from '../../services/store-settings.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './contact.html',
  styleUrl: './contact.css'
})
export class Contact {
  readonly siteName = SITE_NAME;
  private readonly storeSettings = inject(StoreSettingsService);

  readonly contact = computed(() => this.storeSettings.storeContactSettings());
  readonly supportEmail = computed(() => this.contact().supportEmail);
  readonly supportPhone = computed(() => this.contact().supportPhone);
  readonly whatsappNumber = computed(() => this.contact().whatsappNumber);
  readonly operatingHours = computed(() => this.contact().operatingHours);

  readonly whatsappUrl = computed(() => {
    const raw = this.whatsappNumber().replace(/\D/g, '');
    return raw ? `https://wa.me/${raw}` : null;
  });
}
