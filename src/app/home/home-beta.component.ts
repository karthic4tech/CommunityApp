import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LanguageService } from '../core/services/language.service';
import { ContactRequestService } from '../core/services/contact-request.service';
import { LocalBrandsComponent } from './local-brands.component';
import { ServiceDiscoveryPreviewComponent } from './service-discovery-preview.component';

@Component({
  selector: 'app-home-beta',
  standalone: true,
  imports: [NgOptimizedImage, RouterLink, ReactiveFormsModule, LocalBrandsComponent, ServiceDiscoveryPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-beta.component.html',
  styleUrl: './home-beta.component.scss'
})
export class HomeBetaComponent implements OnInit, OnDestroy {
  readonly i18n = inject(LanguageService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly contactRequests = inject(ContactRequestService);

  readonly contactForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    mobile: ['', [Validators.required, Validators.pattern(/^(?:\+91[\s-]?)?[6-9]\d{9}$/)]],
    message: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(4000)]],
  });
  readonly contactSubmitting = signal(false);
  readonly contactSubmitted = signal(false);
  readonly contactSuccess = signal(false);
  readonly contactError = signal('');

  // Use one original landscape image set at every viewport size.
  readonly heroSlides = [
    '/assets/images/Welcome%20to%20Nam%20Chidambaram.webp',
    '/assets/images/Annamalai%20University%20Clock%20Tower%20Campus.webp',
    '/assets/images/Chidambaram%2C%20Built%20by%20Community.png',
    '/assets/images/pichavaram-image-1.webp',
    '/assets/images/samiyarpettai-beach-1.webp',
    '/assets/images/hotel-image-lakshmi-villas.webp'
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

  async onSubmitContact(): Promise<void> {
    this.contactSubmitted.set(true);
    this.contactSuccess.set(false);
    this.contactError.set('');
    if (this.contactForm.invalid || this.contactSubmitting()) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.contactSubmitting.set(true);
    try {
      const value = this.contactForm.getRawValue();
      await this.contactRequests.submit({
        ...value,
        mobile: this.normalizeMobile(value.mobile),
      });
      this.contactForm.reset();
      this.contactSubmitted.set(false);
      this.contactSuccess.set(true);
    } catch (error) {
      this.contactError.set(error instanceof Error ? error.message : 'Unable to send your message right now. Please try again.');
    } finally {
      this.contactSubmitting.set(false);
    }
  }

  private normalizeMobile(value: string): string {
    const mobile = value.replace(/[\s-]/g, '');
    return mobile.startsWith('+91') ? mobile : `+91${mobile}`;
  }
}
