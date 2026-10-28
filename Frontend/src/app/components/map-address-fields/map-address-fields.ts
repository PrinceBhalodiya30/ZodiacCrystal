import { Component, ElementRef, OnDestroy, inject, input, model, signal, viewChild } from '@angular/core';
import { ControlContainer, FormsModule } from '@angular/forms';
import { AddressMap, PickedAddress } from '../address-map/address-map';
import { StateCitySelect } from '../state-city-select/state-city-select';
import { VALID_PIN, cityMatchesPlace, lookupPinPlaces, sameState } from '../../utils/india-address.util';
import {
  AddressQualityResult,
  AddressSuggestion,
  fetchAddressSuggestions,
  validateAddressQuality
} from '../../utils/address-autocomplete.util';

type PinStatus = 'ok' | 'checking' | 'unknown' | 'mismatch' | 'city-mismatch' | 'unavailable';

// Shipping address fields shared by checkout, Mystery Box and the address book.
// As the user types into the Address textarea, live address suggestions appear.
// The PIN must be a real India Post PIN for the chosen state and city.
@Component({
  selector: 'app-map-address-fields',
  standalone: true,
  imports: [FormsModule, AddressMap, StateCitySelect],
  templateUrl: './map-address-fields.html',
  styleUrl: './map-address-fields.css',
  // Joins the parent page's <form>, so it stays invalid until the address is right.
  viewProviders: [{ provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) }]
})
export class MapAddressFields implements OnDestroy {
  line = model('');
  city = model('');
  state = model('');
  postalCode = model('');
  latitude = model<number | null | undefined>(null);
  longitude = model<number | null | undefined>(null);
  maxLength = input(410);

  // Address Autocomplete & Quality signals
  suggestions = signal<AddressSuggestion[]>([]);
  isSearchingSuggestions = signal(false);
  showSuggestions = signal(false);
  selectedSuggestionIndex = signal(-1);
  addressQuality = signal<AddressQualityResult>({ valid: true });

  // An already-saved address starts as checked; the server checked it when saved.
  pinStatus = signal<PinStatus>('ok');
  private checkCount = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private abortController?: AbortController;

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.abortController?.abort();
  }

  // Handle typing inside the Address textarea
  onLineInput(value: string): void {
    this.line.set(value);
    this.addressQuality.set(validateAddressQuality(value, this.city()));

    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.abortController?.abort();

    const q = value.trim();
    if (q.length < 3) {
      this.suggestions.set([]);
      this.showSuggestions.set(false);
      this.isSearchingSuggestions.set(false);
      return;
    }

    this.isSearchingSuggestions.set(true);
    this.searchTimer = setTimeout(async () => {
      this.abortController = new AbortController();
      const results = await fetchAddressSuggestions(q, this.abortController.signal);
      this.isSearchingSuggestions.set(false);
      this.suggestions.set(results);
      this.showSuggestions.set(results.length > 0);
      this.selectedSuggestionIndex.set(-1);
    }, 300);
  }

  // When user selects a suggestion from the live dropdown
  selectSuggestion(item: AddressSuggestion): void {
    this.line.set(item.fullLine);
    this.addressQuality.set(validateAddressQuality(item.fullLine, item.city || this.city()));

    if (item.state) {
      this.state.set(item.state);
    }
    if (item.city) {
      this.city.set(item.city);
    }
    if (item.lat && item.lng) {
      this.latitude.set(item.lat);
      this.longitude.set(item.lng);
    }
    if (item.postalCode && VALID_PIN.test(item.postalCode)) {
      this.onPinInput(item.postalCode);
    } else {
      this.recheck();
    }

    this.showSuggestions.set(false);
    this.suggestions.set([]);
  }

  onLineKeydown(event: KeyboardEvent): void {
    if (!this.showSuggestions() || this.suggestions().length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (this.selectedSuggestionIndex() + 1) % this.suggestions().length;
      this.selectedSuggestionIndex.set(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = this.selectedSuggestionIndex() <= 0
        ? this.suggestions().length - 1
        : this.selectedSuggestionIndex() - 1;
      this.selectedSuggestionIndex.set(prev);
    } else if (event.key === 'Enter') {
      const idx = this.selectedSuggestionIndex();
      if (idx >= 0 && idx < this.suggestions().length) {
        event.preventDefault();
        this.selectSuggestion(this.suggestions()[idx]);
      }
    } else if (event.key === 'Escape') {
      this.showSuggestions.set(false);
    }
  }

  onLineBlur(): void {
    // Delay to let click on suggestion register before hiding dropdown
    setTimeout(() => {
      this.showSuggestions.set(false);
      if (this.line()) {
        this.addressQuality.set(validateAddressQuality(this.line(), this.city()));
      }
    }, 250);
  }

  // The map only pre-fills; every field stays editable. Blank parts from the map
  // don't wipe what the customer already typed.
  onPicked(picked: PickedAddress): void {
    if (picked.line) {
      this.line.set(picked.line);
      this.addressQuality.set(validateAddressQuality(picked.line, picked.city || this.city()));
    }
    if (picked.state) this.state.set(picked.state);
    if (picked.city) this.city.set(picked.city);
    this.latitude.set(picked.lat);
    this.longitude.set(picked.lng);
    if (VALID_PIN.test(picked.postalCode)) {
      this.onPinInput(picked.postalCode);
    } else {
      this.recheck();
    }
    this.showSuggestions.set(false);
  }

  // A full 6-digit PIN fills State and City from India Post; both stay editable.
  onPinInput(pin: string): void {
    this.postalCode.set(pin);
    this.check(true);
  }

  onStateChange(state: string): void {
    this.state.set(state);
    this.recheck();
  }

  onCityChange(city: string): void {
    this.city.set(city);
    this.recheck();
  }

  private recheck(): void {
    if (this.postalCode()) this.check(false);
  }

  private async check(fillPlace: boolean): Promise<void> {
    const check = ++this.checkCount;
    const pin = this.postalCode().trim();
    if (!VALID_PIN.test(pin)) {
      this.pinStatus.set('unknown');
      return;
    }

    this.pinStatus.set('checking');
    const places = await lookupPinPlaces(pin);
    // The PIN or state changed while India Post was answering.
    if (check !== this.checkCount) return;

    if (places === null) {
      // India Post is down: don't block the customer; the server checks again.
      this.pinStatus.set('unavailable');
    } else if (places.length === 0) {
      this.pinStatus.set('unknown');
    } else if (fillPlace) {
      // Keep what's there if the PIN covers it; otherwise take State and City from the PIN.
      if (!places.some(p => this.matches(p))) {
        this.state.set(places[0].state);
        this.city.set(places[0].city);
      }
      this.pinStatus.set('ok');
    } else if (!places.some(p => sameState(p.state, this.state()))) {
      this.pinStatus.set('mismatch');
    } else {
      // A blank city is left to the City field's own required check.
      this.pinStatus.set(!this.city() || places.some(p => this.matches(p)) ? 'ok' : 'city-mismatch');
    }
  }

  private matches(place: { state: string; city: string; names: string[] }): boolean {
    return sameState(place.state, this.state()) && cityMatchesPlace(this.city(), place);
  }

  pinAccepted(): boolean {
    return this.pinStatus() === 'ok' || this.pinStatus() === 'unavailable';
  }

  isAddressValid(): boolean {
    const val = this.line().trim();
    if (!val) return false;
    return this.addressQuality().valid;
  }
}
