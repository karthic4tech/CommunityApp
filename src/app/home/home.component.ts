import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { LanguageService } from '../core/services/language.service';

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
        <form class="header-search" action="/service-search" (submit)="search($event, headerSearch.value)"><span class="search-icon" aria-hidden="true">⌕</span><input #headerSearch type="search" name="q" maxlength="200" [placeholder]="i18n.language() === 'ta' ? 'சேவைகளைத் தேடுங்கள்...' : 'Search services...'" [attr.aria-label]="i18n.language() === 'ta' ? 'சேவைகளைத் தேடுங்கள்' : 'Search services'"><button type="submit" class="search-submit" [attr.aria-label]="i18n.language() === 'ta' ? 'தேடுக' : 'Search'">→</button></form>
        <div class="language-switch" role="group" aria-label="Language / மொழி">
          <button type="button" lang="ta" [class.active]="i18n.language() === 'ta'" [attr.aria-pressed]="i18n.language() === 'ta'" (click)="i18n.setLanguage('ta')">தமிழ்</button>
          <button type="button" lang="en" [class.active]="i18n.language() === 'en'" [attr.aria-pressed]="i18n.language() === 'en'" (click)="i18n.setLanguage('en')">English</button>
        </div>
      </div>
      <nav class="main-nav" [attr.aria-label]="i18n.language() === 'ta' ? 'முதன்மை வழிசெலுத்தல்' : 'Main navigation'">
        <a routerLink="/" routerLinkActive="nav-active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page"><span aria-hidden="true">⌂</span><span>{{ i18n.language() === 'ta' ? 'முகப்பு' : 'Home' }}</span></a>
        <a routerLink="/services" routerLinkActive="nav-active" ariaCurrentWhenActive="page"><span aria-hidden="true">▦</span><span>{{ i18n.language() === 'ta' ? 'சேவைகள்' : 'Services' }}</span></a>
        <a routerLink="/" fragment="community"><span aria-hidden="true">♧</span><span>{{ i18n.language() === 'ta' ? 'உள்ளூர் வணிகங்கள்' : 'Local businesses' }}</span></a>
        <a routerLink="/services"><span aria-hidden="true">▣</span><span>{{ i18n.language() === 'ta' ? 'வேலைவாய்ப்புகள்' : 'Jobs' }}</span></a>
        <a routerLink="/" fragment="community"><span aria-hidden="true">♧</span><span>{{ i18n.language() === 'ta' ? 'நிகழ்வுகள்' : 'Events' }}</span></a>
      </nav>
    </header>

    <main id="main" tabindex="-1"><router-outlet (activate)="focusContent()" /></main>
    <footer><span class="footer-brand">{{ i18n.text().brand }} <small [lang]="i18n.secondaryLanguage()">{{ i18n.text().secondaryBrand }}</small></span><span>{{ i18n.text().footer }}</span></footer>
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
  imports: [RouterLink, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
      <section class="hero" id="top" aria-labelledby="home-title">
        <div class="hero-copy">
          <p class="eyebrow"><span>{{ i18n.language() === 'ta' ? 'நம் ஊர்' : 'Our town' }}</span><i></i><span>{{ i18n.language() === 'ta' ? 'நம் மக்கள்' : 'Our people' }}</span><i></i><span>{{ i18n.language() === 'ta' ? 'நம் சேவைகள்' : 'Our services' }}</span></p>
          <h1 id="home-title">{{ i18n.language() === 'ta' ? 'சிதம்பரத்தில் உங்களுக்குத் தேவையான அனைத்தும் ஒரே இடத்தில்' : 'Everything you need in Chidambaram, all in one place' }}</h1>
          <p class="hero-description">{{ i18n.language() === 'ta' ? 'வீடு, கல்வி, மருத்துவம், கட்டுமானம் மற்றும் பல உள்ளூர் சேவைகளை எளிதாகக் கண்டறியுங்கள்.' : 'Discover trusted local services for home, education, healthcare, construction and more.' }}</p>
          <form class="hero-search" action="/service-search" (submit)="search($event, heroSearch.value)"><span aria-hidden="true">⌕</span><input #heroSearch type="search" name="q" maxlength="200" [placeholder]="i18n.language() === 'ta' ? 'எந்த சேவை தேவை?' : 'What service do you need?'" [attr.aria-label]="i18n.language() === 'ta' ? 'சேவையைத் தேடுங்கள்' : 'Find a service'"><button type="submit">{{ i18n.language() === 'ta' ? 'தேடுக' : 'Explore' }} <span aria-hidden="true">→</span></button></form>
          <div class="hero-points"><span><b aria-hidden="true">✓</b>{{ i18n.language() === 'ta' ? 'உள்ளூர் சேவைகள்' : 'Local services' }}</span><span><b aria-hidden="true">✓</b>{{ i18n.language() === 'ta' ? 'எளிதான தேடல்' : 'Easy discovery' }}</span></div>
        </div>
        <div class="hero-art">
  <img
    ngSrc="assets/images/chidambaram-hero.png"
    width="1774"
    height="887"
    priority
    alt="Chidambaram temple, local streets and community"
    class="hero-image"
  />
</div>
      </section>

      <section class="trust-strip" [attr.aria-label]="i18n.language() === 'ta' ? 'சமூக நன்மைகள்' : 'Community benefits'">
        <div class="trust-item"><span class="trust-icon" aria-hidden="true">⌖</span><span><strong>{{ i18n.language() === 'ta' ? 'உள்ளூர் சேவைகள்' : 'Local services' }}</strong><small>{{ i18n.language() === 'ta' ? 'நம் ஊரின் சேவைகளை ஒரே இடத்தில்' : 'Discover services in your town' }}</small></span></div>
        <div class="trust-item"><span class="trust-icon gold" aria-hidden="true">✓</span><span><strong>{{ i18n.language() === 'ta' ? 'தகவல்களை எளிதாகக் கண்டறியுங்கள்' : 'Information made simple' }}</strong><small>{{ i18n.language() === 'ta' ? 'தேவையான தகவல்களை விரைவாகப் பெறுங்கள்' : 'Find useful information with ease' }}</small></span></div>
        <div class="trust-item"><span class="trust-icon" aria-hidden="true">♧</span><span><strong>{{ i18n.language() === 'ta' ? 'சமூக இணைப்பு' : 'Community connection' }}</strong><small>{{ i18n.language() === 'ta' ? 'நம் மக்களை இணைக்கும் ஒரு தளம்' : 'A platform that brings people together' }}</small></span></div>
      </section>

      <section class="community-banner" id="community"><div class="banner-icon" aria-hidden="true">＋</div><div class="banner-copy"><h2>{{ i18n.language() === 'ta' ? 'உங்கள் சேவையையும் இங்கே இணைக்கலாம்' : 'Bring your service to the community' }}</h2><p>{{ i18n.language() === 'ta' ? 'நம் சிதம்பரம் சமூகத்துடன் உங்கள் சேவையைப் பகிர்ந்து, அதிக மக்களைச் சென்றடையுங்கள்.' : 'Share your service with the Nam Chidambaram community and reach more local people.' }}</p></div><a routerLink="/services">{{ i18n.language() === 'ta' ? 'சேவைகளைப் பார்க்க' : 'Explore services' }} <span aria-hidden="true">→</span></a></section>
  `,
  styleUrl: './home.component.scss',
})
export class LandingComponent {
  protected readonly i18n = inject(LanguageService);
  private readonly router = inject(Router);
  protected search(event: Event, term: string): void {
    event.preventDefault();
    void this.router.navigate([term.trim() ? '/service-search' : '/services'], { queryParams: term.trim() ? { q: term.trim() } : {} });
  }
}
