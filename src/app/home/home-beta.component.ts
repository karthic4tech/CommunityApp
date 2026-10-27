import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../core/services/language.service';

@Component({
  selector: 'app-home-beta',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-beta.component.html',
  styleUrl: './home-beta.component.scss'
})
export class HomeBetaComponent implements OnInit {
  readonly i18n = inject(LanguageService);
  menuOpen = signal(false);
  readonly heroSlides = [
    '/assets/images/Welcome%20to%20Nam%20Chidambaram.png',
    '/assets/images/Annamalai%20University%20Clock%20Tower%20Campus.png',
    '/assets/images/Chidambaram%2C%20Built%20by%20Community.png',
    '/assets/images/pichavaram-image-1.png',
    '/assets/images/samiyarpettai-beach-1.png',
    '/assets/images/hotel-image-lakshmi-villas.png'
  ];
  heroIndex = signal(0);

  nextSlide(): void {
    this.heroIndex.update(i => (i + 1) % this.heroSlides.length);
  }

  prevSlide(): void {
    this.heroIndex.update(i => (i - 1 + this.heroSlides.length) % this.heroSlides.length);
  }

  ngOnInit(): void {
    setInterval(() => this.nextSlide(), 5000);
    const year = document.getElementById('year');
    if (year) {
      year.textContent = new Date().getFullYear().toString();
    }
  }

  toggleLanguage(): void {
    const newLanguage = this.i18n.language() === 'ta' ? 'en' : 'ta';
    this.i18n.setLanguage(newLanguage);
  }

  onSubmitContact(): void {
    alert('Thank you for reaching out! We will get back to you soon.');
  }
}
