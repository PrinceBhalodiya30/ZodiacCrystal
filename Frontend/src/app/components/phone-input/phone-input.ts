import { Component, computed, inject, model } from '@angular/core';
import { ControlContainer, FormsModule } from '@angular/forms';
import { PHONE_CODE, PHONE_LENGTH, PHONE_PATTERN, PHONE_PLACEHOLDER, phoneDigits } from '../../data/india-phone.data';

// Indian mobile number with a fixed +91 prefix. The value stays one plain
// string ("+91 9876543210"), so the API and the existing Phone columns are
// unchanged, and numbers saved before this field existed still load into it.
@Component({
  selector: 'app-phone-input',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './phone-input.html',
  styleUrl: './phone-input.css',
  // Registers the number control with the parent page's <form>, so its
  // existing "form invalid -> submit disabled" checks include it.
  viewProviders: [
    { provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) }
  ]
})
export class PhoneInput {
  phone = model('');

  readonly code = PHONE_CODE;
  readonly pattern = PHONE_PATTERN;
  readonly length = PHONE_LENGTH;
  readonly placeholder = PHONE_PLACEHOLDER;

  number = computed(() => phoneDigits(this.phone()));

  onNumberChange(value: string): void {
    const digits = (value ?? '').replace(/\D/g, '');
    this.phone.set(digits ? `${PHONE_CODE} ${digits}` : '');
  }
}
