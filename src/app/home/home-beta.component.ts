import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
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
  private sanitizer = inject(DomSanitizer);
  menuOpen = signal(false);
  isMobile = signal(false);
  
  // Desktop images (use high-quality full images)
  readonly heroSlidesDesktop = [
    '/assets/images/Welcome%20to%20Nam%20Chidambaram.png',
    '/assets/images/Annamalai%20University%20Clock%20Tower%20Campus.png',
    '/assets/images/Chidambaram%2C%20Built%20by%20Community.png',
    '/assets/images/pichavaram-image-1.png',
    '/assets/images/samiyarpettai-beach-1.png',
    '/assets/images/hotel-image-lakshmi-villas.png'
  ];
  
  // Mobile images - 480x720px optimized
  readonly heroSlidesMobile = [
    '/assets/images/nam-chidambaram-mobile-480x720.png',
    '/assets/images/annamalai-university-mobile-480x720.png',
    '/assets/images/chidambaram-community-mobile-480x720.png',
    '/assets/images/pichavaram-tourism-mobile-480x720.png',
    '/assets/images/samiyarpettai-beach-mobile-480x720.png',
    '/assets/images/lakshmi-villas-mobile-480x720.png'
  ];
  
  // Computed signal that returns the correct image array based on viewport
  heroSlides = computed(() => 
    this.isMobile() ? this.heroSlidesMobile : this.heroSlidesDesktop
  );
  
  heroIndex = signal(0);

  nextSlide(): void {
    console.log('nextSlide() called');
    console.log('Current index before:', this.heroIndex());
    this.heroIndex.update(i => {
      const nextIndex = (i + 1) % this.heroSlides().length;
      console.log('Updating index from', i, 'to', nextIndex);
      return nextIndex;
    });
    console.log('Current index after:', this.heroIndex());
  }

  prevSlide(): void {
    console.log('prevSlide() called');
    console.log('Current index before:', this.heroIndex());
    this.heroIndex.update(i => {
      const prevIndex = (i - 1 + this.heroSlides().length) % this.heroSlides().length;
      console.log('Updating index from', i, 'to', prevIndex);
      return prevIndex;
    });
    console.log('Current index after:', this.heroIndex());
  }

  ngOnInit(): void {
    // Set initial mobile state with slight delay to ensure rendering
    setTimeout(() => this.checkViewport(), 0);
    
    // Listen for window resize with debounce
    let resizeTimeout: any;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this.checkViewport(), 150);
    });
    
    // Check viewport on orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.checkViewport(), 300);
    });
    
    // Auto-play carousel every 5 seconds
    const autoPlayInterval = setInterval(() => this.nextSlide(), 5000);
    
    // Set year in footer
    const year = document.getElementById('year');
    if (year) {
      year.textContent = new Date().getFullYear().toString();
    }
    
    // Log for debugging
    console.log('=== Hero Carousel Initialized ===');
    console.log('Current viewport width:', window.innerWidth);
    console.log('Is mobile:', this.isMobile());
    console.log('Current image set:', this.heroSlides());
    console.log('First slide URL:', this.heroSlides()[0]);
    console.log('All slide URLs:');
    this.heroSlides().forEach((url, i) => {
      console.log(`  Slide ${i + 1}: ${url}`);
    });
    console.log('Current slide index:', this.heroIndex());
    console.log('Active slide:', this.heroSlides()[this.heroIndex()]);
    
    // Debug DOM after rendering
    setTimeout(() => {
      console.log('\n=== DOM Debug (after render) ===');
      this.debugFirstSlide();
      this.debugImageLoading();
    }, 500);
  }

  private debugImageLoading(): void {
    console.log('\n=== Image Loading Test ===');
    const slides = this.heroSlides();
    slides.forEach((url, i) => {
      const img = new Image();
      img.onload = () => console.log(`✅ Slide ${i + 1} loaded: ${url}`);
      img.onerror = () => console.log(`❌ Slide ${i + 1} FAILED: ${url}`);
      img.src = url;
    });
  }

  private checkViewport(): void {
    // Check multiple indicators for mobile
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ua = navigator.userAgent.toLowerCase();
    
    // Mobile if width <= 767px OR height indicates mobile orientation
    const isMobileViewport = width <= 767 || (height > width && width < 600);
    
    this.isMobile.set(isMobileViewport);
    
    console.log('Viewport check:', { 
      width, 
      height, 
      isMobile: isMobileViewport,
      currentSlides: this.heroSlides()
    });
  }

  getWindowWidth(): number {
    return window.innerWidth;
  }

  getImageSet(): string {
    return this.isMobile() ? 'Mobile (480×720)' : 'Desktop (High-Res)';
  }

  // Debug method to check first slide
  debugFirstSlide(): void {
    const firstSlide = document.querySelector('.hero-slide[data-index="0"]') as HTMLElement;
    if (firstSlide) {
      const computedStyle = window.getComputedStyle(firstSlide);
      console.log('First slide debug:', {
        element: firstSlide,
        dataIndex: firstSlide.getAttribute('data-index'),
        hasActiveClass: firstSlide.classList.contains('active'),
        opacity: computedStyle.opacity,
        visibility: computedStyle.visibility,
        zIndex: computedStyle.zIndex,
        backgroundImage: computedStyle.backgroundImage,
        backgroundColor: computedStyle.backgroundColor,
        width: computedStyle.width,
        height: computedStyle.height
      });
    } else {
      console.warn('First slide element not found!');
    }
  }

  sanitizeUrl(url: string): SafeStyle {
    return this.sanitizer.bypassSecurityTrustStyle(`url('${url}')`);
  }

  toggleLanguage(): void {
    const newLanguage = this.i18n.language() === 'ta' ? 'en' : 'ta';
    this.i18n.setLanguage(newLanguage);
  }

  onSubmitContact(): void {
    alert('Thank you for reaching out! We will get back to you soon.');
  }
}
