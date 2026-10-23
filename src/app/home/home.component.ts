import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { ServiceListing } from '../core/models/service-listing';
import { CategoryCardComponent } from './category-card.component';

interface LandingValue {
  readonly id: string;
  readonly icon: string;
  readonly titleEnglish: string;
  readonly titleTamil: string;
  readonly descriptionEnglish: string;
  readonly descriptionTamil: string;
}

interface ServiceHighlight {
  readonly id: string;
  readonly icon: string;
  readonly tone: string;
  readonly titleEnglish: string;
  readonly titleTamil: string;
  readonly descriptionEnglish: string;
  readonly descriptionTamil: string;
}

const LANDING_VALUES: readonly LandingValue[] = [
  {
    id: 'local', icon: 'bi-geo-alt', titleEnglish: 'Made for our town', titleTamil: 'நம் ஊருக்காக',
    descriptionEnglish: 'Useful local information in one place.', descriptionTamil: 'உள்ளூர் தகவல்கள் ஒரே இடத்தில்.',
  },
  {
    id: 'simple', icon: 'bi-stars', titleEnglish: 'Simple to discover', titleTamil: 'எளிதாகக் கண்டறியுங்கள்',
    descriptionEnglish: 'Find the right service without the noise.', descriptionTamil: 'தேவையான சேவையை விரைவாகக் கண்டறியுங்கள்.',
  },
  {
    id: 'bilingual', icon: 'bi-translate', titleEnglish: 'Tamil + English', titleTamil: 'தமிழ் + ஆங்கிலம்',
    descriptionEnglish: 'A community experience for everyone.', descriptionTamil: 'அனைவருக்குமான சமூக அனுபவம்.',
  },
  {
    id: 'together', icon: 'bi-people', titleEnglish: 'Built together', titleTamil: 'ஒன்றாக உருவாக்குவோம்',
    descriptionEnglish: 'Share what you offer with local people.', descriptionTamil: 'உங்கள் சேவையை உள்ளூர் மக்களுடன் பகிருங்கள்.',
  },
] as const;

const SERVICE_HIGHLIGHTS: readonly ServiceHighlight[] = [
  {
    id: 'home', icon: 'bi-house-heart', tone: 'green', titleEnglish: 'Home & everyday life', titleTamil: 'வீடு மற்றும் அன்றாட வாழ்க்கை',
    descriptionEnglish: 'Find trusted help for the things that keep your home moving.', descriptionTamil: 'உங்கள் வீட்டிற்குத் தேவையான உதவிகளை எளிதாகக் கண்டறியுங்கள்.',
  },
  {
    id: 'wellbeing', icon: 'bi-heart-pulse', tone: 'rose', titleEnglish: 'Health & wellbeing', titleTamil: 'ஆரோக்கியம் மற்றும் நலம்',
    descriptionEnglish: 'Explore healthcare, wellness, and support close to home.', descriptionTamil: 'உங்களுக்கு அருகிலுள்ள சுகாதார மற்றும் நல சேவைகளைப் பாருங்கள்.',
  },
  {
    id: 'learning', icon: 'bi-mortarboard', tone: 'gold', titleEnglish: 'Learning & work', titleTamil: 'கல்வி மற்றும் வேலை',
    descriptionEnglish: 'Connect with opportunities, skills, and local expertise.', descriptionTamil: 'வாய்ப்புகள், திறன்கள் மற்றும் உள்ளூர் நிபுணர்களுடன் இணையுங்கள்.',
  },
  {
    id: 'local-life', icon: 'bi-shop', tone: 'blue', titleEnglish: 'Local businesses', titleTamil: 'உள்ளூர் வணிகங்கள்',
    descriptionEnglish: 'Discover the people and businesses that make our town special.', descriptionTamil: 'நம் ஊரை சிறப்பாக்கும் மனிதர்களையும் வணிகங்களையும் கண்டறியுங்கள்.',
  },
] as const;

@Component({
  selector: 'app-home',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">{{ i18n.text().skip }}</a>
    <header class="site-header">
      <div class="header-inner">
        <a routerLink="/" class="brand">
          <img ngSrc="assets/images/nam-chidambaram-logo.png"
            width="1672" height="941" priority alt="" aria-hidden="true" class="brand-logo" />
          <span class="brand-copy">
            <strong lang="en">Nam Chidambaram</strong>
            <span lang="ta">நம் சிதம்பரம்</span>
            <small lang="en">Our town · Our people · Our services</small>
          </span>
        </a>
        <form class="header-search" action="/service-search" (submit)="search($event, headerSearch.value)">
          <i class="bi bi-search search-icon" aria-hidden="true"></i>
          <input #headerSearch type="search" name="q" maxlength="200" [placeholder]="i18n.language() === 'ta' ? 'சேவைகளைத் தேடுங்கள்...' : 'Search local services...'" [attr.aria-label]="i18n.language() === 'ta' ? 'சேவைகளைத் தேடுங்கள்' : 'Search local services'">
          <button type="submit" class="search-submit" [attr.aria-label]="i18n.language() === 'ta' ? 'தேடுக' : 'Search'"><i class="bi bi-arrow-right" aria-hidden="true"></i></button>
        </form>
        <div class="language-switch" role="group" aria-label="Language / மொழி">
          <button type="button" lang="ta" [class.active]="i18n.language() === 'ta'" [attr.aria-pressed]="i18n.language() === 'ta'" (click)="i18n.setLanguage('ta')">தமிழ்</button>
          <button type="button" lang="en" [class.active]="i18n.language() === 'en'" [attr.aria-pressed]="i18n.language() === 'en'" (click)="i18n.setLanguage('en')">English</button>
        </div>
      </div>
      <nav class="main-nav" [attr.aria-label]="i18n.language() === 'ta' ? 'முதன்மை வழிசெலுத்தல்' : 'Main navigation'">
        <a routerLink="/" routerLinkActive="nav-active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page"><i class="bi bi-house-door" aria-hidden="true"></i><span>{{ i18n.language() === 'ta' ? 'முகப்பு' : 'Home' }}</span></a>
        <a routerLink="/services" routerLinkActive="nav-active" ariaCurrentWhenActive="page"><i class="bi bi-grid" aria-hidden="true"></i><span>{{ i18n.language() === 'ta' ? 'சேவைகள்' : 'Explore Services' }}</span></a>
        <a routerLink="/" fragment="about"><i class="bi bi-compass" aria-hidden="true"></i><span>{{ i18n.language() === 'ta' ? 'நம் கதை' : 'Our story' }}</span></a>
        <a routerLink="/" fragment="community"><i class="bi bi-plus-circle" aria-hidden="true"></i><span>{{ i18n.language() === 'ta' ? 'சேவையைப் பகிருங்கள்' : 'For providers' }}</span></a>
        <a routerLink="/account" routerLinkActive="nav-active" ariaCurrentWhenActive="page"><i class="bi bi-person-circle" aria-hidden="true"></i><span>{{ i18n.language() === 'ta' ? 'கணக்கு' : 'Account' }}</span></a>
        <a routerLink="/admin/login" routerLinkActive="nav-active" ariaCurrentWhenActive="page"><i class="bi bi-shield-lock" aria-hidden="true"></i><span>{{ i18n.language() === 'ta' ? 'நிர்வாகம்' : 'Admin' }}</span></a>
      </nav>
    </header>

    <main id="main" tabindex="-1"><router-outlet (activate)="focusContent()" /></main>
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-intro">
          <a routerLink="/" class="footer-brand">{{ i18n.text().brand }} <small [lang]="i18n.secondaryLanguage()">{{ i18n.text().secondaryBrand }}</small></a>
          <p>{{ i18n.language() === 'ta' ? 'நம் ஊரையும், நம் மக்களையும், நம் சேவைகளையும் இணைக்கும் ஒரு சமூகத் தளம்.' : 'A welcoming local directory connecting our town, our people, and the services we share.' }}</p>
        </div>
        <div class="footer-links">
          <strong>{{ i18n.language() === 'ta' ? 'விரைவு இணைப்புகள்' : 'Explore' }}</strong>
          <a routerLink="/services">{{ i18n.language() === 'ta' ? 'அனைத்து சேவைகள்' : 'All services' }}</a>
          <a routerLink="/" fragment="about">{{ i18n.language() === 'ta' ? 'நம் கதை' : 'Our story' }}</a>
          <a routerLink="/account">{{ i18n.language() === 'ta' ? 'கணக்கு' : 'Account' }}</a>
        </div>
        <div class="footer-links">
          <strong>{{ i18n.language() === 'ta' ? 'சேவை வழங்குநர்களுக்கு' : 'For providers' }}</strong>
          <a routerLink="/services/submit">{{ i18n.language() === 'ta' ? 'சேவையைச் சேர்க்கவும்' : 'Add your service' }}</a>
          <a routerLink="/my-submissions">{{ i18n.language() === 'ta' ? 'எனது சமர்ப்பிப்புகள்' : 'My submissions' }}</a>
          <a routerLink="/admin/login">{{ i18n.language() === 'ta' ? 'நிர்வாக உள்நுழைவு' : 'Admin login' }}</a>
        </div>
      </div>
      <div class="footer-bottom"><span>{{ i18n.text().footer }}</span><span>© {{ i18n.language() === 'ta' ? 'நம் சிதம்பரம்' : 'Nam Chidambaram' }}</span></div>
    </footer>
  `,
  styleUrl: './site-layout.component.scss',
})
export class HomeComponent {
  protected readonly i18n = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected search(event: Event, term: string): void {
    event.preventDefault();
    void this.router.navigate([term.trim() ? '/service-search' : '/services'], { queryParams: term.trim() ? { q: term.trim() } : {} });
  }

  protected focusContent(): void {
    this.document.getElementById('main')?.focus({ preventScroll: true });
  }
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink, NgOptimizedImage, CategoryCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero" id="top" aria-labelledby="home-title">
      <div class="hero-copy">
        <p class="eyebrow"><span>{{ i18n.language() === 'ta' ? 'நம் ஊர்' : 'Our town' }}</span><i></i><span>{{ i18n.language() === 'ta' ? 'நம் மக்கள்' : 'Our people' }}</span><i></i><span>{{ i18n.language() === 'ta' ? 'நம் சேவைகள்' : 'Our services' }}</span></p>
        @if (i18n.language() === 'ta') {
          <h1 id="home-title">சிதம்பரத்தில் உங்களுக்குத் தேவையான அனைத்தும் <em>ஒரே இடத்தில்</em></h1>
        } @else {
          <h1 id="home-title">Everything you need for your community, <em>all in one place.</em></h1>
        }
        <p class="hero-description">{{ i18n.language() === 'ta' ? 'வீடு, கல்வி, மருத்துவம், கட்டுமானம் மற்றும் பல உள்ளூர் சேவைகளை எளிதாகக் கண்டறியுங்கள்.' : 'Discover local services, useful information, and the people who make Chidambaram feel like home.' }}</p>
        <div class="hero-actions">
          <a routerLink="/services" class="button button-primary">{{ i18n.language() === 'ta' ? 'சேவைகளைப் பார்க்க' : 'Explore services' }} <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>
          <a routerLink="/" fragment="community" class="button button-secondary">{{ i18n.language() === 'ta' ? 'சேவையைப் பகிருங்கள்' : 'Share your service' }} <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>
        </div>
        <form class="hero-search" action="/service-search" (submit)="search($event, heroSearch.value)">
          <i class="bi bi-search" aria-hidden="true"></i>
          <input #heroSearch type="search" name="q" maxlength="200" [placeholder]="i18n.language() === 'ta' ? 'எந்த சேவை தேவை?' : 'What service do you need?'" [attr.aria-label]="i18n.language() === 'ta' ? 'சேவையைத் தேடுங்கள்' : 'Find a service'">
          <button type="submit">{{ i18n.language() === 'ta' ? 'தேடுக' : 'Search' }} <i class="bi bi-arrow-right" aria-hidden="true"></i></button>
        </form>
        <div class="hero-points"><span><b aria-hidden="true"><i class="bi bi-check2"></i></b>{{ i18n.language() === 'ta' ? 'உள்ளூர் சேவைகள்' : 'Local services' }}</span><span><b aria-hidden="true"><i class="bi bi-check2"></i></b>{{ i18n.language() === 'ta' ? 'எளிதான தேடல்' : 'Easy discovery' }}</span><span><b aria-hidden="true"><i class="bi bi-check2"></i></b>{{ i18n.language() === 'ta' ? 'இருமொழி அனுபவம்' : 'Tamil + English' }}</span></div>
      </div>
      <div class="hero-art" (mouseenter)="pauseCarousel()" (mouseleave)="resumeCarousel()" (focusin)="pauseCarousel()" (focusout)="resumeCarousel()">
        <div class="hero-image-frame carousel-frame">
          @for (slide of heroSlides; track slide.id; let i = $index) {
            <div class="hero-slide" [class.active]="activeSlide === i" [attr.aria-hidden]="activeSlide !== i">
              <img [src]="slide.image" width="1774" height="887" [alt]="slide.alt" [attr.fetchpriority]="i === 0 ? 'high' : 'auto'" [attr.loading]="i === 0 ? 'eager' : 'lazy'" class="hero-image" />
              <div class="slide-caption">
                <span>{{ i18n.language() === 'ta' ? slide.kickerTa : slide.kickerEn }}</span>
                <strong>{{ i18n.language() === 'ta' ? slide.titleTa : slide.titleEn }}</strong>
              </div>
            </div>
          }
        </div>
        <div class="hero-badge"><span aria-hidden="true">நம்</span><small>{{ i18n.language() === 'ta' ? 'நம் ஊர்' : 'OUR TOWN' }}</small></div>
        <div class="carousel-controls" role="group" [attr.aria-label]="i18n.language() === 'ta' ? 'பதாகை கட்டுப்பாடுகள்' : 'Banner controls'">
          <span class="slide-counter">{{ (activeSlide + 1).toString().padStart(2, '0') }} <small>/ {{ heroSlides.length.toString().padStart(2, '0') }}</small></span>
          <div class="slide-dots">
            @for (slide of heroSlides; track slide.id; let i = $index) {
              <button type="button" [class.active]="activeSlide === i" (click)="selectSlide(i)" [attr.aria-label]="(i18n.language() === 'ta' ? 'பதாகை ' : 'Banner ') + (i + 1)" [attr.aria-pressed]="activeSlide === i"></button>
            }
          </div>
          <button type="button" class="slide-arrow" (click)="previousSlide()" [attr.aria-label]="i18n.language() === 'ta' ? 'முந்தைய பதாகை' : 'Previous banner'">‹</button>
          <button type="button" class="slide-arrow" (click)="nextSlide()" [attr.aria-label]="i18n.language() === 'ta' ? 'அடுத்த பதாகை' : 'Next banner'">›</button>
        </div>
      </div>
    </section>

    <section class="trust-strip" [attr.aria-label]="i18n.language() === 'ta' ? 'சமூக நன்மைகள்' : 'Community benefits'">
      @for (value of communityValues; track value.id) {
        <div class="trust-item">
          <span class="trust-icon" [class]="'trust-icon ' + value.id" aria-hidden="true"><i class="bi" [class]="'bi ' + value.icon"></i></span>
          <span><strong>{{ i18n.language() === 'ta' ? value.titleTamil : value.titleEnglish }}</strong><small>{{ i18n.language() === 'ta' ? value.descriptionTamil : value.descriptionEnglish }}</small></span>
        </div>
      }
    </section>

    <section class="directory-home-section" id="categories" aria-labelledby="category-title">
      <div class="section-heading">
        <div><p class="section-kicker">{{ i18n.language() === 'ta' ? 'சிதம்பரத்தை ஆராயுங்கள்' : 'EXPLORE YOUR TOWN' }}</p>
          <h2 id="category-title">{{ i18n.language() === 'ta' ? 'எதைத் தேடுகிறீர்கள்?' : 'What are you looking for?' }}</h2>
          <p class="section-intro">{{ i18n.language() === 'ta' ? 'உங்கள் தேவைக்கேற்ற சேவை வகையைத் தேர்ந்தெடுங்கள்.' : 'Choose a category to discover useful local services.' }}</p>
        </div>
        <a class="section-link" routerLink="/services">{{ i18n.language() === 'ta' ? 'அனைத்து வகைகளும்' : 'All categories' }} <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>
      </div>
      @if (categoryService.loading()) {
        <p class="home-state">{{ i18n.language() === 'ta' ? 'சேவை வகைகள் ஏற்றப்படுகின்றன…' : 'Loading local categories…' }}</p>
      } @else if (categoryService.error()) {
        <p class="home-state">{{ i18n.language() === 'ta' ? 'வகைகளை ஏற்ற முடியவில்லை.' : 'Categories could not be loaded.' }} <button type="button" class="text-button" (click)="loadCategories()">{{ i18n.language() === 'ta' ? 'மீண்டும் முயற்சிக்கவும்' : 'Try again' }}</button></p>
      } @else if (categoryService.categories().length) {
        <div class="home-category-grid">
          @for (category of categoryService.categories().slice(0, 8); track category.id) {
            <app-category-card [category]="category" />
          }
        </div>
      } @else {
        <p class="home-state">{{ i18n.language() === 'ta' ? 'சேவை வகைகள் விரைவில் இங்கே காண்பிக்கப்படும்.' : 'Categories will appear here when available.' }}</p>
      }
    </section>

    <section class="sponsor-strip" aria-label="Advertising">
      <div class="sponsor-mark"><i class="bi bi-megaphone" aria-hidden="true"></i></div>
      <div><p class="section-kicker">{{ i18n.language() === 'ta' ? 'உள்ளூர் விளம்பர இடம்' : 'LOCAL SPOTLIGHT' }}</p>
        <h2>{{ i18n.language() === 'ta' ? 'உங்கள் வணிகத்தை சிதம்பரம் மக்களிடம் கொண்டு செல்லுங்கள்.' : 'Put your business in front of the Chidambaram community.' }}</h2>
        <p>{{ i18n.language() === 'ta' ? 'உள்ளூர் வணிகங்களுக்கும் சேவைகளுக்கும் சிறப்பு விளம்பர இடம்.' : 'A dedicated space for local businesses, services and community announcements.' }}</p>
      </div>
      <a routerLink="/services/submit">{{ i18n.language() === 'ta' ? 'சேவையைப் பகிருங்கள்' : 'Promote your service' }} <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>
    </section>

    <section class="home-listings-section" id="featured-listings" aria-labelledby="listings-title">
      <div class="section-heading">
        <div><p class="section-kicker">{{ i18n.language() === 'ta' ? 'உள்ளூர் சேவைகள்' : 'DISCOVER LOCAL' }}</p>
          <h2 id="listings-title">{{ i18n.language() === 'ta' ? 'சமூகத்தில் சிறப்பாக' : 'Featured in your community' }}</h2>
          <p class="section-intro">{{ i18n.language() === 'ta' ? 'சரிபார்க்கப்பட்ட உள்ளூர் சேவைகளை ஆராயுங்கள்.' : 'Explore published services from verified local providers.' }}</p>
        </div>
        <a class="section-link" routerLink="/services">{{ i18n.language() === 'ta' ? 'அனைத்து சேவைகள்' : 'View all services' }} <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>
      </div>
      @if (listingsLoading) {
        <p class="home-state">{{ i18n.language() === 'ta' ? 'சேவைகள் ஏற்றப்படுகின்றன…' : 'Loading featured services…' }}</p>
      } @else if (featuredListings.length) {
        <div class="home-listing-grid">
          @for (listing of featuredListings; track listing.id) {
            <a class="home-listing-card" [routerLink]="['/providers', listing.service_providers.id]">
              <div class="listing-photo">
                @if (listingImage(listing); as image) { <img [src]="image" [alt]="listing.title" loading="lazy" /> }
                @else { <span class="listing-placeholder"><i class="bi bi-shop" aria-hidden="true"></i></span> }
                <span class="verified-tag"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> {{ i18n.language() === 'ta' ? 'சரிபார்க்கப்பட்டது' : 'Verified' }}</span>
              </div>
              <div class="listing-copy">
                <span class="listing-provider">{{ listing.service_providers.display_name }}</span>
                <h3>{{ listing.title }}</h3>
                <p>{{ listing.description }}</p>
                <span class="listing-location"><i class="bi bi-geo-alt" aria-hidden="true"></i> {{ listingLocation(listing) }}</span>
                <span class="listing-open">{{ i18n.language() === 'ta' ? 'விவரங்களைப் பார்க்க' : 'View details' }} <i class="bi bi-arrow-up-right" aria-hidden="true"></i></span>
              </div>
            </a>
          }
        </div>
      } @else {
        <p class="home-state">{{ i18n.language() === 'ta' ? 'வெளியிடப்பட்ட சேவைகள் கிடைக்கும் போது இங்கே காண்பிக்கப்படும்.' : 'Published services will appear here when available.' }}</p>
      }
    </section>

    <section class="featured-section" id="discover" aria-labelledby="featured-title">
      <div class="section-heading">
        <div><p class="section-kicker">{{ i18n.language() === 'ta' ? 'உங்கள் சமூகத்திற்காக' : 'MADE FOR YOUR COMMUNITY' }}</p><h2 id="featured-title">{{ i18n.language() === 'ta' ? 'எதைத் தேடுகிறீர்கள்?' : 'Start with what you need' }}</h2></div>
        <a class="section-link" routerLink="/services">{{ i18n.language() === 'ta' ? 'அனைத்து சேவைகள்' : 'View all services' }} <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>
      </div>
      <div class="featured-grid">
        @for (highlight of serviceHighlights; track highlight.id) {
          <a class="feature-card" routerLink="/services">
            <span class="feature-card-top"><span [class]="'feature-icon ' + highlight.tone" aria-hidden="true"><i class="bi" [class]="'bi ' + highlight.icon"></i></span><i class="bi bi-arrow-up-right card-arrow" aria-hidden="true"></i></span>
            <h3>{{ i18n.language() === 'ta' ? highlight.titleTamil : highlight.titleEnglish }}</h3>
            <p>{{ i18n.language() === 'ta' ? highlight.descriptionTamil : highlight.descriptionEnglish }}</p>
            <span class="card-link">{{ i18n.language() === 'ta' ? 'சேவைகளைப் பார்க்க' : 'Explore services' }} <i class="bi bi-arrow-right" aria-hidden="true"></i></span>
          </a>
        }
      </div>
    </section>

    <section class="story-section" id="about" aria-labelledby="story-title">
      <div class="story-media">
        <img ngSrc="assets/images/chidambaram-hero1.png" width="1650" height="953" loading="lazy" alt="Chidambaram services and local community illustrated beside the town temple" />
        <span class="story-caption">{{ i18n.language() === 'ta' ? 'நம் சிதம்பரம்' : 'NAM CHIDAMBARAM' }}</span>
      </div>
      <div class="story-copy">
        <p class="section-kicker">{{ i18n.language() === 'ta' ? 'நம் சமூகத்தின் கதை' : 'OUR COMMUNITY STORY' }}</p>
        <h2 id="story-title">{{ i18n.language() === 'ta' ? 'நம் ஊரை சிறப்பாக்குவது நம் மக்கள்.' : 'Our town is at its best when its people are connected.' }}</h2>
        <p>{{ i18n.language() === 'ta' ? 'நம் சிதம்பரம் என்பது உள்ளூர் சேவைகள் மற்றும் பயனுள்ள தகவல்களை எளிதாகக் கண்டறிய உதவும் ஒரு சமூகத் தளம்.' : 'Nam Chidambaram brings local services and useful information together in a way that feels clear, welcoming, and made for everyday life.' }}</p>
        <p>{{ i18n.language() === 'ta' ? 'உங்களுக்கு தேவையானதைத் தேடுங்கள், உங்களுக்குத் தெரிந்ததைப் பகிருங்கள், நம் ஊருடன் இணைந்திருங்கள்.' : 'Find what you need, share what you offer, and stay connected to the people and places around you.' }}</p>
        <a class="text-link" routerLink="/services">{{ i18n.language() === 'ta' ? 'உள்ளூர் சேவைகளை ஆராயுங்கள்' : 'Explore the local directory' }} <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>
      </div>
    </section>

    <section class="community-banner" id="community" aria-labelledby="provider-title">
      <div class="banner-icon" aria-hidden="true"><i class="bi bi-plus-lg"></i></div>
      <div class="banner-copy"><p class="banner-kicker">{{ i18n.language() === 'ta' ? 'சமூகத்துடன் இணைவோம்' : 'GROW WITH THE COMMUNITY' }}</p><h2 id="provider-title">{{ i18n.language() === 'ta' ? 'உங்கள் சேவையையும் இங்கே இணைக்கலாம்' : 'Bring your service to the community.' }}</h2><p>{{ i18n.language() === 'ta' ? 'நம் சிதம்பரம் சமூகத்துடன் உங்கள் சேவையைப் பகிர்ந்து, அதிக மக்களைச் சென்றடையுங்கள்.' : 'Share what you offer with local people and help make the directory more useful for everyone.' }}</p></div>
      <a routerLink="/services/submit">{{ i18n.language() === 'ta' ? 'சேவையைச் சேர்க்கவும்' : 'Add your service' }} <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>
    </section>
  `,
  styleUrl: './home.component.scss',
})
export class LandingComponent implements OnInit, OnDestroy {
  protected readonly i18n = inject(LanguageService);
  protected readonly categoryService = inject(ServiceCategoryService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  protected readonly communityValues = LANDING_VALUES;
  protected readonly serviceHighlights = SERVICE_HIGHLIGHTS;
  protected readonly heroSlides = [
    { id: 'town', image: 'assets/images/chidambaram-hero.png', alt: 'Chidambaram temple and local community', kickerEn: 'OUR TOWN · OUR PEOPLE', kickerTa: 'நம் ஊர் · நம் மக்கள்', titleEn: 'A closer connection to Chidambaram', titleTa: 'சிதம்பரத்துடன் இன்னும் நெருக்கமான இணைப்பு' },
    { id: 'community', image: 'assets/images/chidambaram-hero1.png', alt: 'Local services and community life in Chidambaram', kickerEn: 'LOCAL LIFE, MADE EASIER', kickerTa: 'உள்ளூர் வாழ்க்கை எளிதாக', titleEn: 'Discover the people behind local services', titleTa: 'உள்ளூர் சேவைகளின் பின்னால் உள்ள மக்களைக் கண்டறியுங்கள்' },
    { id: 'services', image: 'assets/images/chidambaram-hero.png', alt: 'Explore services across Chidambaram', kickerEn: 'FIND WHAT YOU NEED', kickerTa: 'உங்களுக்குத் தேவையானதைத் தேடுங்கள்', titleEn: 'Your local directory starts here', titleTa: 'உங்கள் உள்ளூர் சேவைத் தேடல் இங்கே தொடங்குகிறது' },
  ] as const;
  protected activeSlide = 0;
  protected featuredListings: ServiceListing[] = [];
  protected listingsLoading = false;
  private carouselTimer?: ReturnType<typeof setInterval>;
  private carouselPaused = false;
  private prefersReducedMotion = false;

  ngOnInit(): void {
    void this.loadCategories();
    void this.loadFeaturedListings();
    if (typeof window !== 'undefined') {
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.startCarousel();
    }
  }

  ngOnDestroy(): void {
    this.stopCarousel();
  }

  protected async loadCategories(): Promise<void> {
    await this.categoryService.load();
  }

  protected async loadFeaturedListings(): Promise<void> {
    this.listingsLoading = true;
    try {
      const page = await this.directory.search(null, null, '', 0);
      this.featuredListings = page.listings.slice(0, 4);
    } catch {
      this.featuredListings = [];
    } finally {
      this.listingsLoading = false;
      this.cdr.markForCheck();
    }
  }

  protected listingImage(listing: ServiceListing): string | null {
    const media = listing.listing_media
      .filter(item => item.media_assets?.visibility === 'public' && item.media_assets.media_type === 'image')
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.media_assets;
    return media ? this.directory.imageUrl(media.storage_path) : null;
  }

  protected listingLocation(listing: ServiceListing): string {
    const place = listing.listing_locations.find(item => item.locations)?.locations;
    if (!place) return this.i18n.language() === 'ta' ? 'சிதம்பரம்' : 'Chidambaram';
    return this.i18n.language() === 'ta' ? place.name_ta : place.name_en ?? place.name_ta;
  }

  protected selectSlide(index: number): void {
    this.activeSlide = index;
    this.restartCarousel();
  }
  protected nextSlide(): void { this.activeSlide = (this.activeSlide + 1) % this.heroSlides.length; }
  protected previousSlide(): void { this.activeSlide = (this.activeSlide - 1 + this.heroSlides.length) % this.heroSlides.length; }
  protected pauseCarousel(): void { this.carouselPaused = true; this.stopCarousel(); }
  protected resumeCarousel(): void { this.carouselPaused = false; this.startCarousel(); }
  private restartCarousel(): void { this.stopCarousel(); this.startCarousel(); }
  private startCarousel(): void {
    if (this.prefersReducedMotion || this.carouselPaused || this.carouselTimer || this.heroSlides.length < 2) return;
    this.carouselTimer = setInterval(() => this.nextSlide(), 6000);
  }
  private stopCarousel(): void {
    if (this.carouselTimer) clearInterval(this.carouselTimer);
    this.carouselTimer = undefined;
  }

  protected search(event: Event, term: string): void {
    event.preventDefault();
    void this.router.navigate([term.trim() ? '/service-search' : '/services'], { queryParams: term.trim() ? { q: term.trim() } : {} });
  }
}
