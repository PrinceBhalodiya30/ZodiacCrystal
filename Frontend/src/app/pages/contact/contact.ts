import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_NAME, SUPPORT_EMAIL } from '../../services/page-title.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './contact.html',
  styleUrl: './contact.css'
})
export class Contact {
  readonly siteName = SITE_NAME;
  readonly supportEmail = SUPPORT_EMAIL;
}
