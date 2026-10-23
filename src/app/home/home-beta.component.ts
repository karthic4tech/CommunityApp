import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';

interface BetaFeature {
  readonly id: string;
  readonly icon: string;
  readonly titleEn: string;
  readonly titleTa: string;
  readonly descEn: string;
  readonly descTa: string;
  readonly color: 'orange' | 'teal' | 'gold' | 'slate';
}

interface BetaService {
  readonly id: string;
  readonly icon: string;
  readonly titleEn: string;
  readonly titleTa: string;
  readonly descEn: string;
  readonly descTa: string;
}

const BETA_FEATURES: readonly BetaFeature[] = [
  {
    id: 'trust',
    icon: 'bi-shield-check',
    titleEn: 'Trusted Community',
    titleTa: 'நம்பகமான சமூகம்',
    descEn: 'Verified providers and services you can rely on.',
    descTa: 'நீங்கள் நம்பக்கூடிய சரிபார்க்கப்பட்ட சேவைகள்.',
    color: 'orange',
  },
  {
    id: 'discover',
    icon: 'bi-compass',
    titleEn: 'Easy Discovery',
    titleTa: 'எளிதான கண்டறிதல்',
    descEn: 'Find local services tailored to your needs.',
    descTa: 'உங்கள் தேவைக்கான உள்ளூர் சேவைகளைக் கண்டறியுங்கள்.',
    color: 'teal',
  },
  {
    id: 'connect',
    icon: 'bi-people-fill',
    titleEn: 'Community Connect',
    titleTa: 'சமூக இணைப்பு',
    descEn: 'Join local providers and grow together.',
    descTa: 'உள்ளூர் வழங்குநர்களுடன் இணைந்து வளரவும்.',
    color: 'gold',
  },
  {
    id: 'bilingual',
    icon: 'bi-translate',
    titleEn: 'Tamil + English',
    titleTa: 'தமிழ் + ஆங்கிலம்',
    descEn: 'Experience in your preferred language.',
    descTa: 'உங்கள் விருப்பமான மொழியில் அனுபவம் பெறுங்கள்.',
    color: 'slate',
  },
];

const BETA_SERVICES: readonly BetaService[] = [
  {
    id: 'home',
    icon: 'bi-house-heart',
    titleEn: 'Home & Everyday',
    titleTa: 'வீடு மற்றும் அன்றாட',
    descEn: 'Household services, repairs, and maintenance solutions.',
    descTa: 'வீட்டு சேவைகள் மற்றும் பழுதுசரி தீர்வுகள்.',
  },
  {
    id: 'health',
    icon: 'bi-heart-pulse',
    titleEn: 'Health & Wellness',
    titleTa: 'ஆரோக்கியம் மற்றும் நலம்',
    descEn: 'Healthcare, wellness, and support services nearby.',
    descTa: 'அருகிலுள்ள சுகாதார மற்றும் நல சேவைகள்.',
  },
  {
    id: 'learning',
    icon: 'bi-mortarboard',
    titleEn: 'Learning & Skills',
    titleTa: 'கல்வி மற்றும் திறன்',
    descEn: 'Education, training, and professional development.',
    descTa: 'கல்வி, பயிற்சி மற்றும் தொழில்முறை வளர்ச்சி.',
  },
  {
    id: 'business',
    icon: 'bi-shop',
    titleEn: 'Local Businesses',
    titleTa: 'உள்ளூர் வணிகங்கள்',
    descEn: 'Shops, services, and enterprises in your town.',
    descTa: 'உங்கள் ஊரில் கடைகள் மற்றும் சேவைகள்.',
  },
];

@Component({
  selector: 'app-home-beta',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="beta-page">
      <!-- HERO SECTION: Split Layout -->
      <section class="hero-section" id="hero">
        <div class="hero-container">
          <!-- Left Column: Text Content -->
          <div class="hero-copy">
            <div class="hero-badge">BETA</div>
            <h1 class="hero-title">
              {{ i18n.language() === 'ta' ? 'நம் சிதம்பரம்: ডিজিটাল সংস্করণ' : 'Nam Chidambaram: The Digital Way' }}
            </h1>
            <p class="hero-subtitle">
              {{ i18n.language() === 'ta' 
                ? 'আমাদের নতুন ডিজাইন অভিজ্ঞতা আপনার সম্প্রদায়কে কাছাকাছি নিয়ে আসে।'
                : 'Experience a modern, streamlined community directory designed for you.' }}
            </p>
            <p class="hero-description">
              {{ i18n.language() === 'ta'
                ? 'উন্নত অনুসন্ধান, সহজ আবিষ্কার, এবং আপনার প্রয়োজনীয় সবকিছু একটি স্থানে।'
                : 'Advanced search, easy discovery, and everything you need in one place.' }}
            </p>
            <div class="hero-actions">
              <a routerLink="/services" class="btn btn-primary">
                {{ i18n.language() === 'ta' ? 'সেবা অন্বেষণ করুন' : 'Explore Services' }}
                <i class="bi bi-arrow-up-right"></i>
              </a>
              <a routerLink="/services/submit" class="btn btn-secondary">
                {{ i18n.language() === 'ta' ? 'আপনার সেবা যোগ করুন' : 'Add Your Service' }}
                <i class="bi bi-arrow-up-right"></i>
              </a>
            </div>
          </div>

          <!-- Right Column: Carousel/Slider -->
          <div class="hero-carousel-container">
            <div class="carousel-wrapper">
              <div class="carousel-slides">
                @for (slide of carouselSlides; track slide.id; let i = $index) {
                  <div class="carousel-slide" [class.active]="activeCarouselSlide === i">
                    <div class="slide-content">
                      <div class="slide-icon">
                        <i [class]="'bi ' + slide.icon"></i>
                      </div>
                      <h3>{{ i18n.language() === 'ta' ? slide.titleTa : slide.titleEn }}</h3>
                      <p>{{ i18n.language() === 'ta' ? slide.descTa : slide.descEn }}</p>
                    </div>
                  </div>
                }
              </div>
              <!-- Carousel Controls -->
              <div class="carousel-controls">
                <button class="control-btn prev" (click)="previousSlide()" [attr.aria-label]="i18n.language() === 'ta' ? 'পূর্ববর্তী' : 'Previous'">
                  <i class="bi bi-chevron-left"></i>
                </button>
                <div class="carousel-dots">
                  @for (slide of carouselSlides; track slide.id; let i = $index) {
                    <button 
                      class="dot" 
                      [class.active]="activeCarouselSlide === i"
                      (click)="selectCarouselSlide(i)"
                      [attr.aria-label]="(i18n.language() === 'ta' ? 'স্লাইড ' : 'Slide ') + (i + 1)">
                    </button>
                  }
                </div>
                <button class="control-btn next" (click)="nextSlide()" [attr.aria-label]="i18n.language() === 'ta' ? 'পরবর্তী' : 'Next'">
                  <i class="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- FEATURES SECTION: 4 Card Grid -->
      <section class="features-section" id="features">
        <div class="section-container">
          <div class="section-header">
            <h2>{{ i18n.language() === 'ta' ? 'কেন আমাদের বেছে নিন' : 'Why Choose Us' }}</h2>
            <p>{{ i18n.language() === 'ta' 
              ? 'আমরা সম্প্রদায়ের জন্য একটি নতুন মান স্থাপন করছি।'
              : 'We set a new standard for community connection.' }}</p>
          </div>
          <div class="features-grid">
            @for (feature of betaFeatures; track feature.id) {
              <div class="feature-card" [class]="'feature-' + feature.color">
                <div class="feature-icon">
                  <i [class]="'bi ' + feature.icon"></i>
                </div>
                <h3>{{ i18n.language() === 'ta' ? feature.titleTa : feature.titleEn }}</h3>
                <p>{{ i18n.language() === 'ta' ? feature.descTa : feature.descEn }}</p>
                <a href="#" class="feature-link">
                  {{ i18n.language() === 'ta' ? 'আরও জানুন' : 'Learn more' }}
                  <i class="bi bi-arrow-right"></i>
                </a>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- SERVICES SECTION: Large Cards with Icons -->
      <section class="services-section" id="services-beta">
        <div class="section-container">
          <div class="section-header">
            <h2>{{ i18n.language() === 'ta' ? 'সেবার বিভাগ অন্বেষণ করুন' : 'Explore Service Categories' }}</h2>
            <p>{{ i18n.language() === 'ta'
              ? 'আপনার প্রয়োজন অনুযায়ী সেবা খুঁজুন।'
              : 'Find services tailored to your needs.' }}</p>
          </div>
          <div class="services-grid">
            @for (service of betaServices; track service.id) {
              <a routerLink="/services" class="service-card">
                <div class="service-icon-wrapper">
                  <i [class]="'bi ' + service.icon"></i>
                </div>
                <h3>{{ i18n.language() === 'ta' ? service.titleTa : service.titleEn }}</h3>
                <p>{{ i18n.language() === 'ta' ? service.descTa : service.descEn }}</p>
                <span class="service-arrow">
                  <i class="bi bi-arrow-up-right"></i>
                </span>
              </a>
            }
          </div>
        </div>
      </section>

      <!-- HOW IT WORKS SECTION -->
      <section class="how-it-works" id="how-it-works">
        <div class="section-container">
          <div class="section-header">
            <h2>{{ i18n.language() === 'ta' ? 'এটি কীভাবে কাজ করে' : 'How It Works' }}</h2>
            <p>{{ i18n.language() === 'ta'
              ? 'তিনটি সহজ ধাপে শুরু করুন।'
              : 'Get started in three simple steps.' }}</p>
          </div>
          <div class="steps-container">
            <div class="step-item">
              <div class="step-number">1</div>
              <h3>{{ i18n.language() === 'ta' ? 'অনুসন্ধান করুন' : 'Search' }}</h3>
              <p>{{ i18n.language() === 'ta'
                ? 'আপনার প্রয়োজনীয় সেবা খুঁজুন এবং প্রদানকারীদের আবিষ্কার করুন।'
                : 'Find the service you need and discover providers.' }}</p>
            </div>
            <div class="step-divider"></div>
            <div class="step-item">
              <div class="step-number">2</div>
              <h3>{{ i18n.language() === 'ta' ? 'সংযোগ করুন' : 'Connect' }}</h3>
              <p>{{ i18n.language() === 'ta'
                ? 'সরাসরি প্রদানকারীর সাথে যোগাযোগ করুন।'
                : 'Reach out directly to the provider.' }}</p>
            </div>
            <div class="step-divider"></div>
            <div class="step-item">
              <div class="step-number">3</div>
              <h3>{{ i18n.language() === 'ta' ? 'অভিজ্ঞতা নিন' : 'Experience' }}</h3>
              <p>{{ i18n.language() === 'ta'
                ? 'স্থানীয় সেবা অভিজ্ঞতা এবং সমর্থন পান।'
                : 'Enjoy trusted local service and support.' }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA SECTION -->
      <section class="cta-section" id="cta">
        <div class="section-container">
          <div class="cta-content">
            <div class="cta-badge">GET STARTED</div>
            <h2>{{ i18n.language() === 'ta' ? 'আজই যোগ দিন' : 'Join the Community Today' }}</h2>
            <p>{{ i18n.language() === 'ta'
              ? 'আপনার সেবা শেয়ার করুন এবং স্থানীয় মানুষের সাথে সংযোগ করুন।'
              : 'Share your service and connect with local people.' }}</p>
            <div class="cta-buttons">
              <a routerLink="/services/submit" class="btn btn-primary-large">
                {{ i18n.language() === 'ta' ? 'সেবা যোগ করুন' : 'Add Your Service' }}
              </a>
              <a routerLink="/services" class="btn btn-secondary-outline">
                {{ i18n.language() === 'ta' ? 'সেবা ব্রাউজ করুন' : 'Browse Services' }}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrl: './home-beta.component.scss',
})
export class HomeBetaComponent implements OnInit {
  protected readonly i18n = inject(LanguageService);
  protected readonly categoryService = inject(ServiceCategoryService);

  protected readonly betaFeatures = BETA_FEATURES;
  protected readonly betaServices = BETA_SERVICES;

  protected carouselSlides = [
    {
      id: 'slide-1',
      icon: 'bi-geo-alt-fill',
      titleEn: 'Local First',
      titleTa: 'স্থানীয় প্রথম',
      descEn: 'Services from your community, by your community.',
      descTa: 'আপনার সম্প্রদায়ের সেবা, আপনার সম্প্রদায়ের দ্বারা।',
    },
    {
      id: 'slide-2',
      icon: 'bi-star-fill',
      titleEn: 'Verified Providers',
      titleTa: 'যাচাইকৃত প্রদানকারী',
      descEn: 'Trusted and vetted service providers.',
      descTa: 'বিশ্বস্ত এবং যাচাইকৃত সেবা প্রদানকারী।',
    },
    {
      id: 'slide-3',
      icon: 'bi-chat-dots-fill',
      titleEn: 'Direct Communication',
      titleTa: 'সরাসরি যোগাযোগ',
      descEn: 'Connect directly without intermediaries.',
      descTa: 'মধ্যস্থতাকারী ছাড়াই সরাসরি সংযোগ করুন।',
    },
  ];

  protected activeCarouselSlide = 0;

  ngOnInit(): void {
    this.categoryService.load();
  }

  protected nextSlide(): void {
    this.activeCarouselSlide = (this.activeCarouselSlide + 1) % this.carouselSlides.length;
  }

  protected previousSlide(): void {
    this.activeCarouselSlide = (this.activeCarouselSlide - 1 + this.carouselSlides.length) % this.carouselSlides.length;
  }

  protected selectCarouselSlide(index: number): void {
    this.activeCarouselSlide = index;
  }
}
