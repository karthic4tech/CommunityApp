import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { LanguageService } from '../core/services/language.service';
import { LocalBrandsComponent } from './local-brands.component';

@Component({
  selector: 'app-home-beta',
  standalone: true,
  imports: [NgOptimizedImage, LocalBrandsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-beta.component.html',
  styleUrl: './home-beta.component.scss'
})
export class HomeBetaComponent implements OnInit, OnDestroy {
  readonly i18n = inject(LanguageService);

  // Use one original landscape image set at every viewport size.
  readonly heroSlides = [
    '/assets/images/Welcome%20to%20Nam%20Chidambaram.png',
    '/assets/images/Annamalai%20University%20Clock%20Tower%20Campus.png',
    '/assets/images/Chidambaram%2C%20Built%20by%20Community.png',
    '/assets/images/pichavaram-image-1.png',
    '/assets/images/samiyarpettai-beach-1.png',
    '/assets/images/hotel-image-lakshmi-villas.png'
  ] as const;

  readonly heroSlideAlts = [
    'CDM360 community platform banner',
    'Annamalai University campus',
    'Chidambaram community banner',
    'Pichavaram Tourism mangrove boat tour banner',
    'Samiyarpettai beach banner',
    'Lakshmi Villas in Chidambaram banner',
  ] as const;
  
  heroIndex = signal(0);
  private carouselTimer?: ReturnType<typeof setInterval>;
  private touchStart: { readonly x: number; readonly y: number } | null = null;

  nextSlide(): void {
    this.heroIndex.update((index) => (index + 1) % this.heroSlides.length);
  }

  prevSlide(): void {
    this.heroIndex.update((index) => (index - 1 + this.heroSlides.length) % this.heroSlides.length);
  }

  ngOnInit(): void {
    this.carouselTimer = setInterval(() => this.nextSlide(), 5000);
  }

  ngOnDestroy(): void {
    if (this.carouselTimer) {
      clearInterval(this.carouselTimer);
    }
    this.touchStart = null;
  }

  onTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches.item(0);
    if (touch) {
      this.touchStart = { x: touch.clientX, y: touch.clientY };
    }
  }

  onTouchEnd(event: TouchEvent): void {
    const start = this.touchStart;
    const touch = event.changedTouches.item(0);
    this.touchStart = null;
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    if (deltaX < 0) {
      this.nextSlide();
    } else {
      this.prevSlide();
    }
  }

  onTouchCancel(): void {
    this.touchStart = null;
  }

  onSubmitContact(): void {
    alert('Thank you for reaching out! We will get back to you soon.');
  }
}
