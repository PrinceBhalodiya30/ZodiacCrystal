import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_NAME } from '../../services/page-title.service';

@Component({
  selector: 'app-shipping-returns',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './shipping-returns.html',
  styleUrl: './shipping-returns.css'
})
export class ShippingReturns {
  readonly siteName = SITE_NAME;
}
