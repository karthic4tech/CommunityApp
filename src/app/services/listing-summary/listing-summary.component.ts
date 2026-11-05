import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServiceListing, contactHref } from '../../core/models/service-listing';
import { LanguageService } from '../../core/services/language.service';
import { ServiceDirectoryService } from '../../core/services/service-directory.service';

@Component({
  selector: 'app-listing-summary',
  imports: [RouterLink, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article [class.detail-view]="detail()">
      @if (detail()) {
        <h1 #heading tabindex="-1">{{ listing().service_providers.display_name }}</h1>
        <h2>{{ listing().title }}</h2>
      } @else {
        <h3><a [routerLink]="listing().slug ? ['/services', listing().slug] : ['/providers', listing().id]">{{ listing().title }}</a></h3>
        <p class="provider">{{ listing().service_providers.display_name }}</p>
        @if (listing().service_categories; as category) {
          <span class="category-label">{{ i18n.language() === 'ta' ? category.name_ta : category.name_en }}</span>
        }
      }
      @if (listing().service_providers.verification_status === 'verified') {
        <span class="verified" [attr.aria-label]="i18n.language() === 'ta' ? 'சரிபார்க்கப்பட்ட சேவை வழங்குநர்' : 'Verified provider'"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> {{ i18n.language() === 'ta' ? 'சரிபார்க்கப்பட்டது' : 'Verified' }}</span>
      }
      @if (visibleImages().length) {
        <div [class.gallery]="detail()">
          @for (image of visibleImages(); track image) {
            <div class="image"><img [ngSrc]="image" fill [alt]="listing().title" sizes="(max-width: 650px) 100vw, 33vw" (error)="hideImage(image)"></div>
          }
        </div>
      } @else {
        <div class="image-placeholder" role="img" [attr.aria-label]="i18n.language() === 'ta' ? 'படம் வழங்கப்படவில்லை' : 'No public image available'">
          <span aria-hidden="true">▧</span>
          <span>{{ i18n.language() === 'ta' ? 'பொது படம் இல்லை' : 'No public image available' }}</span>
        </div>
      }
      <p class="description">{{ listing().description }}</p>
      @if (detail() && listing().service_providers.description; as description) {
        <p class="description">{{ description }}</p>
      }
      @if (detail() && listing().service_providers.address; as address) {
        <p class="address"><strong>{{ i18n.language() === 'ta' ? 'முகவரி' : 'Address' }}:</strong> {{ address }}@if (listing().service_providers.postal_code) {, {{ listing().service_providers.postal_code }}}</p>
      }
      @if (places().length) {
        <ul class="places" [attr.aria-label]="i18n.language() === 'ta' ? 'இடங்கள்' : 'Locations'">
          @for (place of places(); track $index) {
            <li>{{ place.name }} — {{ place.based ? (i18n.language() === 'ta' ? 'அமைவிடம்' : 'Based here') : (i18n.language() === 'ta' ? 'சேவை பகுதி' : 'Serves here') }}</li>
          }
        </ul>
      } @else { <p>{{ i18n.language() === 'ta' ? 'இடம் குறிப்பிடப்படவில்லை' : 'Location not provided' }}</p> }
      <div class="actions">
        @for (contact of contacts(); track $index) {
          <a [href]="contact.href">
            {{ contact.label }}<span class="contact-value">{{ contact.value }}</span>
          </a>
        }
        @if (mapsHref(); as maps) { <a [href]="maps" target="_blank" rel="noopener noreferrer">{{ i18n.language() === 'ta' ? 'Google Maps வழிகள்' : 'Google Maps directions' }}</a> }
        @if (!detail()) {
          <a [routerLink]="listing().slug ? ['/services', listing().slug] : ['/providers', listing().id]">{{ i18n.language() === 'ta' ? 'விவரங்கள்' : 'View details' }}</a>
        }
      </div>
      @if (detail() && !contacts().length) {
        <p role="status">{{ i18n.language() === 'ta' ? 'பொது தொடர்பு விவரங்கள் இல்லை.' : 'No public contact details available.' }}</p>
      }
    </article>
  `,
  styles: `
    :host { display:block; min-width:0; }
    article { display:grid; align-content:start; height:100%; min-width:0; box-sizing:border-box; padding:1.1rem; background:#fff; border:1px solid var(--cdm-border); border-radius:14px; color:var(--cdm-navy); overflow-wrap:anywhere; }
    h1 { font-size:clamp(1.5rem,3vw,2rem); } h2,h3 { font-size:1.05rem; } h1,h3 { margin:0 0 .35rem; }
    h3 a { color:var(--cdm-navy); line-height:1.4; text-decoration:none; } h3 a:hover { color:var(--cdm-royal-blue); }
    a { color:var(--cdm-royal-blue); } .provider { margin:.1rem 0 .5rem; color:var(--cdm-muted); font-size:.84rem; font-weight:600; }
    .category-label { justify-self:start; margin-bottom:.45rem; padding:.25rem .55rem; border:1px solid var(--cdm-border); border-radius:999px; background:var(--cdm-page); color:var(--cdm-royal-blue); font-size:.72rem; font-weight:650; }
    .verified { display:inline-flex; align-items:center; justify-self:start; gap:.25rem; margin-bottom:.45rem; color:var(--cdm-royal-blue); font-size:.77rem; font-weight:700; }
    .description { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:3; white-space:pre-line; line-height:1.65; }
    p,.places { color:var(--cdm-muted); line-height:1.65; font-size:.86rem; } .address { white-space:pre-line; }
    .places { padding-left:1.15rem; } .image { position:relative; aspect-ratio:16/10; margin-block:.7rem; overflow:hidden; border-radius:10px; background:var(--cdm-page); } .image-placeholder { display:flex; align-items:center; justify-content:center; gap:.5rem; min-height:130px; margin-block:.7rem; border:1px dashed var(--cdm-border); border-radius:10px; background:var(--cdm-page); color:var(--cdm-muted); text-align:center; }
    img { object-fit:cover; border-radius:10px; } .gallery { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr)); gap:1rem; }
    .detail-view { padding:clamp(1.1rem,3vw,1.75rem); border-radius:16px; }
    .detail-view h1 { color:var(--cdm-navy); font-weight:760; }
    .detail-view h2 { color:var(--cdm-navy); margin-bottom:.75rem; }
    .actions { display:flex; flex-wrap:wrap; gap:.55rem; margin-top:.4rem; }
    .actions a { display:inline-flex; flex-direction:column; justify-content:center; min-height:42px; padding:.5rem .7rem; border:1px solid var(--cdm-border); border-radius:9px; color:var(--cdm-navy); background:#fff; text-decoration:none; font-size:.8rem; font-weight:650; }
    .actions a:hover { border-color:var(--cdm-green); background:var(--cdm-green-soft); }
    .contact-value { font-size:.8rem; font-weight:400; } a:focus-visible { outline:3px solid color-mix(in srgb, var(--cdm-green) 31%, transparent); outline-offset:3px; }
  `,
})
export class ListingSummaryComponent {
  readonly listing = input.required<ServiceListing>();
  readonly detail = input(false);
  protected readonly i18n = inject(LanguageService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly failedImages = signal<readonly string[]>([]);
  protected readonly images = computed(() => [...this.listing().listing_media]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter(media => media.media_assets?.visibility === 'public' && media.media_assets.media_type === 'image')
    .map(media => this.directory.imageUrl(media.media_assets!.storage_path))
    .filter((url): url is string => url !== null));
  protected readonly visibleImages = computed(() => {
    const failed = new Set(this.failedImages());
    const available = this.images().filter(image => !failed.has(image));
    return this.detail() ? available : available.slice(0, 1);
  });
  protected readonly mapsHref = computed(() => {
    const { latitude, longitude } = this.listing().service_providers;
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  });
  protected readonly places = computed(() => this.listing().listing_locations.flatMap(place => place.locations ? [{
    name: this.i18n.language() === 'ta' ? place.locations.name_ta : place.locations.name_en ?? place.locations.name_ta,
    based: place.coverage_type === 'based_here',
  }] : []));
  protected readonly contacts = computed(() => {
    const provider = this.listing().service_providers;
    const rows = [...this.listing().listing_contacts].filter(contact => contact.is_public).sort((a, b) => a.sort_order - b.sort_order);
    if (provider.public_email) rows.push({ contact_type: 'email', contact_value: provider.public_email, is_public: true, sort_order: 0 });
    if (provider.website_url) rows.push({ contact_type: 'website', contact_value: provider.website_url, is_public: true, sort_order: 0 });
    const seen = new Set<string>();
    return rows.flatMap(contact => {
      const href = contactHref(contact.contact_type, contact.contact_value);
      if (!href || seen.has(href)) return [];
      seen.add(href);
      const tamil = this.i18n.language() === 'ta';
      const labels = {
         phone: tamil ? 'அழைக்க' : 'Call', whatsapp: tamil ? 'WhatsApp விசாரணை' : 'Enquire via WhatsApp',
         email: tamil ? 'மின்னஞ்சல் விசாரணை' : 'Enquire by email', website: tamil ? 'இணையதளம்' : 'Website',
         facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', other: '',
      };
      return [{ href, value: contact.contact_value, label: labels[contact.contact_type] }];
    });
  });

  constructor() {
    afterRenderEffect(() => this.heading()?.nativeElement.focus({ preventScroll: true }));
  }

  protected hideImage(image: string): void { this.failedImages.update(images => [...images, image]); }
}
