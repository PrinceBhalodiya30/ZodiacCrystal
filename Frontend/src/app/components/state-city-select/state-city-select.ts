import { Component, ElementRef, HostListener, computed, inject, model, signal } from '@angular/core';
import { ControlContainer, FormsModule } from '@angular/forms';
import { INDIA_STATE_CITIES, INDIA_STATES } from '../../data/india-locations.data';

const OTHER = '__other__';

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// State -> City custom dropdown pair.
// Opens downwards in all contexts, with search filtering and custom town entry.
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
  private elementRef = inject(ElementRef);

  state = model('');
  city = model('');

  readonly otherValue = OTHER;

  isStateOpen = signal(false);
  isCityOpen = signal(false);

  stateSearch = signal('');
  citySearch = signal('');

  stateTouched = signal(false);
  cityTouched = signal(false);

  // True only when the customer explicitly picked "Other" and hasn't typed yet.
  private otherChosen = signal(false);

  private matchedState = computed(() => INDIA_STATES.find(s => sameText(s, this.state())) ?? null);

  // A previously saved state that isn't in our list is kept as an extra option
  // rather than silently dropped.
  stateOptions = computed(() =>
    this.state() && !this.matchedState() ? [...INDIA_STATES, this.state()] : INDIA_STATES
  );

  filteredStateOptions = computed(() => {
    const term = this.stateSearch().trim().toLowerCase();
    if (!term) return this.stateOptions();
    return this.stateOptions().filter(s => s.toLowerCase().includes(term));
  });

  stateSelectValue = computed(() => this.matchedState() ?? this.state());

  cities = computed(() => {
    const key = this.matchedState();
    return key ? INDIA_STATE_CITIES[key] : [];
  });

  filteredCityOptions = computed(() => {
    const term = this.citySearch().trim().toLowerCase();
    const list = this.cities();
    if (!term) return list;
    return list.filter(c => c.toLowerCase().includes(term));
  });

  private matchedCity = computed(() => this.cities().find(c => sameText(c, this.city())) ?? null);

  isOther = computed(() => {
    if (!this.state()) {
      return false;
    }
    return this.city() ? !this.matchedCity() : this.otherChosen();
  });

  citySelectValue = computed(() => (this.isOther() ? OTHER : this.matchedCity() ?? ''));

  toggleStateDropdown(): void {
    if (this.isStateOpen()) {
      this.closeStateDropdown();
    } else {
      this.isCityOpen.set(false);
      this.stateSearch.set('');
      this.isStateOpen.set(true);
      this.stateTouched.set(true);
    }
  }

  closeStateDropdown(): void {
    this.isStateOpen.set(false);
    this.stateSearch.set('');
  }

  toggleCityDropdown(): void {
    if (!this.state()) {
      return;
    }
    if (this.isCityOpen()) {
      this.closeCityDropdown();
    } else {
      this.isStateOpen.set(false);
      this.citySearch.set('');
      this.isCityOpen.set(true);
      this.cityTouched.set(true);
    }
  }

  closeCityDropdown(): void {
    this.isCityOpen.set(false);
    this.citySearch.set('');
  }

  onStateChange(value: string): void {
    this.state.set(value);
    this.city.set('');
    this.otherChosen.set(false);
    this.stateTouched.set(true);
    this.closeStateDropdown();
  }

  onCityChange(value: string): void {
    if (value === OTHER) {
      this.otherChosen.set(true);
      this.city.set('');
    } else {
      this.otherChosen.set(false);
      this.city.set(value);
    }
    this.cityTouched.set(true);
    this.closeCityDropdown();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeStateDropdown();
      this.closeCityDropdown();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeStateDropdown();
    this.closeCityDropdown();
  }
}
