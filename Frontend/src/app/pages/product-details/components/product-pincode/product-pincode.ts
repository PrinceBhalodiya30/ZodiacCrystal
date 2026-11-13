import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { checkDeliveryPincode, getSavedPincode, savePincode, PincodeDeliveryInfo } from '../../../../utils/pincode.util';

@Component({
  selector: 'app-product-pincode',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './product-pincode.html',
  styleUrl: './product-pincode.css'
})
export class ProductPincode implements OnInit {
  readonly pincodeInput = signal('');
  readonly pincodeResult = signal<PincodeDeliveryInfo | null>(null);
  readonly isCheckingPincode = signal(false);
  readonly pincodeError = signal('');

  ngOnInit(): void {
    const savedPin = getSavedPincode();
    if (savedPin) {
      this.pincodeInput.set(savedPin);
      this.pincodeResult.set(checkDeliveryPincode(savedPin));
    }
  }

  onPincodeChange(value: string): void {
    const digits = (value || '').replace(/\D/g, '').slice(0, 6);
    this.pincodeInput.set(digits);
    this.pincodeError.set('');
    if (digits.length === 6 && !this.pincodeResult()) {
      this.checkPincode();
    }
  }

  checkPincode(): void {
    const pin = this.pincodeInput().trim();
    if (pin.length !== 6) {
      this.pincodeError.set('Please enter a valid 6-digit Indian postal pincode.');
      return;
    }

    this.isCheckingPincode.set(true);
    this.pincodeError.set('');

    setTimeout(() => {
      const result = checkDeliveryPincode(pin);
      this.isCheckingPincode.set(false);
      if (result) {
        this.pincodeResult.set(result);
        savePincode(pin);
      } else {
        this.pincodeError.set('Invalid pincode. Please check your 6 digits.');
      }
    }, 200);
  }

  resetPincode(): void {
    this.pincodeResult.set(null);
    this.pincodeInput.set('');
    this.pincodeError.set('');
  }
}

