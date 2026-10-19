import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb {
  label: string;
  // Omit on the last crumb - it is the current page and renders as plain text.
  link?: string | unknown[];
  queryParams?: Record<string, unknown>;
}

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './breadcrumbs.html',
  styleUrl: './breadcrumbs.css'
})
export class Breadcrumbs {
  @Input() items: Crumb[] = [];
}
