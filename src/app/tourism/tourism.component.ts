import { CurrencyPipe, DOCUMENT, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServiceCategory } from '../core/models/service-category';
import { ServiceListing } from '../core/models/service-listing';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { ListingSummaryComponent } from '../services/listing-summary/listing-summary.component';
import { LodgeReviewSummaryComponent } from '../services/lodge-review-summary.component';
import { TOURISM_DESTINATIONS, TOURISM_FAQS, TOURISM_ITINERARIES } from './tourism-content';

type EnquiryTopic = 'stay' | 'visit' | 'dining' | 'help';

interface TourismServiceAction {
  readonly id: string;
  readonly english: string;
  readonly tamil: string;
  readonly descriptionEnglish: string;
  readonly descriptionTamil: string;
  readonly icon: string;
}

@Component({
  selector: 'app-tourism',
  imports: [CurrencyPipe, NgOptimizedImage, RouterLink, ListingSummaryComponent, LodgeReviewSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tourism-page" aria-labelledby="tourism-title">
      <div class="tourism-shell">
        <nav class="tourism-breadcrumb" aria-label="Breadcrumb">
          <a routerLink="/">{{ i18n.language() === 'ta' ? 'முகப்பு' : 'Home' }}</a>
          <i class="bi bi-chevron-right" aria-hidden="true"></i>
          <a routerLink="/essential-services">{{ i18n.language() === 'ta' ? 'முக்கிய சேவைகள்' : 'Core Services' }}</a>
          <i class="bi bi-chevron-right" aria-hidden="true"></i>
          <span aria-current="page">{{ i18n.language() === 'ta' ? 'சுற்றுலா' : 'Tourism & Travel' }}</span>
        </nav>

        <section class="tourism-hero" aria-describedby="tourism-intro">
          <img class="tourism-hero-image" ngSrc="/assets/images/Golden-Hour%20Temple%20Tank%20Festival.png" width="1672" height="940" priority sizes="(max-width: 720px) 100vw, 62vw" alt="Illustrative artwork inspired by Chidambaram temple tank and cultural heritage" />
          <div class="tourism-hero-content">
            <p class="tourism-eyebrow"><i class="bi bi-compass" aria-hidden="true"></i> CDM 360 · CORE SERVICES</p>
            <h1 id="tourism-title">{{ i18n.language() === 'ta' ? 'கோவில் நகரம். கடற்கரை அமைதி.' : 'Temple-town heritage. Coastal calm.' }}</h1>
            <p id="tourism-intro" class="tourism-lede">{{ i18n.language() === 'ta' ? 'சிதம்பரத்தையும் அதைச் சுற்றிய இடங்களையும் உள்ளூர் சேவைகளுடன் திட்டமிடுங்கள்.' : 'Plan a thoughtful Chidambaram visit with local stays, transport and places worth exploring.' }}</p>
            <p class="tourism-hero-tamil" lang="ta">சிதம்பரம் · நம் ஊர் · நம் பயணம்</p>
            <div class="tourism-primary-actions" aria-label="Plan your visit">
              <a class="journey-action journey-action--primary" href="#stays" (click)="goToSection($event, 'stays')"><i class="bi bi-building" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'தங்குமிடம் தேட' : 'Find a Stay' }}<i class="bi bi-arrow-down-right" aria-hidden="true"></i></a>
              <a class="journey-action" href="#itinerary" (click)="goToSection($event, 'itinerary')"><i class="bi bi-map" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'என் பயணத்தைத் திட்டமிடு' : 'Plan My Visit' }}<i class="bi bi-arrow-down-right" aria-hidden="true"></i></a>
            </div>
            <p class="tourism-hero-note"><i class="bi bi-info-circle" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'படம் விளக்கத்திற்கான காட்சி. நேரம், கட்டணம் மற்றும் கிடைப்பை நேரடியாக உறுதிப்படுத்தவும்.' : 'Illustrative destination artwork. Confirm current timings, fees and availability directly.' }}</p>
          </div>
          <span class="tourism-hero-stamp" aria-hidden="true"><i class="bi bi-flower1"></i> NAM CHIDAMBARAM · TAMIL NADU</span>
        </section>

        <section class="tourism-services" aria-labelledby="tourism-services-title">
          <header class="section-heading">
            <div><p class="tourism-eyebrow">{{ i18n.language() === 'ta' ? 'உங்கள் பயணத்திற்குத் தேவையானவை' : 'A BETTER WAY TO ARRIVE' }}</p><h2 id="tourism-services-title">{{ i18n.language() === 'ta' ? 'பயணத்தை எளிதாகத் திட்டமிடுங்கள்' : 'The essentials, thoughtfully connected.' }}</h2></div>
            <p>{{ i18n.language() === 'ta' ? 'உண்மையான உள்ளூர் சேவைகள், நெகிழ்வான திட்டங்கள்.' : 'Local listings, useful visitor guidance and room to make the trip your own.' }}</p>
          </header>
          <nav id="tourism-menu" class="tourism-menu" [attr.aria-label]="i18n.language() === 'ta' ? 'சுற்றுலா பகுதிகள்' : 'Tourism sections'">
            @for (service of serviceActions; track service.id) {
              <a [href]="'#' + service.id" (click)="goToSection($event, service.id)">
                <span class="tourism-menu-icon"><i class="bi" [class]="service.icon" aria-hidden="true"></i></span>
                <span class="tourism-menu-copy"><strong>{{ i18n.language() === 'ta' ? service.tamil : service.english }}</strong><small>{{ i18n.language() === 'ta' ? service.descriptionTamil : service.descriptionEnglish }}</small></span>
              </a>
            }
          </nav>
          @if (selectedListingSection(); as selected) {
            <div class="local-listings-layout">
            <section class="inline-listing-results" [id]="selected" aria-labelledby="inline-listing-title" aria-live="polite">
              <header><div><p class="tourism-eyebrow">{{ selected === 'stays' ? (i18n.language() === 'ta' ? 'உள்ளூர் தங்குமிடங்கள்' : 'LOCAL STAYS') : (i18n.language() === 'ta' ? 'உள்ளூர் உணவகங்கள்' : 'LOCAL DINING') }}</p><h3 id="inline-listing-title">{{ selected === 'stays' ? (i18n.language() === 'ta' ? 'தங்குவதற்கான இடங்கள்' : 'Hotels & stays') : (i18n.language() === 'ta' ? 'உணவகங்கள்' : 'Food & dining') }}</h3></div><button type="button" class="inline-listing-close" [attr.aria-label]="i18n.language() === 'ta' ? 'பட்டியல்களை மூடு' : 'Close listings'" (click)="closeInlineListings()"><i class="bi bi-x-lg" aria-hidden="true"></i></button></header>
              @if (listingsLoading()) { <p class="tourism-state" role="status">{{ i18n.language() === 'ta' ? 'பட்டியல்கள் ஏற்றப்படுகின்றன…' : 'Loading listings…' }}</p> }
              @else if (listingsError()) { <p class="inline-listing-message" role="alert">{{ i18n.language() === 'ta' ? 'பட்டியல்களை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Listings could not be loaded. Please try again.' }}</p> }
              @else if (selected === 'stays' && stayListingsPreview().length) {
                <div class="inline-provider-grid">
                  @for (listing of stayListingsPreview(); track listing.id) {
                    <article class="lodge-result-card">
                      <a class="lodge-result-photo" [routerLink]="lodgeDetailLink(listing)" [attr.aria-label]="(ta() ? 'விடுதி விவரம்: ' : 'Lodge details: ') + listing.title">
                        @if (lodgePhoto(listing); as photo) { <img [src]="photo" [alt]="listing.title" width="150" height="120" loading="lazy" /> }
                        @else { <span class="lodge-photo-placeholder" aria-hidden="true"><i class="bi bi-building"></i></span> }
                      </a>
                      <div class="lodge-result-copy">
                        <div class="lodge-title-line"><h4><a [routerLink]="lodgeDetailLink(listing)">{{ listing.title }}</a></h4>@if (listing.indicative_room_price !== null && listing.indicative_room_price !== undefined) { <p class="lodge-price"><strong>{{ listing.indicative_room_price | currency:'INR':'symbol':'1.0-0' }}</strong><small>{{ ta() ? 'ஒரு இரவுக்கு' : 'per room / night' }}</small></p> }</div>
                        <p class="lodge-provider">{{ listing.service_providers.display_name }}</p>
                        <app-lodge-review-summary [listingId]="listing.id" />
                        @if (lodgeLocation(listing); as location) { <p class="lodge-location"><i class="bi bi-geo-alt" aria-hidden="true"></i>{{ location }}</p> }
                        @if (listing.description) { <p class="lodge-description">{{ listing.description }}</p> }
                        @if (listing.room_amenities?.length) { <div class="lodge-amenities" [attr.aria-label]="ta() ? 'அறை வசதிகள்' : 'Room amenities'">@for (amenity of listing.room_amenities; track amenity; let index = $index) { @if (index < 4) { <span>{{ amenity }}</span> } }</div> }
                        <div class="lodge-result-actions">
                          <a class="availability-link" [routerLink]="lodgeDetailLink(listing)">{{ ta() ? 'கிடைப்பைச் சரிபார்க்க' : 'Check Availability' }}</a>
                          <a [routerLink]="lodgeDetailLink(listing)" fragment="reviews">{{ ta() ? 'விமர்சனங்கள்' : 'View Reviews' }}</a>
                          <a [routerLink]="lodgeDetailLink(listing)" [queryParams]="{ review: 'write' }" fragment="reviews">{{ ta() ? 'விமர்சனம் எழுத' : 'Write a Review' }}</a>
                        </div>
                      </div>
                    </article>
                  }
                </div>
              }
              @else if (selected === 'dining' && diningListingsPreview().length) { <div class="inline-provider-grid">@for (listing of diningListingsPreview(); track listing.id) { <app-listing-summary [listing]="listing" [compact]="true" /> }</div> }
              @else { <p class="inline-listing-message" role="status">{{ selected === 'stays' ? (i18n.language() === 'ta' ? 'பொது தங்குமிடப் பட்டியல்கள் இன்னும் இல்லை.' : 'No public stay listings are available yet.') : (i18n.language() === 'ta' ? 'பொது உணவகப் பட்டியல்கள் இன்னும் இல்லை.' : 'No public restaurant listings are available yet.') }}</p> }
            </section>
            @if (selected === 'stays') {
              <section id="dining" class="dining-section dining-inline" aria-labelledby="inline-dining-title" [attr.aria-busy]="listingsLoading()">
                <div class="provider-heading"><div><p class="tourism-eyebrow">{{ i18n.language() === 'ta' ? 'உள்ளூர் சுவைகள்' : 'TASTE THE TOWN' }}</p><h3 id="inline-dining-title">{{ i18n.language() === 'ta' ? 'உணவு மற்றும் உணவகங்கள்' : 'Food & dining, close to your plans.' }}</h3><p>{{ i18n.language() === 'ta' ? 'பொது உணவகப் பட்டியல்கள் சேவை அடைவிலிருந்து.' : 'Public restaurant listings from the CDM 360 service directory.' }}</p></div><a class="text-link" routerLink="/services" [queryParams]="diningQueryParams()">{{ i18n.language() === 'ta' ? 'உணவகங்களைப் பாருங்கள்' : 'Browse dining' }}<i class="bi bi-arrow-up-right" aria-hidden="true"></i></a></div>
                @if (listingsLoading()) { <p class="tourism-state" role="status">{{ i18n.language() === 'ta' ? 'உணவகங்கள் ஏற்றப்படுகின்றன…' : 'Loading restaurant listings…' }}</p> }
                @else if (listingsError()) { <p class="inline-listing-message" role="alert">{{ i18n.language() === 'ta' ? 'உணவகப் பட்டியல்களை ஏற்ற முடியவில்லை.' : 'Restaurant listings could not be loaded.' }}</p> }
                @else if (diningListingsPreview().length) { <div class="dining-inline-listings">@for (listing of diningListingsPreview(); track listing.id) { <app-listing-summary [listing]="listing" [compact]="true" [horizontal]="true" /> }</div> }
                @else { <p class="inline-listing-message" role="status">{{ i18n.language() === 'ta' ? 'பொது உணவகப் பட்டியல்கள் இன்னும் இல்லை.' : 'No public restaurant listings are available yet.' }}</p> }
              </section>
            }
            </div>
          }
        </section>

        <section id="temple-guide" class="temple-feature" tabindex="-1" aria-labelledby="temple-guide-title">
          <div class="temple-feature-image-wrap">
            <img class="temple-feature-image" ngSrc="/assets/images/chidambaram-hero2.png" width="1651" height="953" sizes="(max-width: 760px) 100vw, 50vw" loading="lazy" alt="Illustrative artwork inspired by Chidambaram temple tank and gopuram" />
            <span class="image-caption">{{ i18n.language() === 'ta' ? 'விளக்கக் காட்சி' : 'Illustrative destination artwork' }}</span>
          </div>
          <div class="temple-feature-copy">
            <p class="tourism-eyebrow"><i class="bi bi-stars" aria-hidden="true"></i> {{ i18n.language() === 'ta' ? 'சிறப்பு பார்வையாளர் வழிகாட்டி' : 'FEATURED VISITOR GUIDE' }}</p>
            <h2 id="temple-guide-title">{{ i18n.language() === 'ta' ? 'தில்லை நடராஜர் கோவில்' : 'Meet Chidambaram’s Nataraja Temple' }}</h2>
            <p>{{ i18n.language() === 'ta' ? 'நடராஜரின் ஆனந்தத் தாண்டவத்துடன் தொடர்புடைய தலமாக சிதம்பரம் பரவலாக அறியப்படுகிறது. வருகைக்கு முன் தற்போதைய வழிகாட்டுதலை மாவட்ட ஆதாரத்திலும் கோவில் நிர்வாகத்திடமும் உறுதிப்படுத்துங்கள்.' : 'Chidambaram is renowned for its Nataraja Temple and the tradition of Shiva as the cosmic dancer. This independent visitor guide is not affiliated with the temple; confirm current access guidance before you go.' }}</p>
            <ul class="temple-highlights">
              <li><i class="bi bi-check2" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'உங்கள் வருகைக்கு முன் நுழைவு மற்றும் நடைமுறை விவரங்களைச் சரிபார்க்கவும்.' : 'Check current entry and visitor guidance before arrival.' }}</li>
              <li><i class="bi bi-check2" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'உள்ளூர் போக்குவரத்து மற்றும் உணவை முன்கூட்டியே உறுதிப்படுத்தவும்.' : 'Arrange local transport and dining directly with providers.' }}</li>
              <li><i class="bi bi-check2" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'கோவில் மரபுகளையும் புகைப்பட வழிகாட்டுதலையும் மதிக்கவும்.' : 'Respect temple customs and posted photography guidance.' }}</li>
            </ul>
            <div class="source-row"><a [href]="templeSourceUrl" target="_blank" rel="noopener noreferrer">{{ i18n.language() === 'ta' ? 'கடலூர் மாவட்ட சுற்றுலா ஆதாரம்' : 'Cuddalore District visitor information' }}<i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a><a [href]="mapLink('Chidambaram Nataraja Temple')" target="_blank" rel="noopener noreferrer">{{ i18n.language() === 'ta' ? 'வரைபடத்தில் பார்க்க' : 'Open map' }}<i class="bi bi-geo-alt" aria-hidden="true"></i></a></div>
          </div>
        </section>

        <section id="itinerary" class="itinerary-section" tabindex="-1" aria-labelledby="itinerary-title">
          <header class="section-heading"><div><p class="tourism-eyebrow">{{ i18n.language() === 'ta' ? 'உங்கள் வேகத்தில்' : 'FLEXIBLE BY DESIGN' }}</p><h2 id="itinerary-title">{{ i18n.language() === 'ta' ? 'உங்கள் வருகையைத் திட்டமிடுங்கள்' : 'A visit that fits your pace.' }}</h2></div><p>{{ i18n.language() === 'ta' ? 'இவை நேர அட்டவணையோ முன்பதிவோ அல்ல; மாற்றிக் கொள்ளக்கூடிய யோசனைகள்.' : 'Ideas, not schedules or bookings. Check opening information and local conditions before travel.' }}</p></header>
          <div class="itinerary-grid">
            @for (itinerary of itineraries; track itinerary.id; let index = $index) {
              <article class="itinerary-card" [class.itinerary-card--featured]="index === 0">
                <div class="itinerary-heading"><span>{{ index === 0 ? '01' : '02' }}</span><div><p class="tourism-eyebrow">{{ index === 0 ? (i18n.language() === 'ta' ? 'ஒரு நாள்' : 'ONE DAY') : (i18n.language() === 'ta' ? 'இரண்டு நாள்' : 'TWO DAYS') }}</p><h3>{{ i18n.language() === 'ta' ? itinerary.titleTamil : itinerary.titleEnglish }}</h3><p>{{ i18n.language() === 'ta' ? itinerary.subtitleTamil : itinerary.subtitleEnglish }}</p></div></div>
                <ol class="itinerary-stops">@for (stop of itinerary.stops; track stop.titleEnglish) { <li><span class="stop-marker" aria-hidden="true"></span><div><h4>{{ i18n.language() === 'ta' ? stop.titleTamil : stop.titleEnglish }}</h4><p>{{ i18n.language() === 'ta' ? stop.descriptionTamil : stop.descriptionEnglish }}</p></div></li> }</ol>
                @if (itinerary.id === 'two-day') { <a class="text-link" [href]="whatsappHref('visit')" target="_blank" rel="noopener noreferrer">{{ i18n.language() === 'ta' ? 'பயண உதவி கேளுங்கள்' : 'Ask for travel assistance' }}<i class="bi bi-arrow-up-right" aria-hidden="true"></i></a> }
              </article>
            }
          </div>
        </section>

        <section id="attractions" class="attractions-section" tabindex="-1" aria-labelledby="attractions-title">
          <header class="section-heading"><div><p class="tourism-eyebrow">{{ i18n.language() === 'ta' ? 'சுற்றியுள்ள இடங்கள்' : 'BEYOND THE TEMPLE TOWN' }}</p><h2 id="attractions-title">{{ i18n.language() === 'ta' ? 'அருகிலுள்ள இடங்களை அறியுங்கள்' : 'Places to make time for.' }}</h2></div><a class="text-link" href="https://cuddalore.nic.in/tourist-places/" target="_blank" rel="noopener noreferrer">{{ i18n.language() === 'ta' ? 'அதிகாரப்பூர்வ மாவட்ட ஆதாரம்' : 'District tourism source' }}<i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a></header>
          <div class="destination-grid">
            @for (destination of destinations; track destination.id) {
              <article class="destination-card">
                <a class="destination-image-link" [href]="mapLink(destination.mapQuery)" target="_blank" rel="noopener noreferrer" [attr.aria-label]="(i18n.language() === 'ta' ? 'வரைபடத்தில் திறக்க: ' : 'Open map for: ') + (i18n.language() === 'ta' ? destination.titleTamil : destination.titleEnglish)">
                  <img [ngSrc]="destination.image" [width]="destination.width" [height]="destination.height" sizes="(max-width: 700px) 100vw, (max-width: 1050px) 50vw, 33vw" loading="lazy" [alt]="destination.imageAlt" />
                  <span class="destination-map"><i class="bi bi-geo-alt" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'வரைபடம்' : 'Map' }}</span>
                </a>
                <div class="destination-copy">
                  <p class="destination-kicker">{{ i18n.language() === 'ta' ? 'இடம் பார்க்க' : 'PLACE TO VISIT' }}</p>
                  <h3>{{ i18n.language() === 'ta' ? destination.titleTamil : destination.titleEnglish }}</h3>
                  <p>{{ i18n.language() === 'ta' ? destination.descriptionTamil : destination.descriptionEnglish }}</p>
                  <small class="illustrative-note">
                    {{ i18n.language() === 'ta' ? 'விளக்கப் படம் · ஆதாரம்:' : 'Illustrative image · source:' }}
                    <a [href]="destination.sourceUrl" target="_blank" rel="noopener noreferrer">{{ destination.sourceLabel }}</a>
                    <span>{{ destination.sourceUpdatedAt ? ' · ' + (i18n.language() === 'ta' ? 'ஆதாரப் பக்கப் புதுப்பிப்பு' : 'Source page updated') + ' ' + destination.sourceUpdatedAt : '' }}</span>
                  </small>
                </div>
              </article>
            }
          </div>
        </section>

        @if (selectedListingSection() !== 'stays') {
        <section id="stays" class="provider-section" tabindex="-1" aria-labelledby="stays-title" [attr.aria-busy]="listingsLoading()">
          <div class="provider-heading"><div><p class="tourism-eyebrow">{{ i18n.language() === 'ta' ? 'உள்ளூர் தங்குமிடங்கள்' : 'STAY, YOUR WAY' }}</p><h2 id="stays-title">{{ i18n.language() === 'ta' ? 'தங்குவதற்கான இடத்தைத் தேடுங்கள்' : 'Find a stay in Chidambaram.' }}</h2><p>{{ i18n.language() === 'ta' ? 'CDM 360 சமூக சேவை அடைவிலிருந்து பொதுப் பட்டியல்கள்.' : 'Public listings from the CDM 360 community service directory.' }}</p></div><a class="outline-link" routerLink="/services" [queryParams]="stayQueryParams()">{{ i18n.language() === 'ta' ? 'அனைத்து தங்குமிடங்கள்' : 'Browse stays' }}<i class="bi bi-arrow-up-right" aria-hidden="true"></i></a></div>
          @if (listingsLoading()) { <p class="tourism-state" role="status">{{ i18n.language() === 'ta' ? 'உள்ளூர் தங்குமிடங்கள் ஏற்றப்படுகின்றன…' : 'Loading local stay listings…' }}</p> }
          @else if (listingsError()) { <div class="tourism-empty" role="status"><i class="bi bi-wifi-off" aria-hidden="true"></i><div><h3>{{ i18n.language() === 'ta' ? 'பட்டியல்களை இப்போது ஏற்ற முடியவில்லை' : 'Listings are unavailable right now.' }}</h3><p>{{ i18n.language() === 'ta' ? 'மீண்டும் முயற்சிக்கவும் அல்லது சுற்றுலா உதவியைத் தொடர்பு கொள்ளவும்.' : 'Try the service directory or ask travel assistance for help finding options.' }}</p></div><a [href]="whatsappHref('stay')" target="_blank" rel="noopener noreferrer">{{ i18n.language() === 'ta' ? 'WhatsApp உதவி' : 'Ask on WhatsApp' }}</a></div> }
          @else if (stayListingsPreview().length) { <div class="provider-grid">@for (listing of stayListingsPreview(); track listing.id) { <app-listing-summary [listing]="listing" [compact]="true" /> }</div> }
          @else { <div class="tourism-empty"><i class="bi bi-building" aria-hidden="true"></i><div><h3>{{ i18n.language() === 'ta' ? 'பொது தங்குமிடப் பட்டியல்கள் இல்லை' : 'No public stay listings are available yet.' }}</h3><p>{{ i18n.language() === 'ta' ? 'இடத்தைத் தேடுங்கள் அல்லது உள்ளூர் விருப்பங்களைப் பற்றி எங்களிடம் கேளுங்கள்.' : 'Search the service directory or ask for help identifying local options. Rates and availability must be confirmed with providers.' }}</p></div><a [href]="whatsappHref('stay')" target="_blank" rel="noopener noreferrer">{{ i18n.language() === 'ta' ? 'தங்குமிடம் பற்றி கேளுங்கள்' : 'Ask about a stay' }}<i class="bi bi-whatsapp" aria-hidden="true"></i></a></div> }
          <p class="provider-disclaimer"><i class="bi bi-info-circle" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'பட்டியல்கள் முன்பதிவு அல்ல. விலை, அறை கிடைப்பு, விதிமுறைகளை வழங்குநரிடம் நேரடியாக உறுதிப்படுத்தவும்.' : 'Listings are not bookings. Confirm room availability, rates and terms directly with each provider.' }}</p>
        </section>
        }

        @if (selectedListingSection() === null) {
          <section id="dining" class="dining-section" tabindex="-1" aria-labelledby="dining-title" [attr.aria-busy]="listingsLoading()">
            <div class="provider-heading"><div><p class="tourism-eyebrow">{{ i18n.language() === 'ta' ? 'உள்ளூர் சுவைகள்' : 'TASTE THE TOWN' }}</p><h2 id="dining-title">{{ i18n.language() === 'ta' ? 'உணவு மற்றும் உணவகங்கள்' : 'Food & dining, close to your plans.' }}</h2><p>{{ i18n.language() === 'ta' ? 'பொது உணவகப் பட்டியல்கள் சேவை அடைவிலிருந்து.' : 'Public restaurant listings from the CDM 360 service directory.' }}</p></div><a class="text-link" routerLink="/services" [queryParams]="diningQueryParams()">{{ i18n.language() === 'ta' ? 'உணவகங்களைப் பாருங்கள்' : 'Browse dining' }}<i class="bi bi-arrow-up-right" aria-hidden="true"></i></a></div>
            @if (listingsLoading()) { <p class="tourism-state" role="status">{{ i18n.language() === 'ta' ? 'உணவகங்கள் ஏற்றப்படுகின்றன…' : 'Loading restaurant listings…' }}</p> }
            @else if (listingsError()) { <p class="inline-listing-message" role="alert">{{ i18n.language() === 'ta' ? 'உணவகப் பட்டியல்களை ஏற்ற முடியவில்லை.' : 'Restaurant listings could not be loaded.' }}</p> }
            @else if (diningListingsPreview().length) { <div class="provider-grid">@for (listing of diningListingsPreview(); track listing.id) { <app-listing-summary [listing]="listing" [compact]="true" [horizontal]="true" /> }</div> }
            @else { <p class="inline-listing-message" role="status">{{ i18n.language() === 'ta' ? 'பொது உணவகப் பட்டியல்கள் இன்னும் இல்லை.' : 'No public restaurant listings are available yet.' }}</p> }
          </section>
        }

        <section class="essentials-section" id="travel-essentials" tabindex="-1" aria-labelledby="essentials-title">
          <div class="essentials-intro"><p class="tourism-eyebrow">{{ i18n.language() === 'ta' ? 'பயணத்திற்கு முன்' : 'BEFORE YOU SET OUT' }}</p><h2 id="essentials-title">{{ i18n.language() === 'ta' ? 'பயண அத்தியாவசியங்கள்' : 'The practical details, in one place.' }}</h2><p>{{ i18n.language() === 'ta' ? 'இடம் மற்றும் நேரம் மாறக்கூடும். வரைபடம் மற்றும் உள்ளூர் அதிகாரப்பூர்வ தகவலைச் சரிபார்க்கவும்.' : 'Use map searches for current locations. Confirm routes, operating details and services before travelling.' }}</p></div>
          <div class="essentials-grid">
            @for (essential of essentials; track essential.id) {
              <a class="essential-card" [href]="mapLink(essential.mapQuery)" target="_blank" rel="noopener noreferrer"><span><i class="bi" [class]="essential.icon" aria-hidden="true"></i></span><strong>{{ i18n.language() === 'ta' ? essential.tamil : essential.english }}</strong><small>{{ i18n.language() === 'ta' ? 'வரைபடத்தில் தேடுங்கள்' : 'Search on map' }}<i class="bi bi-arrow-up-right" aria-hidden="true"></i></small></a>
            }
            <article class="essential-card essential-card--emergency"><span><i class="bi bi-telephone-forward" aria-hidden="true"></i></span><strong>{{ i18n.language() === 'ta' ? 'இந்திய அவசர உதவி' : 'India emergency response' }}</strong><a href="tel:112">112 · {{ i18n.language() === 'ta' ? 'அழைக்க' : 'Call' }}</a><small><a href="https://112.gov.in/" target="_blank" rel="noopener noreferrer">{{ i18n.language() === 'ta' ? 'அதிகாரப்பூர்வ 112 தகவல்' : 'Official 112 information' }}<i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a></small></article>
          </div>
        </section>

        <section class="faq-section" aria-labelledby="tourism-faq-title">
          <div class="faq-heading"><p class="tourism-eyebrow">{{ i18n.language() === 'ta' ? 'தெளிவான தகவல்' : 'GOOD TO KNOW' }}</p><h2 id="tourism-faq-title">{{ i18n.language() === 'ta' ? 'பயணக் கேள்விகள்' : 'A few useful answers.' }}</h2><p>{{ i18n.language() === 'ta' ? 'சேவைகள் மற்றும் இட விவரங்களை நேரடியாக உறுதிப்படுத்தவும்.' : 'We connect you with information and local providers; we do not confirm travel arrangements.' }}</p></div>
          <div class="faq-list">@for (faq of faqs; track faq.questionEnglish) { <details class="faq-item"><summary>{{ i18n.language() === 'ta' ? faq.questionTamil : faq.questionEnglish }}<i class="bi bi-plus-lg" aria-hidden="true"></i></summary><p>{{ i18n.language() === 'ta' ? faq.answerTamil : faq.answerEnglish }}</p></details> }</div>
        </section>

        <section class="tourism-assistance" aria-labelledby="assistance-title">
          <div class="assistance-icon" aria-hidden="true"><i class="bi bi-chat-heart"></i></div>
          <div><p class="tourism-eyebrow">{{ i18n.language() === 'ta' ? 'உள்ளூர் பயண உதவி' : 'A LOCAL STARTING POINT' }}</p><h2 id="assistance-title">{{ i18n.language() === 'ta' ? 'உங்கள் சிதம்பரம் பயணத்தைப் பற்றி பேசுங்கள்.' : 'Let’s make your Chidambaram visit easier.' }}</h2><p>{{ i18n.language() === 'ta' ? 'தங்குமிடம், போக்குவரத்து அல்லது பயணத் திட்டம் குறித்து உதவி கேளுங்கள். இது விசாரணை மட்டுமே; முன்பதிவு உறுதி அல்ல.' : 'Ask for help finding a stay, transport or itinerary ideas. This is an enquiry to CDM 360 travel assistance, not a booking confirmation.' }}</p></div>
          <a class="assistance-cta" [href]="whatsappHref('help')" target="_blank" rel="noopener noreferrer"><i class="bi bi-whatsapp" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'WhatsApp · 9514636355' : 'WhatsApp travel help' }}<span>9514636355</span></a>
        </section>

        <footer class="tourism-footnote"><span><i class="bi bi-shield-check" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'CDM 360 சுயாதீன சமூகத் தளம்; கோவில் நிர்வாகத்துடன் இணைப்பு இல்லை.' : 'CDM 360 is an independent community platform and is not affiliated with the temple.' }}</span><span>{{ i18n.language() === 'ta' ? 'பொதுப் பட்டியல்கள் · தகவல் மாறக்கூடும்' : 'Public listings · Details may change' }}</span></footer>
      </div>
    </div>
  `,
  styleUrl: './tourism.component.scss',
})
export class TourismComponent implements OnInit {
  protected readonly i18n = inject(LanguageService);
  private readonly categoriesService = inject(ServiceCategoryService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly document = inject(DOCUMENT);

  protected readonly destinations = TOURISM_DESTINATIONS;
  protected readonly itineraries = TOURISM_ITINERARIES;
  protected readonly faqs = TOURISM_FAQS;
  protected readonly listingsLoading = signal(true);
  protected readonly listingsError = signal(false);
  protected readonly stayListings = signal<readonly ServiceListing[]>([]);
  protected readonly diningListings = signal<readonly ServiceListing[]>([]);
  protected readonly selectedListingSection = signal<'stays' | 'dining' | null>('stays');

  protected readonly stayListingsPreview = computed(() => this.stayListings().slice(0, 3));
  protected readonly diningListingsPreview = computed(() => this.diningListings().slice(0, 3));
  protected readonly stayCategoryId = computed(() => this.categoryBySlug('hotels')?.id ?? null);
  protected readonly diningCategoryId = computed(() => this.categoryBySlug('restaurants')?.id ?? null);
  protected readonly stayQueryParams = computed(() => this.queryParams(this.stayCategoryId(), 'hotel'));
  protected readonly diningQueryParams = computed(() => this.queryParams(this.diningCategoryId(), 'restaurant'));

  protected readonly serviceActions: readonly TourismServiceAction[] = [
    { id: 'stays', english: 'Hotels & stays', tamil: 'ஹோட்டல்கள்', descriptionEnglish: 'Find public local stay listings.', descriptionTamil: 'உள்ளூர் தங்குமிடப் பட்டியல்களைப் பாருங்கள்.', icon: 'bi-building' },
    { id: 'temple-guide', english: 'Temple guide', tamil: 'கோவில் வழிகாட்டி', descriptionEnglish: 'Plan a respectful temple visit.', descriptionTamil: 'மரியாதையான கோவில் வருகையைத் திட்டமிடுங்கள்.', icon: 'bi-flower1' },
    { id: 'attractions', english: 'Places to visit', tamil: 'பார்க்க வேண்டிய இடங்கள்', descriptionEnglish: 'Explore nearby nature and heritage.', descriptionTamil: 'அருகிலுள்ள இயற்கை மற்றும் மரபிடங்களை அறியுங்கள்.', icon: 'bi-geo-alt' },
    { id: 'dining', english: 'Food & dining', tamil: 'உணவு & உணவகங்கள்', descriptionEnglish: 'See public restaurant listings.', descriptionTamil: 'பொது உணவகப் பட்டியல்களைப் பாருங்கள்.', icon: 'bi-cup-hot' },
    { id: 'travel-essentials', english: 'Tourist help', tamil: 'சுற்றுலா உதவி', descriptionEnglish: 'Maps, emergency and visitor links.', descriptionTamil: 'வரைபடம், அவசரம் மற்றும் பயணி இணைப்புகள்.', icon: 'bi-life-preserver' },
  ];

  protected readonly essentials = [
    { id: 'rail', english: 'Railway station', tamil: 'ரயில் நிலையம்', icon: 'bi-train-front', mapQuery: 'Chidambaram Railway Station' },
    { id: 'bus', english: 'Bus stand', tamil: 'பேருந்து நிலையம்', icon: 'bi-bus-front', mapQuery: 'Chidambaram Bus Stand' },
    { id: 'hospital', english: 'Hospitals', tamil: 'மருத்துவமனைகள்', icon: 'bi-hospital', mapQuery: 'Hospitals in Chidambaram Tamil Nadu' },
    { id: 'pharmacy', english: 'Pharmacies', tamil: 'மருந்தகங்கள்', icon: 'bi-capsule', mapQuery: 'Pharmacies in Chidambaram Tamil Nadu' },
  ] as const;

  protected readonly templeSourceUrl = 'https://cuddalore.nic.in/tourist-places/';

  ngOnInit(): void {
    void this.loadPublicProviderListings();
  }

  protected goToSection(event: MouseEvent, sectionId: string): void {
    event.preventDefault();
    if (sectionId === 'stays' || sectionId === 'dining') {
      this.selectedListingSection.set(sectionId);
      return;
    }
    this.selectedListingSection.set(null);
    const section = this.document.getElementById(sectionId);
    if (!section) return;
    const prefersReducedMotion = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    section.scrollIntoView?.({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    section.focus({ preventScroll: true });
  }

  protected closeInlineListings(): void { this.selectedListingSection.set(null); }

  protected mapLink(query: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  protected lodgeDetailLink(listing: ServiceListing): readonly string[] {
    return listing.slug ? ['/services', listing.slug] : ['/providers', listing.id];
  }

  protected ta(): boolean { return this.i18n.language() === 'ta'; }

  protected lodgePhoto(listing: ServiceListing): string | null {
    const media = [...listing.listing_media].sort((a, b) => a.sort_order - b.sort_order)
      .find(item => item.media_assets?.visibility === 'public' && item.media_assets.media_type === 'image');
    return media?.media_assets ? this.directory.imageUrl(media.media_assets.storage_path) : null;
  }

  protected lodgeLocation(listing: ServiceListing): string | null {
    const place = listing.listing_locations.find(location => location.coverage_type === 'based_here')?.locations;
    if (!place) return null;
    return this.ta() ? place.name_ta : place.name_en?.trim() || place.name_ta;
  }

  protected whatsappHref(topic: EnquiryTopic): string {
    const messages: Record<EnquiryTopic, { en: string; ta: string }> = {
      stay: {
        en: 'Hello CDM 360, I am planning a visit to Chidambaram. Could you help me find local accommodation options? I will confirm availability, rates and booking directly with the provider.',
        ta: 'வணக்கம் CDM 360, சிதம்பரத்திற்கு வரத் திட்டமிடுகிறேன். உள்ளூர் தங்குமிடங்களைத் தேட உதவ முடியுமா? கிடைப்பு, கட்டணம் மற்றும் முன்பதிவை வழங்குநரிடம் நேரடியாக உறுதிப்படுத்துவேன்.',
      },
      visit: {
        en: 'Hello CDM 360, I am planning a visit to Chidambaram and Pichavaram. Could you share general visitor guidance? I will check current schedules and access details with official sources.',
        ta: 'வணக்கம் CDM 360, சிதம்பரம் மற்றும் பிச்சாவரத்திற்கு வரத் திட்டமிடுகிறேன். பொதுவான பயணி வழிகாட்டுதலைப் பகிர முடியுமா? தற்போதைய நேரம் மற்றும் அணுகல் விவரங்களை அதிகாரப்பூர்வ ஆதாரங்களில் உறுதிப்படுத்துவேன்.',
      },
      dining: {
        en: 'Hello CDM 360, I am visiting Chidambaram. Could you help me find local dining listings? I will confirm menus and operating details directly.',
        ta: 'வணக்கம் CDM 360, சிதம்பரத்திற்கு வருகிறேன். உள்ளூர் உணவகப் பட்டியல்களைத் தேட உதவ முடியுமா? உணவு மற்றும் செயல்பாட்டு விவரங்களை நேரடியாக உறுதிப்படுத்துவேன்.',
      },
      help: {
        en: 'Hello CDM 360, I am planning a Chidambaram visit. I would like general help with local stays, transport or planning. I understand this is an enquiry, not a booking.',
        ta: 'வணக்கம் CDM 360, சிதம்பரம் பயணத்தைத் திட்டமிடுகிறேன். தங்குமிடம், போக்குவரத்து அல்லது பயணத் திட்டம் குறித்து பொதுவான உதவி வேண்டும். இது விசாரணை மட்டுமே, முன்பதிவு அல்ல என்பதைப் புரிந்துகொள்கிறேன்.',
      },
    };
    const message = this.i18n.language() === 'ta' ? messages[topic].ta : messages[topic].en;
    return `https://wa.me/919514636355?text=${encodeURIComponent(message)}`;
  }

  private async loadPublicProviderListings(): Promise<void> {
    this.listingsLoading.set(true);
    this.listingsError.set(false);
    try {
      await this.categoriesService.load();
      const [stays, dining] = await Promise.all([
        this.searchCategories(['hotels', 'lodge-stay']),
        this.searchCategories(['restaurants', 'vegetarian-restaurants', 'non-vegetarian-restaurants', 'mess-tiffin-services']),
      ]);
      this.stayListings.set(stays);
      this.diningListings.set(dining);
    } catch {
      this.listingsError.set(true);
    } finally {
      this.listingsLoading.set(false);
    }
  }

  private async searchCategories(slugs: readonly string[]): Promise<ServiceListing[]> {
    const categoryIds = [...new Set(slugs.map((slug) => this.categoryBySlug(slug)?.id).filter((id): id is string => Boolean(id)))];
    const pages = await Promise.all(categoryIds.map((id) => this.directory.search(id, null, '', 0)));
    const unique = new Map<string, ServiceListing>();
    for (const listing of pages.flatMap((page) => page.listings)) unique.set(listing.id, listing);
    return [...unique.values()];
  }

  private categoryBySlug(slug: string): ServiceCategory | null {
    const find = (items: readonly ServiceCategory[]): ServiceCategory | null => {
      for (const item of items) {
        if (item.slug === slug) return item;
        const child = find(item.subcategories);
        if (child) return child;
      }
      return null;
    };
    return find(this.categoriesService.categories());
  }

  private queryParams(categoryId: string | null, fallbackQuery: string): { category: string | null; q: string | null } {
    return categoryId ? { category: categoryId, q: null } : { category: null, q: fallbackQuery };
  }
}
