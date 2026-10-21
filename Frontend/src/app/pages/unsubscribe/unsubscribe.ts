import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { NewsletterService } from '../../services/newsletter.service';
import { SUPPORT_EMAIL } from '../../services/page-title.service';

// Opened from the unsubscribe link in a newsletter (/unsubscribe?token=...).
// Asks for one click to confirm instead of unsubscribing on page load, so email
// scanners that pre-open links can't unsubscribe people by accident.
@Component({
  selector: 'app-unsubscribe',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './unsubscribe.html',
  styleUrl: './unsubscribe.css'
})
export class Unsubscribe {
  readonly supportEmail = SUPPORT_EMAIL;
  private newsletterService = inject(NewsletterService);

  token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  state = signal<'confirm' | 'working' | 'done' | 'error'>(this.token ? 'confirm' : 'error');
  message = signal(this.token ? '' : 'This unsubscribe link is incomplete. Please use the link from the bottom of our email.');

  confirm(): void {
    this.state.set('working');

    this.newsletterService.unsubscribe(this.token).subscribe({
      next: res => {
        this.message.set(res.message);
        this.state.set('done');
      },
      error: (err: HttpErrorResponse) => {
        this.message.set(err.error?.message || 'Something went wrong. Please try again in a moment.');
        this.state.set('error');
      }
    });
  }
}
