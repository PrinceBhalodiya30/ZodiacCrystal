import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './services/auth.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should test navigation to /admin when logged in as admin', async () => {
    const router = TestBed.inject(Router);
    const authService = TestBed.inject(AuthService);
    // Simulate admin login
    authService.currentUser.set({
      userId: 1,
      name: 'Admin',
      email: 'admin@crystalstudio.com',
      role: 'Admin',
      createdAt: new Date().toISOString()
    });

    const success = await router.navigateByUrl('/admin');
    expect(success).toBe(true);
    expect(router.url).toBe('/admin/dashboard');
  });
});
