import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ServiceCategory } from '../core/models/service-category';
import { DirectoryLocation, ServiceListing, locationSearchOptions } from '../core/models/service-listing';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { ListingSummaryComponent } from '../services/listing-summary/listing-summary.component';
import { HubHomepageAdditionsComponent } from './hub-homepage-additions.component';
import { SeoService } from '../core/services/seo.service';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const CATEGORY_ICON_STYLES: Readonly<Record<string, { icon: string; color: string; background: string }>> = {
  'home-services': { icon: 'bi-house-gear', color: '#087f6c', background: '#e4f5ef' },
  'marriage-services': { icon: 'bi-hearts', color: '#c4519a', background: '#fbeaf4' },
  'house-construction-services': { icon: 'bi-buildings', color: '#d97732', background: '#fff0e5' },
  'medical-emergency-services': { icon: 'bi-heart-pulse', color: '#dc4557', background: '#fdecef' },
  'educational-services': { icon: 'bi-mortarboard', color: '#6657c8', background: '#eeebfc' },
  'government-exams-study-materials': { icon: 'bi-journal-bookmark', color: '#2563c4', background: '#e8f0fd' },
  'food-restaurant-services': { icon: 'bi-cup-hot', color: '#a76b08', background: '#fff4db' },
  'labour-manpower-services': { icon: 'bi-person-workspace', color: '#177e91', background: '#e5f4f8' },
};
const FALLBACK_CATEGORY_ICON = { icon: 'bi-grid', color: '#0755b8', background: '#eaf2f8' } as const;
const CATEGORY_IMAGE_MAP: Readonly<Record<string, string>> = {
  'ac-refrigeration': 'ac-repair.jpg',
  'ro-water-purifier': 'water-purifier.jpg',
  carpenter: 'carpenter.jpg',
  '60th-wedding-anniversary': '60th-wedding.jpg',
  'marriage-halls': 'marriage-hall.jpg',
  'matrimony-services': 'matrimony.jpg',
  'wedding-catering': 'wedding-catering.jpg',
  'building-contractors': 'building-contractor.jpg',
  'civil-engineers': 'civil-engineer.jpg',
  architects: 'architect.jpg',
  hospitals: 'hospital.jpg',
  clinics: 'clinic.jpg',
  'ambulance-services': 'ambulance.jpg',
};

interface HubSlide { readonly image: string; readonly alt: string; readonly eyebrow: string; readonly title: string; readonly link: string; }

@Component({
  selector: 'app-community-hub',
  imports: [NgOptimizedImage, RouterLink, ListingSummaryComponent, HubHomepageAdditionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="hub" aria-labelledby="hub-title">
      <section class="hero" aria-describedby="hub-description">
        <div class="hero__inner">
          <div class="hero__copy">
            <h1 id="hub-title" class="hub-hero-title"><span>One Place for</span> <span class="hub-hero-title__accent">All Your Local Needs.</span></h1>
            <p id="hub-description">Discover local services, businesses and everyday help in Chidambaram.</p>
            <div class="hub-hero__location"><label class="hub-hero__location-label" for="hub-location"><i class="bi bi-geo-alt" aria-hidden="true"></i>Searching around</label><div class="hub-hero__location-field"><select class="form-select" id="hub-location" [value]="locationId()" (change)="locationId.set(locationSelect.value)" #locationSelect><option value="">All Chidambaram</option>@for (location of locationOptions(); track location.value) { <option [value]="location.value">{{ location.label }}</option> }</select></div></div>
            <form class="hub-search" (submit)="search($event)" novalidate>
              <label class="visually-hidden" for="hub-query">Search local services</label>
              <i class="bi bi-search" aria-hidden="true"></i>
               <input id="hub-query" type="search" [value]="query()" (input)="query.set(queryInput.value)" #queryInput autocomplete="off" [placeholder]="i18n.language() === 'ta' ? 'சேவைகள், கடைகள், ஹோட்டல்கள்…' : 'Search services, shops, hotels...'" />
              <button type="button" class="voice-button" [class.listening]="voiceState() === 'listening'" [attr.aria-pressed]="voiceState() === 'listening'" [attr.aria-label]="voiceLabel()" (click)="toggleVoice()"><i class="bi bi-mic-fill" aria-hidden="true"></i></button>
              <button type="submit" class="search-button"><span>{{ i18n.language() === 'ta' ? 'தேடுக' : 'Find Local Services' }}</span><i class="bi bi-arrow-up-right" aria-hidden="true"></i></button>
              <a class="hub-ai-search" routerLink="/service-search" [queryParams]="{ q: query().trim() || null, location: locationId() || null }">
                <span class="hub-ai-search__icon"><i class="bi bi-stars" aria-hidden="true"></i></span>
                <span class="hub-ai-search__copy"><strong>{{ i18n.language() === 'ta' ? 'AI தமிழ் / ஆங்கில தேடலை முயற்சிக்கவும்' : 'Try AI Tamil / English Search' }}</strong><small>{{ i18n.language() === 'ta' ? 'உங்கள் தேவையை இயல்பாகச் சொல்லுங்கள்' : 'Describe what you need in your own words' }}</small></span>
                <i class="bi bi-arrow-up-right" aria-hidden="true"></i>
              </a>
            </form>
            <div class="hub-hero-service-cta">
              <a class="hub-hero-service-cta__button" routerLink="/services/submit"><i class="bi bi-plus-circle" aria-hidden="true"></i>Add Your Service</a>
              <p>Login required to add your service.</p>
              <p>Need assistance? <a href="tel:+919514636355">Call 9514636355</a> or <a href="https://wa.me/919514636355" target="_blank" rel="noopener noreferrer">WhatsApp 9514636355</a></p>
            </div>
            @if (searchMessage()) { <p class="message" role="alert">{{ searchMessage() }}</p> } @if (voiceMessage()) { <p class="message" role="status">{{ voiceMessage() }}</p> }
          </div>
          <div class="hero__visual" aria-hidden="true"><div class="hero-frame hero-frame--back"></div><div class="hero-frame hero-frame--main"><img ngSrc="/assets/images/Home%20Services%20Professionals%20Banner.webp" width="2172" height="724" priority alt="" /></div><span class="hero-note">LOCAL, BY DESIGN <i class="bi bi-arrow-up-right"></i></span></div>
        </div>
      </section>

      <div class="hub-shell">
        @if (slides.length) {
        <section class="promo" aria-labelledby="promo-title" aria-roledescription="carousel" (mouseenter)="pauseCarousel()" (mouseleave)="resumeCarousel()" (focusin)="pauseCarousel()" (touchstart)="startSwipe($event)" (touchend)="endSwipe($event)" (keydown.arrowleft)="previousSlide(); $event.preventDefault()" (keydown.arrowright)="nextSlide(); $event.preventDefault()">
          <h2 id="promo-title" class="visually-hidden">Local highlights</h2>
          <a class="promo-image" [routerLink]="currentSlide().link" [attr.aria-label]="currentSlide().title"><img [ngSrc]="currentSlide().image" width="1200" height="500" [alt]="currentSlide().alt" (load)="bannerFailed.set(false)" (error)="bannerFailed.set(true)" />@if (bannerFailed()) { <span class="banner-error" role="status">Image unavailable · {{ currentSlide().title }}</span> }</a>
          @if (slides.length > 1) {
          <button type="button" class="btn carousel-control carousel-control--prev" aria-label="Previous highlight" (click)="previousSlide()"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><button type="button" class="btn carousel-control carousel-control--next" aria-label="Next highlight" (click)="nextSlide()"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
          <div class="hub-banner-pagination" role="group" aria-label="Banner navigation">@for (slide of slides; track slide.image; let index = $index) { <button type="button" class="hub-banner-pagination__button" [attr.aria-current]="slideIndex() === index ? 'true' : null" [attr.aria-label]="'Go to banner ' + (index + 1) + ' of ' + slides.length" [class.is-active]="slideIndex() === index" (click)="showSlide(index)"><span class="hub-banner-pagination__dot" aria-hidden="true"></span></button> }</div>
          }
        </section>
        @if (slides.length > 1) { <div class="hub-autoplay-controls"><button type="button" class="btn" [attr.aria-pressed]="carouselPaused()" (click)="toggleCarousel()">{{ carouselPaused() ? 'Play slideshow' : 'Pause slideshow' }}</button></div> }
        }

        <app-hub-homepage-additions section="quick" />
        <section class="section categories-section" aria-labelledby="categories-title">
          <div class="section-heading"><div><p class="eyebrow">DISCOVER YOUR TOWN</p><h2 id="categories-title">Explore Categories</h2></div><a routerLink="/services">View all <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a></div>
          @if (categoriesLoading()) { <p class="state" role="status">Loading categories…</p> } @else if (categoriesError()) { <p class="state" role="alert">Categories are unavailable right now.</p> } @else { <div class="category-grid">@for (category of popularCategories(); track category.id) { @let appearance = categoryIcon(category); <a class="category-card" [routerLink]="['/services/category', category.slug]"><span class="category-icon" [style.--icon-color]="appearance.color" [style.--icon-bg]="appearance.background"><i [class]="'bi ' + appearance.icon" aria-hidden="true"></i></span><span>{{ i18n.language() === 'ta' ? category.nameTamil : category.nameEnglish }}</span></a> }</div> }
        </section>

        <section class="section collections-section" aria-labelledby="collections-title"><div class="section-heading"><div><p class="eyebrow">CURATED FOR EVERYDAY LIFE</p><h2 id="collections-title">Explore by Service</h2></div></div><div class="collection-grid">@for (collection of collections(); track collection.id; let index = $index) { <article class="collection-card"><div class="collection-heading"><div><h3>{{ i18n.language() === 'ta' ? collection.nameTamil : collection.nameEnglish }}</h3><p>{{ collection.description }}</p></div><span class="collection-number">0{{ index + 1 }}</span></div><div class="collection-tiles">@for (item of collection.items; track item.id) { <a [routerLink]="categoryLink(item, collection.parent)" class="collection-tile"><div class="collection-image">@if (collectionImage(index, item); as image) { <img [ngSrc]="image" width="240" height="145" [alt]="item.nameEnglish" loading="lazy" /> } @else { <i class="bi bi-grid" aria-hidden="true"></i> }</div><span>{{ i18n.language() === 'ta' ? item.nameTamil : item.nameEnglish }}</span></a> }</div></article> }</div></section>

        <section class="steps-section" aria-labelledby="steps-title"><div class="section-heading centered"><div><p class="eyebrow">A SIMPLE LOCAL JOURNEY</p><h2 id="steps-title">How CDM 360 Works</h2></div></div>
          <ol class="hub-how-steps">
            <li class="hub-how-step"><span class="hub-how-icon"><i class="bi bi-search" aria-hidden="true"></i></span><div class="hub-how-content"><span class="hub-how-number">01</span><h3>Search</h3><p>Find the local service you need.</p></div></li>
            <li class="hub-how-step"><span class="hub-how-icon"><i class="bi bi-list-check" aria-hidden="true"></i></span><div class="hub-how-content"><span class="hub-how-number">02</span><h3>Choose</h3><p>Explore local providers and choose the right one.</p></div></li>
            <li class="hub-how-step"><span class="hub-how-icon"><i class="bi bi-telephone" aria-hidden="true"></i></span><div class="hub-how-content"><span class="hub-how-number">03</span><h3>Connect</h3><p>Contact the service provider directly.</p></div></li>
          </ol>
        </section>

        <section class="section providers-section" aria-labelledby="providers-title"><div class="section-heading"><div><p class="eyebrow">REAL PEOPLE, LOCAL EXPERTISE</p><h2 id="providers-title">Meet Local Providers</h2><p class="section-intro">Discover published services from people and businesses in Chidambaram.</p></div><a routerLink="/services">Browse all <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a></div>@if (providersLoading()) { <p class="state" role="status">Loading local providers…</p> } @else if (providersError()) { <p class="state" role="alert">Providers are unavailable right now.</p> } @else if (providers().length) { <div class="provider-grid">@for (listing of providers(); track listing.id) { <app-listing-summary [listing]="listing" [compact]="true" [horizontal]="true" /> }</div> } @else { <p class="state">No published providers are available yet.</p> }</section>

        <section class="business-cta" aria-labelledby="business-title"><div><p class="eyebrow">FOR LOCAL BUSINESS OWNERS</p><h2 id="business-title">Your Business Belongs Here.</h2><p>Help people across Chidambaram discover your services.</p></div><a routerLink="/services/submit" class="cta-button">Add Your Service <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a></section>
        <app-hub-homepage-additions />
      </div>
    </main>
  `,
  styles: `
    .hub .hero .hub-search { flex-wrap:wrap; }
    .hub-ai-search { display:flex; align-items:center; gap:12px; flex:0 0 100%; min-width:0; min-height:60px; box-sizing:border-box; padding:10px; border-top:1px solid #e1e8f0; border-radius:0 0 10px 10px; background:#fff; color:#002050; text-decoration:none; }
    .hub-ai-search__icon { display:grid; place-items:center; flex:0 0 36px; width:36px; height:36px; border-radius:10px; background:#fff1d8; color:#875400; font-size:18px; }
    .hub-ai-search__copy { display:grid; gap:3px; flex:1; min-width:0; overflow-wrap:anywhere; }
    .hub-ai-search strong { font-size:14px; line-height:1.4; font-weight:750; }
    .hub-ai-search small { color:#52637a; font-size:12px; line-height:1.5; }
    .hub-ai-search > i { flex:none; color:#0755b8; }
    .hub-ai-search:hover { background:#f3f6fa; color:#002050; }
    .hub-ai-search:focus-visible { outline:3px solid #0755b8; outline-offset:-3px; }
    .hub-how-steps { display:grid; grid-template-columns:minmax(0,1fr); gap:16px; list-style:none; margin:0; padding:0; }
    .hub-how-step { display:flex; align-items:flex-start; gap:16px; min-width:0; padding:16px; border:1px solid #e0e6ee; border-radius:16px; background:#fff; }
    .hub-how-icon { display:flex; align-items:center; justify-content:center; flex:0 0 52px; width:52px; height:52px; border-radius:50%; background:#e5f5ef; color:#087f6c; font-size:24px; }
    .hub-how-content { min-width:0; }
    .hub-how-number { display:block; color:#a64d1b; font-size:12px; font-weight:750; line-height:1.5; margin-bottom:4px; }
    .hub-how-content h3 { position:static; transform:none; margin:0 0 6px; color:#002050; font-size:18px; font-weight:750; line-height:1.35; overflow-wrap:break-word; }
    .hub-how-content p { position:static; transform:none; margin:0; color:#52637a; font-size:15px; line-height:1.6; overflow-wrap:break-word; }
    @media(min-width:768px) { .hub-how-steps { grid-template-columns:repeat(3,minmax(0,1fr)); } .hub-how-step { flex-direction:column; padding:24px; } }
    .hub-hero-service-cta { margin-top:16px; min-width:0; }
    .hub-hero-service-cta__button { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:48px; box-sizing:border-box; padding:12px 20px; border:1px solid #dce5ef; border-radius:12px; background:#fff; color:#002050; font-weight:700; text-decoration:none; transition:background-color 180ms ease,border-color 180ms ease; }
    .hub-hero-service-cta__button:hover { background:#eef4fb; border-color:#b8d4f5; color:#002050; }
    .hub-hero-service-cta p { margin:6px 0 0; color:#d8e3f0; font-size:13px; line-height:1.5; overflow-wrap:anywhere; }
    .hub-hero-service-cta p a { color:#fff; text-underline-offset:3px; display:inline-block; padding-block:4px; }
    .hub-hero-service-cta a:focus-visible { outline:3px solid #e9b965; outline-offset:3px; }
    @media(max-width:767px) { .hub-hero-service-cta__button { width:100%; } }
    @media(prefers-reduced-motion:reduce) { .hub-hero-service-cta__button { transition:none; } }
    .hub .category-card .category-icon { display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; flex:0 0 48px; border-radius:14px; background:var(--icon-bg,#eaf2f8); color:var(--icon-color,#0755b8); }
    .hub .category-card .category-icon .bi { display:inline-block; font-size:25px; line-height:1; color:inherit; }
    .hub .category-card .category-icon .bi::before { display:inline-block; line-height:1; }
    .hub-autoplay-controls { display:flex; justify-content:flex-end; margin-top:-2rem; margin-bottom:1rem; }
    .hub-autoplay-controls .btn { min-height:44px; padding:8px; color:#0755b8; background:transparent; font-size:12px; }
    .hub .hero .hero__inner { min-height:0; }
    .hub-hero__location { display:flex; flex-direction:column; align-items:stretch; gap:8px; width:100%; min-width:0; margin-top:14px; padding:0; border:0; background:transparent; }
    .hub-hero__location-label { display:flex; align-items:center; gap:8px; margin:0; color:#d8e3f0; font-size:14px; font-weight:500; line-height:1.4; }
    .hub-hero__location-label i { color:#b8d4f5; }
    .hub-hero__location-field { width:100%; min-width:0; }
    .hub-hero__location-field .form-select { display:block; width:100%; min-width:0; max-width:100%; min-height:48px; padding:10px 32px 10px 12px; border:1px solid #dce5ef; border-radius:12px; background-color:#fff; color:#002050; font-size:15px; font-weight:500; box-sizing:border-box; }
    .hub-hero__location-field .form-select:focus-visible { outline:3px solid #e9b965; outline-offset:3px; }
    @media(min-width:768px) { .hub-hero__location { flex-direction:row; align-items:center; gap:16px; } .hub-hero__location-field { flex:1; max-width:300px; } }
    @media(max-width:700px) { .hub .hero .hero__inner { padding-bottom:24px; } }
    .hub .hero .hub-hero-title { font-size:clamp(48px,4vw,56px); line-height:1.12; letter-spacing:-.035em; overflow-wrap:normal; }
    .hub .hero .hub-hero-title > span { display:block; color:#fff; }
    .hub .hero .hub-hero-title > .hub-hero-title__accent { color:#e9b965; }
    .hub .hero .hub-search { border:1px solid #dfe6ef; background:#fff; }
    .hub .hero .hub-search .search-button { background:#0da68c; border-color:#0da68c; color:#071b3b; }
    .hub .hero .hub-search .search-button:hover { background:#12b99d; border-color:#12b99d; }
    @media(max-width:700px) {
      .hub .hero .hub-hero-title { font-size:clamp(30px,8vw,36px); line-height:1.15; }
      .hub .hero .hub-search { width:100%; box-sizing:border-box; }
      .hub .hero .hub-search input { flex:1 1 0; min-width:0; width:0; }
    }
    :host{display:block;min-width:0;background:#faf8f4;color:#071b3b}.hub{min-width:0;overflow:hidden}.hero{background:#071b3b;color:#fff}.hero__inner{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px, .9fr);gap:4rem;align-items:center;width:min(1240px,calc(100% - 2rem));min-height:560px;margin:auto;padding:clamp(3rem,7vw,6rem) 0}.hero__copy{min-width:0}.eyebrow{margin:0 0 .7rem;color:#e9b965;font-size:.72rem;font-weight:800;letter-spacing:.13em}.hero h1{margin:0;color:#fff;font-size:clamp(2.3rem,5.2vw,4.6rem);line-height:1.02;letter-spacing:-.055em}.hero h1 em{color:#e9b965;font-style:normal}.hero__copy>p:not(.eyebrow):not(.hero-tamil){max-width:520px;margin:1.25rem 0 .5rem;color:#c5d1e2;font-size:1.1rem;line-height:1.65}.hero-tamil{color:#9db3cd;font-size:.9rem;letter-spacing:.04em}.hub-search{display:flex;align-items:center;gap:.65rem;max-width:680px;margin-top:1.7rem;padding:.4rem .45rem .4rem 1rem;border:1px solid #496280;border-radius:14px;background:#fff;box-shadow:0 12px 30px #0003}.hub-search>i{color:#0755b8}.hub-search input{min-width:0;flex:1;border:0;outline:0;color:#071b3b;background:transparent;font:inherit}.hub-search input::placeholder{color:#75859b}.voice-button{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border:0;border-radius:9px;background:#eef4fb;color:#0755b8;cursor:pointer}.voice-button.listening{background:#0da68c;color:#fff}.search-button,.cta-button{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;min-height:46px;padding:.7rem 1rem;border:0;border-radius:10px;background:#e3864f;color:#fff;font:inherit;font-weight:800;text-decoration:none;white-space:nowrap;cursor:pointer}.search-button:hover,.cta-button:hover{background:#f0a274;color:#fff}.location-row{display:flex;align-items:center;gap:.45rem;margin-top:.7rem;color:#9db3cd;font-size:.82rem}.location-row select{max-width:220px;border:0;color:#fff;background:transparent;font:inherit;font-weight:700}.location-row option{color:#071b3b}.message{margin:.7rem 0 0;color:#f0a274;font-size:.85rem}.hero__visual{position:relative;min-height:370px}.hero-frame{position:absolute;border-radius:24px}.hero-frame--back{inset:2rem 0 0 3rem;border:1px solid #e9b965;background:#0d2a50}.hero-frame--main{inset:0 2rem 2rem 0;overflow:hidden;background:#c7d5e5;box-shadow:0 24px 50px #0005;transform:rotate(2deg)}.hero-frame--main img{width:100%;height:100%;object-fit:cover}.hero-note{position:absolute;right:0;bottom:0;padding:.65rem .8rem;border-radius:9px;background:#e9b965;color:#071b3b;font-size:.68rem;font-weight:900;letter-spacing:.08em}.hero-note i{margin-left:.3rem}.hub-shell{width:min(1240px,calc(100% - 2rem));margin:auto}.promo{position:relative;min-width:0;margin:2.3rem 0 4rem}.promo-image{position:relative;min-height:225px;overflow:hidden;border-radius:20px;background:#0d2a50}.promo-image img{display:block;width:100%;height:270px;object-fit:cover}.promo-image:after{position:absolute;inset:0;background:linear-gradient(90deg,#071b3be8 0%,#071b3b88 38%,transparent 72%);content:""}.promo-copy{position:absolute;z-index:1;inset:50% auto auto clamp(1.2rem,5vw,3rem);max-width:340px;transform:translateY(-50%);color:#fff}.promo-copy p{margin:0 0 .4rem;color:#e9b965;font-size:.7rem;font-weight:800;letter-spacing:.12em}.promo-copy h3{margin:0 0 1rem;color:#fff;font-size:clamp(1.3rem,3vw,2.2rem)}.promo-copy a{display:inline-flex;align-items:center;gap:.4rem;padding:.55rem .8rem;border-radius:8px;background:#e3864f;color:#fff;font-size:.82rem;font-weight:800;text-decoration:none}.carousel-control{position:absolute;z-index:2;top:50%;display:grid;place-items:center;width:42px;height:42px;border:1px solid #fff8;border-radius:50%;background:#071b3b99;color:#fff;transform:translateY(-50%);cursor:pointer}.carousel-control--prev{left:1rem}.carousel-control--next{right:1rem}.carousel-dots{position:absolute;z-index:2;right:1.25rem;bottom:1rem;display:flex;gap:.35rem}.carousel-dots button{width:8px;height:8px;padding:0;border:0;border-radius:50%;background:#fff8;cursor:pointer}.carousel-dots button.active{width:24px;border-radius:99px;background:#e9b965}.section{margin-bottom:5rem}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.4rem}.section-heading h2,.steps-section h2,.business-cta h2{margin:0;color:#071b3b;font-size:clamp(1.6rem,3vw,2.25rem);letter-spacing:-.035em}.section-heading a{display:inline-flex;align-items:center;gap:.3rem;color:#0755b8;font-size:.85rem;font-weight:800;text-decoration:none;white-space:nowrap}.section-heading a:hover{color:#0da68c}.category-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:.75rem}.category-card{display:grid;justify-items:center;gap:.65rem;min-width:0;padding:1rem .5rem;border:1px solid #e4e6e8;border-radius:15px;background:#fff;color:#071b3b;text-align:center;text-decoration:none;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.category-card:hover{border-color:#9bcfc4;box-shadow:0 10px 25px #071b3b0d;transform:translateY(-3px)}.category-card span:last-child{font-size:.78rem;font-weight:750;line-height:1.3;overflow-wrap:anywhere}.category-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:#eef5f3;color:#0da68c;font-size:1.25rem}.collections-section{padding:3rem 0;border-top:1px solid #e8e4dc;border-bottom:1px solid #e8e4dc}.collection-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.collection-card{min-width:0;padding:1.25rem;border:1px solid #e6e1d9;border-radius:18px;background:#fff}.collection-heading{display:flex;justify-content:space-between;gap:1rem;margin-bottom:1rem}.collection-heading h3{margin:0 0 .25rem;color:#071b3b;font-size:1.2rem}.collection-heading p{margin:0;color:#52637a;font-size:.82rem}.collection-number{color:#e3864f;font-size:1.3rem;font-weight:900}.collection-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.65rem}.collection-tile{min-width:0;color:#071b3b;text-decoration:none}.collection-image{aspect-ratio:1.55;overflow:hidden;border-radius:10px;background:#e7edf2}.collection-image img{width:100%;height:100%;object-fit:cover;transition:transform .22s ease}.collection-tile:hover img{transform:scale(1.04)}.collection-tile>span{display:block;margin-top:.45rem;font-size:.78rem;font-weight:750;line-height:1.3;overflow-wrap:anywhere}.steps-section{padding:3rem 0 4.5rem}.centered{justify-content:center;text-align:center}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}.steps article{position:relative;padding:1.2rem;text-align:center}.steps article:not(:last-child):after{position:absolute;top:2.05rem;left:67%;width:66%;border-top:1px dashed #c8d0d8;content:""}.step-number{display:block;margin-bottom:.6rem;color:#e3864f;font-size:.72rem;font-weight:900;letter-spacing:.1em}.steps article>i{display:grid;place-items:center;width:48px;height:48px;margin:auto;border-radius:50%;background:#eaf4f1;color:#0da68c;font-size:1.25rem}.steps h3{margin:.75rem 0 .25rem;color:#071b3b;font-size:1rem}.steps p{margin:0;color:#52637a;font-size:.85rem}.section-intro{margin:.5rem 0 0;color:#52637a}.provider-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.provider-grid app-listing-summary{min-width:0}.business-cta{display:flex;align-items:center;justify-content:space-between;gap:2rem;margin:0 0 4rem;padding:clamp(1.6rem,4vw,3rem);border-radius:22px;background:#071b3b;color:#fff}.business-cta h2{color:#fff}.business-cta p:last-child{margin:.6rem 0 0;color:#c5d1e2}.state{padding:1.25rem;border:1px dashed #cbd5e1;border-radius:12px;color:#52637a}.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}.category-card:focus-visible,.collection-tile:focus-visible,.section-heading a:focus-visible,.promo a:focus-visible,.cta-button:focus-visible,.hub-search button:focus-visible,.hub-search input:focus-visible,.location-row select:focus-visible,.carousel-control:focus-visible,.carousel-dots button:focus-visible{outline:3px solid #e9b965;outline-offset:3px}@media(max-width:1050px){.hero__inner{gap:2rem}.category-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.provider-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.hero__inner{display:flex;flex-direction:column;align-items:stretch;min-height:0;gap:2rem;padding:2.5rem 0 2rem}.hero h1{font-size:clamp(2.25rem,11vw,3.2rem)}.hero__copy>p:not(.eyebrow):not(.hero-tamil){font-size:1rem}.hub-search{align-items:stretch;flex-wrap:wrap;border-radius:14px;padding:.55rem}.hub-search>i{align-self:center;margin-left:.3rem}.hub-search input{min-height:42px}.voice-button{margin-left:auto}.search-button{width:100%}.location-row{flex-wrap:wrap}.hero__visual{min-height:245px}.hero-frame--back{inset:1.2rem 0 0 1.5rem}.hero-frame--main{inset:0 1rem 1.2rem 0}.promo{margin:1.5rem 0 3rem}.promo-image img{height:250px}.promo-copy{max-width:250px}.section{margin-bottom:3.5rem}.category-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:.5rem}.category-card{padding:.7rem .25rem}.category-icon{width:40px;height:40px;font-size:1.05rem}.category-card span:last-child{font-size:.7rem}.collection-grid{grid-template-columns:1fr}.collection-tiles{gap:.5rem}.collection-card{padding:1rem}.steps{grid-template-columns:1fr;gap:.25rem}.steps article{display:grid;grid-template-columns:42px 44px 1fr;align-items:center;gap:.5rem;text-align:left;padding:.7rem}.steps article:not(:last-child):after{top:auto;bottom:-.25rem;left:1.3rem;width:1px;height:.5rem;border-top:0;border-left:1px dashed #c8d0d8}.steps article>i{grid-column:2;grid-row:1}.step-number{grid-column:1;grid-row:1;margin:0}.steps h3{grid-column:3;grid-row:1;margin:0}.steps p{grid-column:3;grid-row:1;margin-top:1.4rem}.provider-grid{grid-template-columns:1fr}.business-cta{align-items:stretch;flex-direction:column;gap:1.25rem;margin-bottom:2rem}.cta-button{width:100%}.section-heading{align-items:flex-start;flex-direction:column}.section-heading>a{align-self:flex-start}}@media(max-width:390px){.hub-shell,.hero__inner{width:calc(100% - 1.25rem)}.category-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.promo-image img{height:235px}.promo-copy h3{font-size:1.25rem}.carousel-control{width:36px;height:36px}.carousel-control--prev{left:.5rem}.carousel-control--next{right:.5rem}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}
  `,
})
export class CommunityHubComponent implements OnInit, OnDestroy {
  protected readonly i18n = inject(LanguageService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  private readonly categoryService = inject(ServiceCategoryService);
  private readonly directory = inject(ServiceDirectoryService);
  protected readonly query = signal('');
  protected readonly locationId = signal('');
  protected readonly searchMessage = signal('');
  protected readonly voiceState = signal<'idle' | 'listening' | 'unsupported' | 'permission_denied' | 'error'>('idle');
  protected readonly categoriesLoading = this.categoryService.loading;
  protected readonly categoriesError = computed(() => Boolean(this.categoryService.error()));
  protected readonly providers = signal<readonly ServiceListing[]>([]);
  protected readonly providersLoading = signal(true);
  protected readonly providersError = signal(false);
  protected readonly locations = signal<DirectoryLocation[]>([]);
  protected readonly locationOptions = computed(() => locationSearchOptions(this.locations(), this.i18n.language()));
  protected readonly popularCategories = computed(() => {
    const categories = this.categoryService.categories();
    return categories.filter(category => category.showOnHomepage || category.isEssential).slice(0, 8).length
      ? categories.filter(category => category.showOnHomepage || category.isEssential).slice(0, 8)
      : categories.slice(0, 8);
  });
  protected readonly collections = computed(() => this.categoryService.categories().filter(category => category.subcategories.length).slice(0, 4).map(category => ({
    id: category.id, parent: category, nameEnglish: category.nameEnglish, nameTamil: category.nameTamil,
    description: category.description ?? 'Find trusted local options close to home.', items: category.subcategories.slice(0, 3),
  })));
  protected readonly slides: readonly HubSlide[] = [
    { image: '/assets/images/Annamalai%20University%20Clock%20Tower%20Campus.webp', alt: 'Annamalai University clock tower campus in Chidambaram', eyebrow: 'OUR TOWN', title: 'Annamalai University', link: '/services' },
    { image: '/assets/images/Welcome%20to%20Nam%20Chidambaram.webp', alt: 'Welcome to Nam Chidambaram', eyebrow: 'OUR TOWN, OUR PEOPLE', title: 'Discover what makes Chidambaram special.', link: '/services' },
    { image: '/assets/images/pichavaram-image-1.webp', alt: 'Pichavaram mangrove boat tour', eyebrow: 'LOCAL PLACES', title: 'Find more to explore around town.', link: '/businesses' },
    { image: '/assets/images/hotel-image-lakshmi-villas.webp', alt: 'Local stay in Chidambaram', eyebrow: 'LOCAL HOSPITALITY', title: 'Plan your next local experience.', link: '/services' },
  ];
  protected readonly slideIndex = signal(0);
  protected readonly currentSlide = computed(() => this.slides[this.slideIndex()]);
  private carouselTimer?: ReturnType<typeof setInterval>;
  protected readonly bannerFailed = signal(false);
  protected readonly carouselPaused = signal(false);
  private swipeStart: { x: number; y: number } | null = null;
  private recognition: SpeechRecognitionLike | null = null;

  constructor() {
    effect(() => {
      const language = this.i18n.language();
      const tamil = language === 'ta';
      this.seo.update({
        title: tamil
          ? 'சிதம்பரத்தில் உள்ளூர் சேவைகள் மற்றும் வணிகங்கள் | நம் சிதம்பரம்'
          : 'Local Services & Businesses in Chidambaram | CDM 360',
        description: tamil
          ? 'சிதம்பரத்தின் உள்ளூர் சேவைகள், சரிபார்க்கப்பட்ட வணிகங்கள் மற்றும் சமூகத் தகவல்களை அறியுங்கள்.'
          : 'Discover local services, businesses and community information in Chidambaram, Tamil Nadu.',
        path: '/',
        language,
      });
    });
  }

  ngOnInit(): void {
    void this.load();
    this.resumeCarousel();
  }
  private async load(): Promise<void> { await Promise.all([this.categoryService.load(), this.loadProviders(), this.loadLocations()]); }
  private async loadProviders(): Promise<void> { try { this.providers.set((await this.directory.search(null, null, '', 0)).listings.slice(0, 6)); } catch { this.providersError.set(true); } finally { this.providersLoading.set(false); } }
  private async loadLocations(): Promise<void> { try { this.locations.set(await this.directory.locations()); } catch { this.locations.set([]); } }
  protected search(event: Event): void { event.preventDefault(); const term = this.query().trim(); if (term.length < 2) { this.searchMessage.set('Enter at least two characters to search.'); return; } this.searchMessage.set(''); void this.router.navigate(['/service-search'], { queryParams: { q: term, location: this.locationId() || null } }); }
  protected nextSlide(): void { this.slideIndex.update(index => (index + 1) % this.slides.length); }
  protected previousSlide(): void { this.slideIndex.update(index => (index - 1 + this.slides.length) % this.slides.length); }
  protected showSlide(index: number): void { this.pauseCarousel(); this.bannerFailed.set(false); this.slideIndex.set(index); }
  protected pauseCarousel(): void { if (this.carouselTimer) clearInterval(this.carouselTimer); }
  protected resumeCarousel(): void { this.pauseCarousel(); if (this.carouselPaused() || this.slides.length < 2 || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return; this.carouselTimer = setInterval(() => this.nextSlide(), 6000); }
  protected toggleCarousel(): void { this.carouselPaused.update(value => !value); this.resumeCarousel(); }
  protected startSwipe(event: TouchEvent): void { this.pauseCarousel(); const touch = event.changedTouches.item(0); this.swipeStart = touch ? { x: touch.clientX, y: touch.clientY } : null; }
  protected endSwipe(event: TouchEvent): void { const start = this.swipeStart; this.swipeStart = null; const touch = event.changedTouches.item(0); if (!start || !touch) return; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y; if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) this.nextSlide(); else this.previousSlide(); } }
  protected categoryLink(category: ServiceCategory, parent: ServiceCategory): readonly string[] { return ['/services', parent.slug, category.slug]; }
  protected categoryIcon(category: ServiceCategory) { return CATEGORY_ICON_STYLES[category.slug] ?? FALLBACK_CATEGORY_ICON; }
  protected collectionImage(_collectionIndex: number, item: ServiceCategory): string | null {
    const filename = CATEGORY_IMAGE_MAP[item.slug];
    return filename ? `/assets/images/community-categories/${filename}` : null;
  }
  protected toggleVoice(): void { if (this.voiceState() === 'listening') { this.recognition?.stop(); return; } const browser = globalThis as typeof globalThis & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }; const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition; if (!Constructor) { this.voiceState.set('unsupported'); return; } const recognition = new Constructor(); recognition.lang = this.i18n.language() === 'ta' ? 'ta-IN' : 'en-IN'; recognition.interimResults = false; recognition.continuous = false; recognition.onresult = event => { const text = Array.from({ length: event.results.length }, (_, index) => event.results[index][0]?.transcript ?? '').join(' ').trim(); if (text) this.query.set(text); this.voiceState.set('idle'); }; recognition.onerror = event => { this.voiceState.set(event.error === 'not-allowed' ? 'permission_denied' : 'error'); this.recognition = null; }; recognition.onend = () => { this.recognition = null; if (this.voiceState() === 'listening') this.voiceState.set('idle'); }; this.recognition = recognition; try { recognition.start(); this.voiceState.set('listening'); } catch { this.voiceState.set('error'); this.recognition = null; } }
  protected voiceLabel(): string { return this.voiceState() === 'listening' ? 'Stop voice search' : 'Start voice search'; }
  protected voiceMessage(): string { switch (this.voiceState()) { case 'listening': return 'Listening…'; case 'unsupported': return 'Voice search is not supported in this browser.'; case 'permission_denied': return 'Microphone permission was denied.'; case 'error': return 'Voice search is unavailable.'; default: return ''; } }
  ngOnDestroy(): void { if (this.carouselTimer) clearInterval(this.carouselTimer); this.recognition?.stop(); this.recognition = null; }
}
