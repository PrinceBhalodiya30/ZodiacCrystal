import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDES } from '../../data/guides.data';

@Component({
  selector: 'app-guides',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './guides.html',
  styleUrl: './guides.css'
})
export class Guides {
  guides = GUIDES;
}
