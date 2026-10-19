import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AddressService } from '../../services/address.service';
import { Address, AddressRequest } from '../../models/address';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { Spinner } from '../../components/spinner/spinner';
import { PhoneInput } from '../../components/phone-input/phone-input';
import { MapAddressFields } from '../../components/map-address-fields/map-address-fields';

const EMPTY_FORM: AddressRequest = {
  fullName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  // The map only covers India.
  country: 'India',
  addressType: 'Home',
  isDefault: false,
  latitude: null,
  longitude: null
};

@Component({
  selector: 'app-addresses',
  standalone: true,
  imports: [FormsModule, Spinner, PhoneInput, MapAddressFields],
  templateUrl: './addresses.html',
  styleUrl: './addresses.css'
})
export class Addresses implements OnInit {
  private addressService = inject(AddressService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  addresses = signal<Address[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  formMode = signal<'closed' | 'create' | 'edit'>('closed');
  editingAddressId = signal<number | null>(null);
  isSaving = signal(false);
  formError = signal('');
  form: AddressRequest = { ...EMPTY_FORM };

  ngOnInit(): void {
    this.loadAddresses();
  }

  loadAddresses(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.addressService.getAddresses().subscribe({
      next: addresses => {
        this.addresses.set(addresses);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load your addresses.');
        this.isLoading.set(false);
      }
    });
  }

  startCreate(): void {
    this.formMode.set('create');
    this.editingAddressId.set(null);
    this.form = { ...EMPTY_FORM, isDefault: this.addresses().length === 0 };
    this.formError.set('');
  }

  startEdit(address: Address): void {
    this.formMode.set('edit');
    this.editingAddressId.set(address.addressId);
    this.form = {
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: 'India',
      addressType: address.addressType,
      isDefault: address.isDefault,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null
    };
    this.formError.set('');
  }

  cancelForm(): void {
    this.formMode.set('closed');
  }

  submitForm(): void {
    this.isSaving.set(true);
    this.formError.set('');

    const editingId = this.editingAddressId();
    const request: AddressRequest = {
      ...this.form,
      addressLine2: this.form.addressLine2?.trim() || undefined
    };

    const done = () => {
      this.isSaving.set(false);
      this.formMode.set('closed');
      this.loadAddresses();
    };

    const fail = (error: HttpErrorResponse) => {
      this.isSaving.set(false);
      this.formError.set(error.error?.message || 'Unable to save this address.');
    };

    if (editingId) {
      this.addressService.updateAddress(editingId, request).subscribe({ next: done, error: fail });
    } else {
      this.addressService.createAddress(request).subscribe({
        next: () => {
          this.toast.success('Address added.');
          done();
        },
        error: fail
      });
    }
  }

  setDefault(address: Address): void {
    if (address.isDefault) {
      return;
    }

    this.addressService.setDefault(address.addressId).subscribe({
      next: () => {
        this.toast.success('Default address updated.');
        this.loadAddresses();
      },
      error: () => this.toast.error('Unable to set this as your default address.')
    });
  }

  async deleteAddress(address: Address): Promise<void> {
    const confirmed = await this.confirmDialog.confirm(
      `Delete this address (${address.addressLine1})?`,
      { confirmLabel: 'Delete', danger: true }
    );

    if (!confirmed) {
      return;
    }

    this.addressService.deleteAddress(address.addressId).subscribe({
      next: () => {
        this.toast.success('Address deleted.');
        this.loadAddresses();
      },
      error: () => this.toast.error('Unable to delete this address.')
    });
  }
}
