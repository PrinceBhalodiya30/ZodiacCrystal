import { Component, inject, input, model, signal } from '@angular/core';
import { ControlContainer, FormsModule } from '@angular/forms';
import { AddressMap, PickedAddress } from '../address-map/address-map';
import { StateCitySelect } from '../state-city-select/state-city-select';
import { VALID_PIN, cityMatchesPlace, lookupPinPlaces, sameState } from '../../utils/india-address.util';

type PinStatus = 'ok' | 'checking' | 'unknown' | 'mismatch' | 'city-mismatch' | 'unavailable';

// Shipping address fields shared by checkout, Mystery Box and the address book.
// Typed by hand (the map is an optional shortcut), but the PIN must be a real
// India Post PIN for the chosen state and city. A valid PIN fills State and City;
// changing either afterwards to a place the PIN doesn't cover blocks the form.
// The server repeats the check.
@Component({
  selector: 'app-map-address-fields',
  standalone: true,
  imports: [FormsModule, AddressMap, StateCitySelect],
  templateUrl: './map-address-fields.html',
  styleUrl: './map-address-fields.css',
  // Joins the parent page's <form>, so it stays invalid until the address is right.
  viewProviders: [{ provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) }]
})
export class MapAddressFields {
  line = model('');
  city = model('');
  state = model('');
  postalCode = model('');
  // Undefined is accepted too: the address book form keeps them optional.
  latitude = model<number | null | undefined>(null);
  longitude = model<number | null | undefined>(null);
  // Max length of the field the address goes into.
  maxLength = input(410);

  // An already-saved address starts as checked; the server checked it when saved.
  pinStatus = signal<PinStatus>('ok');
  private checkCount = 0;

  // The map only pre-fills; every field stays editable. Blank parts from the map
  // don't wipe what the customer already typed.
  onPicked(picked: PickedAddress): void {
    if (picked.line) this.line.set(picked.line);
    if (picked.state) this.state.set(picked.state);
    if (picked.city) this.city.set(picked.city);
    this.latitude.set(picked.lat);
    this.longitude.set(picked.lng);
    if (VALID_PIN.test(picked.postalCode)) {
      this.onPinInput(picked.postalCode);
    } else {
      this.recheck();
    }
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
}
