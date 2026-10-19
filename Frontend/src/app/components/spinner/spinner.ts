import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [],
  templateUrl: './spinner.html',
  styleUrl: './spinner.css'
})
export class Spinner {
  @Input() label = 'Loading...';
}
