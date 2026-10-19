import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-authorized',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-authorized.html',
  styleUrl: './not-authorized.css'
})
export class NotAuthorized {}
