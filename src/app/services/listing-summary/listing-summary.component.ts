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
    <article>
      @if (detail()) {
        <h1 #heading tabindex="-1">{{ listing().service_providers.display_name }}</h1>
        <h2>{{ listing().title }}</h2>
      } @else {
        <h3><a [routerLink]="['/providers', listing().id]">{{ listing().title }}</a></h3>
        <p class="provider">{{ listing().service_providers.display_name }}</p>
      }
      @if (listing().service_providers.verification_status === 'verified') {
        <span class="verified" aria-label="Verified provider">✓ {{ i18n.language() === 'ta' ? 'சரிபார்க்கப்பட்டது' : 'Verified' }}</span>
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
        @if (!detail()) {
          <a [routerLink]="['/providers', listing().id]">{{ i18n.language() === 'ta' ? 'விவரங்கள்' : 'View details' }}</a>
        }
      </div>
      @if (detail() && !contacts().length) {
        <p role="status">{{ i18n.language() === 'ta' ? 'பொது தொடர்பு விவரங்கள் இல்லை.' : 'No public contact details available.' }}</p>
      }
    </article>
  `,
  styles: `
    :host { display:block; min-width:0; }
    article { height:100%; box-sizing:border-box; padding:1.25rem; background:white; border:1px solid #dfe7e2; border-radius:16px; color:#173f32; overflow-wrap:anywhere; }
    h1 { font-size:clamp(1.5rem,3vw,2rem); } h2,h3 { font-size:1.15rem; } h1,h3 { margin:0 0 .75rem; }
    a { color:#075541; } .provider { margin:.15rem 0 .65rem; font-weight:650; color:#244f3e; } .verified { display:inline-flex; align-items:center; gap:.25rem; margin-bottom:.5rem; color:#176044; font-size:.82rem; font-weight:700; }
    .description { white-space:pre-line; line-height:1.8; } p,.places { color:#52665b; line-height:1.7; }
    .places { padding-left:1.25rem; } .image { position:relative; aspect-ratio:4/3; margin-block:1rem; } .image-placeholder { display:flex; align-items:center; justify-content:center; gap:.5rem; min-height:130px; margin-block:1rem; border:1px dashed #b8c9bf; border-radius:10px; background:#f7faf7; color:#52665b; text-align:center; }
    img { object-fit:contain; border-radius:10px; } .gallery { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr)); gap:1rem; }
    .actions { display:flex; flex-wrap:wrap; gap:.6rem; } .actions a { display:inline-flex; flex-direction:column; justify-content:center; min-height:44px; padding:.5rem .75rem; border:1px solid #b8c9bf; border-radius:9px; text-decoration:none; font-weight:600; }
    .contact-value { font-size:.8rem; font-weight:400; } a:focus-visible { outline:3px solid #176044; outline-offset:3px; }
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
        email: tamil ? 'மின்னஞ்சல் விசாரணை' : 'Enquire by email', website: tamil ? 'இணையதளம்' : 'Website', other: '',
      };
      return [{ href, value: contact.contact_value, label: labels[contact.contact_type] }];
    });
  });

  constructor() {
    afterRenderEffect(() => this.heading()?.nativeElement.focus({ preventScroll: true }));
  }

  protected hideImage(image: string): void { this.failedImages.update(images => [...images, image]); }
}
