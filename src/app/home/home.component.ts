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
    <div class="nc-home">
      <section class="nc-hero" aria-labelledby="home-title">
        <div class="nc-hero-photo" role="img" aria-label="Chidambaram temple street"></div>
        <div class="nc-hero-copy">
          <p class="nc-kicker">{{ i18n.language() === 'ta' ? 'நம் ஊருக்கு வரவேற்கிறோம்' : 'WELCOME TO' }}</p>
          <h1 id="home-title"><span lang="ta">நம் சிதம்பரம்</span><br><span>Nam Chidambaram</span></h1>
          <p>{{ i18n.language() === 'ta' ? 'உள்ளூர் சேவைகள், வணிகங்கள், நிகழ்வுகள் மற்றும் சமூகத் தகவல்களை ஒரே இடத்தில் கண்டறியுங்கள்.' : 'Discover local services, businesses, events and community updates in Chidambaram.' }}</p>
          <a class="nc-button" routerLink="/services">{{ i18n.language() === 'ta' ? 'இப்போதே பாருங்கள்' : 'Explore Now' }} <i class="bi bi-arrow-right"></i></a>
        </div>
      </section>

      <section class="nc-intro" id="about">
        <div class="nc-photo nc-family-photo" role="img" aria-label="Chidambaram community"></div>
        <div class="nc-intro-card"><p class="nc-kicker">{{ i18n.language() === 'ta' ? 'நம் சமூகம்' : 'OUR COMMUNITY' }}</p><h2>{{ i18n.language() === 'ta' ? 'மக்கள். சேவைகள். வலுவான சிதம்பரம்.' : 'People. Services. A Stronger Chidambaram.' }}</h2><p>{{ i18n.language() === 'ta' ? 'உள்ளூர் சேவைகள், வணிகங்கள் மற்றும் நிகழ்வுகளை ஒரே இடத்தில் இணைக்கிறோம்.' : 'Nam Chidambaram brings together local services, businesses, events and useful information to make everyday life easier.' }}</p><a class="nc-button nc-button-light" routerLink="/services">{{ i18n.language() === 'ta' ? 'மேலும் அறிய' : 'Learn More' }} <i class="bi bi-arrow-right"></i></a></div>
        <div class="nc-benefits">
          <article><span><i class="bi bi-people-fill"></i></span><div><h3>{{ i18n.language() === 'ta' ? 'உள்ளூரை ஆதரியுங்கள்' : 'Support Local' }}</h3><p>{{ i18n.language() === 'ta' ? 'உள்ளூர் வணிகங்கள் மற்றும் சேவை வழங்குநர்களைக் கண்டறியுங்கள்.' : 'Discover and support local businesses and service providers.' }}</p></div></article>
          <article><span><i class="bi bi-newspaper"></i></span><div><h3>{{ i18n.language() === 'ta' ? 'தகவலுடன் இருங்கள்' : 'Stay Updated' }}</h3><p>{{ i18n.language() === 'ta' ? 'சமூகச் செய்திகள் மற்றும் நிகழ்வுகளை அறியுங்கள்.' : 'Get the latest community news, events and important announcements.' }}</p></div></article>
          <article><span><i class="bi bi-heart-fill"></i></span><div><h3>{{ i18n.language() === 'ta' ? 'வலுவான சமூகம்' : 'A Stronger Community' }}</h3><p>{{ i18n.language() === 'ta' ? 'நம் மக்கள், இடங்கள், பண்பாட்டுடன் இணைந்திருங்கள்.' : 'Stay connected with the people, places and culture of Chidambaram.' }}</p></div></article>
        </div>
      </section>

      <section class="nc-services-band">
        <div class="nc-services-copy"><h2>{{ i18n.language() === 'ta' ? 'சிதம்பரத்திற்கான உள்ளூர் சேவைகள்' : 'Local Services for a Better Chidambaram' }}</h2><p>{{ i18n.language() === 'ta' ? 'உங்கள் அன்றாடத் தேவைகளுக்கு நம்பகமான உள்ளூர் நிபுணர்களை ஒரே இடத்தில் கண்டறியுங்கள்.' : 'From trusted professionals to everyday needs, find everything you need in one place.' }}</p><a class="nc-button" routerLink="/services">{{ i18n.language() === 'ta' ? 'சேவைகளைப் பாருங்கள்' : 'Browse Services' }} <i class="bi bi-arrow-right"></i></a></div>
        <div class="nc-photo nc-business-photo" role="img" aria-label="Local business owner"></div>
        <div class="nc-business-card"><i class="bi bi-handshake"></i><h3>{{ i18n.language() === 'ta' ? 'உள்ளூர் வணிகங்களுக்கு ஆதரவு' : 'WE SUPPORT LOCAL BUSINESSES' }}</h3><p>{{ i18n.language() === 'ta' ? 'உங்கள் வணிகத்தைப் பதிவு செய்து சிதம்பரம் மக்களைச் சென்றடையுங்கள்.' : 'Be part of a growing community that values local talent and trusted businesses.' }}</p><a class="nc-button nc-button-light" routerLink="/services/submit">{{ i18n.language() === 'ta' ? 'வணிகத்தைப் பட்டியலிடுங்கள்' : 'List Your Business' }} <i class="bi bi-arrow-right"></i></a></div>
      </section>

      <section class="nc-categories" id="categories">
        <div class="nc-categories-heading">
          @if (i18n.language() === 'ta') {
            <p class="nc-kicker">வகைகளின்படி தேடுங்கள்</p>
            <h2>உங்களுக்குத் தேவையானதைத் தேடுங்கள்</h2>
            <p>சேவைகள், வணிகங்கள், நிகழ்வுகள் — ஒரே இடத்தில்.</p>
          } @else {
            <p class="nc-kicker">BROWSE BY CATEGORY</p>
            <h2>Explore What You Need</h2>
            <p>Find trusted local services, businesses, events and more — all in one place.</p>
          }
        </div>
        @if (categoryService.loading()) {
          <p class="nc-state">
            @if (i18n.language() === 'ta') {
              வகைகள் ஏற்றப்படுகின்றன…
            } @else {
              Loading categories…
            }
          </p>
        } @else if (categoryService.error()) {
          <p class="nc-state">
            @if (i18n.language() === 'ta') {
              வகைகளை ஏற்ற முடியவில்லை.
            } @else {
              Categories could not be loaded.
            }
            <button type="button" (click)="loadCategories()">
              @if (i18n.language() === 'ta') {
                மீண்டும் முயற்சி
              } @else {
                Try again
              }
            </button>
          </p>
        } @else if (categoryService.categories().length) {
          <div class="nc-category-grid">
            @for (category of categoryService.categories().slice(0, 8); track category.id) {
              <app-category-card [category]="category" />
            }
          </div>
        } @else {
          <div class="nc-category-grid">
            @for (item of categoryPlaceholders.slice(0, 8); track item.label) {
              <a class="nc-category-tile" routerLink="/services">
                <span class="nc-category-icon">
                  <i class="bi" [class]="'bi ' + item.icon"></i>
                </span>
                <strong>
                  @if (i18n.language() === 'ta') {
                    {{ item.ta }}
                  } @else {
                    {{ item.label }}
                  }
                </strong>
                <small>
                  @if (i18n.language() === 'ta') {
                    மேலும் அறிய
                  } @else {
                    Explore
                  }
                  →
                </small>
              </a>
            }
          </div>
        }
      </section>

      <section class="nc-heritage">
        <div class="nc-photo nc-temple-photo" role="img" aria-label="Chidambaram Nataraja Temple"></div>
        <div><p class="nc-kicker">{{ i18n.language() === 'ta' ? 'நம் ஊர். நம் பெருமை.' : 'OUR TOWN. OUR PRIDE.' }}</p><h2>{{ i18n.language() === 'ta' ? 'செழுமையான பாரம்பரியமும் ஒளிமயமான எதிர்காலமும்' : 'A Town with a Rich Heritage and a Bright Future' }}</h2><p>{{ i18n.language() === 'ta' ? 'சிதம்பரம் ஒரு நகரம் மட்டுமல்ல — பண்பாடு, வணிகம் மற்றும் சமூக உணர்வு நிறைந்த இடம்.' : 'Chidambaram is more than a town — it’s a vibrant community with a rich cultural heritage, active businesses and a warm, welcoming people.' }}</p><a class="nc-button" routerLink="/services">{{ i18n.language() === 'ta' ? 'சிதம்பரத்தை அறிய' : 'Learn About Chidambaram' }} <i class="bi bi-arrow-right"></i></a></div>
      </section>

      <section class="nc-trust" id="community"><div class="nc-trust-card"><p class="nc-kicker">{{ i18n.language() === 'ta' ? 'நம் சமூகத்தின் நம்பிக்கை' : 'TRUSTED BY OUR COMMUNITY' }}</p><h2>{{ i18n.language() === 'ta' ? 'இன்றிலிருந்து ஒன்றாக வளர்வோம்' : 'Growing Together Since Today' }}</h2><p>{{ i18n.language() === 'ta' ? 'உள்ளூர் திறமைகளை ஆதரிக்கும், நம் பண்பாட்டைக் கொண்டாடும் சமூகத்தில் இணையுங்கள்.' : 'Our platform is built by and for the people of Chidambaram. Join a community that supports local talent, celebrates our culture and creates new opportunities.' }}</p><a class="nc-button" routerLink="/services/submit">{{ i18n.language() === 'ta' ? 'சமூகத்தில் இணையுங்கள்' : 'Join Our Community' }} <i class="bi bi-arrow-right"></i></a></div><div class="nc-photo nc-people-photo" role="img" aria-label="People in Chidambaram"></div><div class="nc-stats"><div><i class="bi bi-people"></i><strong>Local</strong><small>{{ i18n.language() === 'ta' ? 'சமூக உறுப்பினர்கள்' : 'Community Members' }}</small></div><div><i class="bi bi-shop"></i><strong>Local</strong><small>{{ i18n.language() === 'ta' ? 'உள்ளூர் வணிகங்கள்' : 'Local Businesses' }}</small></div><div><i class="bi bi-calendar-event"></i><strong>Events</strong><small>{{ i18n.language() === 'ta' ? 'சமூக நிகழ்வுகள்' : 'Community Events' }}</small></div><div><i class="bi bi-heart"></i><strong>{{ i18n.language() === 'ta' ? 'ஒன்றாக' : 'Together' }}</strong><small>{{ i18n.language() === 'ta' ? 'வலுவான சிதம்பரம்' : 'A Stronger Chidambaram' }}</small></div></div></section>

      <section class="nc-testimonial"><div class="nc-photo nc-testimonial-photo" role="img" aria-label="Chidambaram resident"></div><blockquote><i class="bi bi-quote"></i><p>{{ i18n.language() === 'ta' ? 'நம் சிதம்பரம் உள்ளூர் சேவைகளைக் கண்டறியவும், நம் ஊருடன் இணைந்திருக்கவும் உதவுகிறது.' : 'Nam Chidambaram makes it easy to find trusted local services, discover new businesses, know about upcoming events and stay connected with my town.' }}</p><cite>— {{ i18n.language() === 'ta' ? 'சிதம்பரம் குடியிருப்பாளர்' : 'A Chidambaram Resident' }}</cite></blockquote></section>

      <section class="nc-contact" id="contact"><div class="nc-contact-form"><p class="nc-kicker">{{ i18n.language() === 'ta' ? 'தொடர்பு கொள்ளுங்கள்' : 'GET IN TOUCH' }}</p><h2>{{ i18n.language() === 'ta' ? 'எங்களைத் தொடர்பு கொள்ளுங்கள்' : 'Contact Us' }}</h2><form (submit)="$event.preventDefault()"><label>{{ i18n.language() === 'ta' ? 'பெயர்' : 'Name' }}<input type="text" [placeholder]="i18n.language() === 'ta' ? 'உங்கள் பெயர்' : 'Enter your name'"></label><label>{{ i18n.language() === 'ta' ? 'மின்னஞ்சல்' : 'Email Address' }}<input type="email" placeholder="Enter a valid email address"></label><label>{{ i18n.language() === 'ta' ? 'செய்தி' : 'Message' }}<textarea rows="3" placeholder="How can we help?"></textarea></label><button type="submit" class="nc-button">{{ i18n.language() === 'ta' ? 'செய்தி அனுப்புங்கள்' : 'Send Message' }} <i class="bi bi-arrow-right"></i></button></form></div><div class="nc-contact-info"><h3>{{ i18n.language() === 'ta' ? 'தொடர்பு விவரங்கள்' : 'CONTACT INFORMATION' }}</h3><p><i class="bi bi-geo-alt"></i> Chidambaram, Cuddalore District<br>Tamil Nadu, India</p><p><i class="bi bi-envelope"></i> support@namchidambaram.org</p><h3>{{ i18n.language() === 'ta' ? 'எங்களைப் பின்தொடருங்கள்' : 'FOLLOW US' }}</h3><div class="nc-social"><span>f</span><span>▶</span><span>◎</span><span>◉</span></div></div></section>
    </div>
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

  protected readonly categoryPlaceholders = [
    { label: 'Home Services', ta: 'வீட்டுச் சேவைகள்', icon: 'bi-house-heart', tone: 'tone-green' },
    { label: 'Education', ta: 'கல்வி', icon: 'bi-mortarboard', tone: 'tone-purple' },
    { label: 'Healthcare', ta: 'மருத்துவம்', icon: 'bi-heart-pulse', tone: 'tone-rose' },
    { label: 'Construction', ta: 'கட்டுமானம்', icon: 'bi-houses', tone: 'tone-orange' },
    { label: 'Professional', ta: 'தொழில்முறை சேவைகள்', icon: 'bi-people', tone: 'tone-blue' },
    { label: 'Shops & Retail', ta: 'கடைகள்', icon: 'bi-shop', tone: 'tone-pink' },
    { label: 'Food & Dining', ta: 'உணவு', icon: 'bi-cup-hot', tone: 'tone-orange' },
    { label: 'Transport', ta: 'போக்குவரத்து', icon: 'bi-car-front', tone: 'tone-blue' },
    { label: 'Events', ta: 'நிகழ்வுகள்', icon: 'bi-calendar-event', tone: 'tone-purple' },
    { label: 'More Services', ta: 'மேலும் சேவைகள்', icon: 'bi-three-dots', tone: 'tone-green' },
  ] as const;
  protected readonly communityEvents = [
    { day: '05', month: 'OCT', title: 'Chidambaram Temple Festival', titleTa: 'சிதம்பரம் கோவில் திருவிழா', place: 'Chidambaram Nataraja Temple', placeTa: 'சிதம்பரம் நடராஜர் கோவில்', icon: 'bi-stars', tone: 'event-gold' },
    { day: '12', month: 'OCT', title: 'Community Food Distribution', titleTa: 'சமூக அன்னதானம்', place: 'East Car Street', placeTa: 'கிழக்கு ரத வீதி', icon: 'bi-people', tone: 'event-green' },
    { day: '20', month: 'OCT', title: 'Tree Plantation Drive', titleTa: 'மரக்கன்று நடும் நிகழ்வு', place: 'Chidambaram', placeTa: 'சிதம்பரம்', icon: 'bi-flower1', tone: 'event-leaf' },
    { day: '28', month: 'OCT', title: 'Local Business Meet', titleTa: 'உள்ளூர் வணிகர் சந்திப்பு', place: 'Community Hall', placeTa: 'சமூகக் கூடம்', icon: 'bi-shop', tone: 'event-blue' },
  ] as const;
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

  protected listingIcon(index: number): string {
    return ['bi-house-gear', 'bi-building', 'bi-heart-pulse', 'bi-tools', 'bi-cup-hot', 'bi-flower1'][index % 6];
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
