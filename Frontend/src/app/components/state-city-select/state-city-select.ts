import { Component, computed, inject, model, signal } from '@angular/core';
import { ControlContainer, FormsModule } from '@angular/forms';
import { INDIA_STATE_CITIES, INDIA_STATES } from '../../data/india-locations.data';

const OTHER = '__other__';

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// State -> City dropdown pair. Choosing a state fills the city list with that
// state's cities; "Other" reveals a text box for towns not in the list.
// Values stay plain strings, so saved addresses/orders (including ones typed
// before this dropdown existed) still load and display correctly.
@Component({
  selector: 'app-state-city-select',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './state-city-select.html',
  styleUrl: './state-city-select.css',
  // Registers these controls with the parent page's <form>, so its existing
  // "form invalid -> submit disabled" checks include State and City.
  viewProviders: [
    { provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) }
  ]
})
export class StateCitySelect {
  state = model('');
  city = model('');

  readonly otherValue = OTHER;

  // True only when the customer explicitly picked "Other" and hasn't typed yet.
  private otherChosen = signal(false);

  private matchedState = computed(() => INDIA_STATES.find(s => sameText(s, this.state())) ?? null);

  // A previously saved state that isn't in our list is kept as an extra option
  // rather than silently dropped.
  stateOptions = computed(() =>
    this.state() && !this.matchedState() ? [...INDIA_STATES, this.state()] : INDIA_STATES
  );

  stateSelectValue = computed(() => this.matchedState() ?? this.state());

  cities = computed(() => {
    const key = this.matchedState();
    return key ? INDIA_STATE_CITIES[key] : [];
  });

  private matchedCity = computed(() => this.cities().find(c => sameText(c, this.city())) ?? null);

  isOther = computed(() => {
    if (!this.state()) {
      return false;
    }
    return this.city() ? !this.matchedCity() : this.otherChosen();
  });

  citySelectValue = computed(() => (this.isOther() ? OTHER : this.matchedCity() ?? ''));

  onStateChange(value: string): void {
    this.state.set(value);
    this.city.set('');
    this.otherChosen.set(false);
  }

  onCityChange(value: string): void {
    if (value === OTHER) {
      this.otherChosen.set(true);
      this.city.set('');
    } else {
      this.otherChosen.set(false);
      this.city.set(value);
    }
  }
}
