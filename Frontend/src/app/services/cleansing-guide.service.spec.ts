import { TestBed } from '@angular/core/testing';
import { CleansingGuideService } from './cleansing-guide.service';

describe('CleansingGuideService', () => {
  let service: CleansingGuideService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CleansingGuideService);
  });

  it('should be created with initial closed state', () => {
    expect(service).toBeTruthy();
    expect(service.isOpen()).toBe(false);
    expect(service.activeTab()).toBe('cleansing');
  });

  it('should open modal with specific tab and mineral name', () => {
    service.open('checker', 'Selenite');
    expect(service.isOpen()).toBe(true);
    expect(service.activeTab()).toBe('checker');
    expect(service.searchMineral()).toBe('Selenite');
  });

  it('should change tabs correctly', () => {
    service.open();
    service.setTab('ritual');
    expect(service.activeTab()).toBe('ritual');
  });

  it('should close modal', () => {
    service.open();
    service.close();
    expect(service.isOpen()).toBe(false);
  });
});
