import { CurrencyPipe, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, PLATFORM_ID, afterRenderEffect, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ListingContact, ServiceListing, contactHref } from '../../core/models/service-listing';
import { LanguageService } from '../../core/services/language.service';
import { ServiceDirectoryService } from '../../core/services/service-directory.service';
import { MediaService } from '../../core/services/media.service';
import { MediaGalleryItem } from '../../core/models/media.models';
import { googleMapsDirectionsUrl, validateGoogleMapsLocationUrl } from '../../core/models/service-location';
import { MediaPreviewComponent } from '../../shared/components/media-preview/media-preview.component';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-listing-summary',
  imports: [RouterLink, NgOptimizedImage, MediaPreviewComponent, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article [class.detail-view]="detail()" [class.compact-view]="compact()" [class.horizontal-view]="horizontal()">
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
        <div [class.gallery]="detail()" [class.horizontal-media]="horizontal()">
          @for (image of visibleImages(); track image) {
             <button type="button" class="image image-button" [attr.aria-label]="i18n.language() === 'ta' ? 'சேவை படத்தைப் பார்க்கவும்' : 'View service image'" (click)="openPreview(image)"><img [ngSrc]="image" fill [alt]="listing().title" sizes="(max-width: 650px) 100vw, 33vw" (error)="hideImage(image)"></button>
          }
        </div>
      } @else {
        <div class="image-placeholder" role="img" [attr.aria-label]="i18n.language() === 'ta' ? 'படம் வழங்கப்படவில்லை' : 'No public image available'">
          <span aria-hidden="true">▧</span>
          <span>{{ i18n.language() === 'ta' ? 'பொது படம் இல்லை' : 'No public image available' }}</span>
        </div>
      }
      <p class="description">{{ listing().description }}</p>
      @if (detail() && listing().room_amenities?.length) { <div class="lodge-amenities" aria-label="Room amenities"><strong>Room amenities</strong><ul>@for (amenity of listing().room_amenities; track amenity) { <li>{{ amenity }}</li> }</ul></div> }
      @if (detail() && listing().indicative_room_price !== null && listing().indicative_room_price !== undefined) { <p class="lodge-price"><strong>Indicative room price:</strong> {{ listing().indicative_room_price | currency:'INR':'symbol':'1.0-0' }} / night <span>Confirm current rates with the lodge.</span></p> }
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
          @if (contact.type === 'phone') {
            <button type="button" class="contact-trigger" [attr.aria-label]="(i18n.language() === 'ta' ? 'தொடர்பு முறையைத் தேர்ந்தெடுக்கவும்: ' : 'Choose how to contact: ') + contact.value" (click)="openContactOptions(contact)">
              {{ contact.label }}<span class="contact-value">{{ contact.value }}</span>
            </button>
          } @else {
            <a [href]="contact.href" (click)="trackContactClick(contact.type)">
              {{ contact.label }}<span class="contact-value">{{ contact.value }}</span>
            </a>
          }
        }
        @if (detail() && mapsHref(); as maps) { <a [href]="maps" target="_blank" rel="noopener noreferrer">Get Directions / வழிகாட்டுதலைப் பெறுக</a> }
        @if (!detail()) {
          <a [routerLink]="listing().slug ? ['/services', listing().slug] : ['/providers', listing().id]">{{ i18n.language() === 'ta' ? 'விவரங்கள்' : 'View details' }}</a>
        }
      </div>
      <dialog #contactDialog class="contact-dialog" [attr.aria-labelledby]="'contact-options-title-' + listing().id" [attr.aria-describedby]="'contact-options-description-' + listing().id" (close)="onContactDialogClosed()">
        @if (contactOptions(); as options) {
          <h2 [id]="'contact-options-title-' + listing().id">{{ i18n.language() === 'ta' ? 'தொடர்பு கொள்ளுங்கள்' : 'Contact this service' }}</h2>
          <p [id]="'contact-options-description-' + listing().id">{{ i18n.language() === 'ta' ? 'அழைக்கவா அல்லது WhatsApp மூலம் செய்தி அனுப்பவா?' : 'Would you like to call or message on WhatsApp?' }}</p>
          <div class="contact-dialog__actions">
            <a class="contact-dialog__action" [href]="options.callHref" (click)="trackContactClick('phone'); closeContactOptions()"><i class="bi bi-telephone" aria-hidden="true"></i><span>{{ i18n.language() === 'ta' ? 'அழைக்க' : 'Call' }}</span><span class="contact-value">{{ options.phone }}</span></a>
            @if (options.whatsappHref) {
              <a class="contact-dialog__action whatsapp-action" [href]="options.whatsappHref" target="_blank" rel="noopener noreferrer" (click)="trackContactClick('whatsapp'); closeContactOptions()"><i class="bi bi-whatsapp" aria-hidden="true"></i><span>WhatsApp</span><span class="contact-value">{{ options.whatsappPhone }}</span></a>
            }
          </div>
          <button type="button" class="contact-dialog__cancel" (click)="closeContactOptions()">{{ i18n.language() === 'ta' ? 'ரத்து' : 'Cancel' }}</button>
        }
      </dialog>
      @if (detail() && !contacts().length) {
        <p role="status">{{ i18n.language() === 'ta' ? 'பொது தொடர்பு விவரங்கள் இல்லை.' : 'No public contact details available.' }}</p>
      }
      @if (previewIndex() !== null && previewItems().length) {
        <app-media-preview [items]="previewItems()" [index]="previewIndex()!" (closed)="closePreview()" />
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
      .places { padding-left:1.15rem; } .image { position:relative; aspect-ratio:16/10; margin-block:.7rem; overflow:hidden; border-radius:10px; background:var(--cdm-page); } .image-placeholder { display:flex; align-items:center; justify-content:center; gap:.5rem; min-height:54px; margin-block:.45rem; padding:.6rem; border:1px dashed var(--cdm-border); border-radius:10px; background:var(--cdm-page); color:var(--cdm-muted); font-size:.75rem; text-align:center; } .detail-view .image-placeholder { min-height:130px; margin-block:.7rem; }
      .lodge-amenities { margin:.6rem 0; color:var(--cdm-navy); font-size:.86rem; }.lodge-amenities ul { display:flex; flex-wrap:wrap; gap:.4rem; margin:.4rem 0 0; padding:0; list-style:none; }.lodge-amenities li { padding:.28rem .5rem; border:1px solid var(--cdm-border); border-radius:999px; background:var(--cdm-page); font-size:.75rem; }.lodge-price { display:flex; flex-wrap:wrap; gap:.35rem; color:var(--cdm-navy); font-size:.86rem; }.lodge-price span { width:100%; color:var(--cdm-muted); font-size:.76rem; }
     img { object-fit:cover; border-radius:10px; } .image-button { display:block; width:100%; padding:0; border:0; color:inherit; cursor:zoom-in; text-align:initial; } .image-button:focus-visible { outline:3px solid var(--cdm-royal-blue); outline-offset:3px; } .gallery { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr)); gap:1rem; }
      .horizontal-view { grid-template-columns:150px minmax(0,1fr); grid-template-areas:"image title" "image provider" "image category" "image verified" "image description" "image places" "image actions"; align-content:start; align-items:start; gap:.3rem .8rem; padding:.7rem; }
      .horizontal-view h3 { grid-area:title; margin:0; }.horizontal-view .provider { grid-area:provider; margin:0; }.horizontal-view .category-label { grid-area:category; margin:0; }.horizontal-view .verified { grid-area:verified; margin:0; }.horizontal-view .horizontal-media,.horizontal-view .image-placeholder { grid-area:image; align-self:start; width:100%; min-width:0; margin:0; }.horizontal-view .image { width:100%; aspect-ratio:4/5; margin:0; }.horizontal-view .image-placeholder { min-height:150px; }.horizontal-view .description { grid-area:description; margin:.1rem 0; line-height:1.45; -webkit-line-clamp:3; }.horizontal-view .places,.horizontal-view>p:not(.provider):not(.description) { grid-area:places; margin:.1rem 0; font-size:.78rem; line-height:1.4; }.horizontal-view .places { padding-left:1rem; }.horizontal-view .actions { grid-area:actions; margin:0; }.horizontal-view .actions a,.horizontal-view .contact-trigger { min-height:38px; padding:.4rem .55rem; font-size:.74rem; }
      @media(max-width:420px) { .horizontal-view { grid-template-columns:105px minmax(0,1fr); gap:.3rem .6rem; }.horizontal-view .image-placeholder { min-height:125px; }.horizontal-view .category-label { font-size:.66rem; } }
      .detail-view { padding:clamp(1.1rem,3vw,1.75rem); border-radius:16px; }
     .detail-view h1 { color:var(--cdm-navy); font-weight:760; }
     .detail-view h2 { color:var(--cdm-navy); margin-bottom:.75rem; }
     .detail-view .gallery { width:min(100%,760px); }
     .detail-view .image { max-height:475px; }
     .detail-view .image img { object-fit:contain; background:#fff; }
     .actions { display:flex; flex-wrap:wrap; gap:.55rem; margin-top:.4rem; }
     .actions a, .contact-trigger { display:inline-flex; flex-direction:column; justify-content:center; min-height:42px; padding:.5rem .7rem; border:1px solid var(--cdm-border); border-radius:9px; color:var(--cdm-navy); background:#fff; text-decoration:none; font:inherit; font-size:.8rem; font-weight:650; text-align:start; cursor:pointer; }
     .actions a:hover, .contact-trigger:hover { border-color:var(--cdm-green); background:var(--cdm-green-soft); }
     .contact-value { font-size:.8rem; font-weight:400; }
     .contact-dialog { width:min(92vw, 27rem); max-width:27rem; padding:1.25rem; border:1px solid var(--cdm-border); border-radius:14px; color:var(--cdm-navy); background:#fff; box-shadow:0 18px 55px rgb(0 32 80 / .22); }
     .contact-dialog::backdrop { background:rgb(0 32 80 / .48); }
     .contact-dialog h2 { margin:0 0 .4rem; font-size:1.2rem; }
     .contact-dialog p { margin:0 0 1rem; }
     .contact-dialog__actions { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:.6rem; }
     .contact-dialog__action { display:flex; flex-direction:column; align-items:flex-start; justify-content:center; min-height:58px; padding:.65rem .75rem; border:1px solid var(--cdm-border); border-radius:10px; color:var(--cdm-navy); background:#fff; text-decoration:none; font-size:.85rem; font-weight:700; }
     .contact-dialog__action i { color:var(--cdm-royal-blue); font-size:1.1rem; }
     .contact-dialog__action.whatsapp-action i { color:#0DA68C; }
     .contact-dialog__action:hover { border-color:var(--cdm-green); background:var(--cdm-green-soft); }
     .contact-dialog__cancel { display:block; min-height:44px; margin:.85rem 0 0 auto; padding:.45rem .75rem; border:1px solid var(--cdm-border); border-radius:8px; color:var(--cdm-navy); background:#fff; font:inherit; font-weight:650; cursor:pointer; }
     :is(a,button):focus-visible { outline:3px solid color-mix(in srgb, var(--cdm-green) 45%, transparent); outline-offset:3px; }
  `,
})
export class ListingSummaryComponent {
  readonly listing = input.required<ServiceListing>();
  readonly detail = input(false);
  readonly compact = input(false);
  readonly horizontal = input(false);
  readonly hidePhoneContacts = input(false);
  protected readonly i18n = inject(LanguageService);
  protected readonly analytics = inject(AnalyticsService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly media = inject(MediaService);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly failedImages = signal<readonly string[]>([]);
  private readonly fallbackImages = signal<readonly string[]>([]);
  protected readonly images = computed(() => {
    const embedded = [...this.listing().listing_media]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter(media => media.media_assets?.visibility === 'public' && media.media_assets.media_type === 'image')
    .map(media => this.directory.imageUrl(media.media_assets!.storage_path))
    .filter((url): url is string => url !== null);
    return embedded.length ? embedded : this.fallbackImages();
  });
  protected readonly visibleImages = computed(() => {
    const failed = new Set(this.failedImages());
    const available = this.images().filter(image => !failed.has(image));
    return this.detail() ? available : available.slice(0, 1);
  });
  protected readonly previewItems = computed<MediaGalleryItem[]>(() => this.visibleImages().map((url, index) => ({
    asset: { id: `${this.listing().id}-image-${index}`, original_filename: null, stored_filename: null, bucket_name: null, storage_path: url, media_type: 'image', mime_type: null, file_size_bytes: null, file_extension: null, width: null, height: null, alt_text: this.listing().title, caption: null, visibility: 'public', upload_status: 'uploaded', owner_user_id: null, created_at: '', updated_at: '', deleted_at: null },
    url, fileName: this.listing().title, size: null, alt: this.listing().title, primary: index === 0,
  })));
  protected readonly previewIndex = signal<number | null>(null);
  protected readonly contactOptions = signal<{ phone: string; callHref: string; whatsappPhone: string; whatsappHref: string | null } | null>(null);
  private readonly contactDialog = viewChild<ElementRef<HTMLDialogElement>>('contactDialog');
  protected readonly mapsHref = computed(() => {
    const { latitude, longitude } = this.listing().service_providers;
    return googleMapsDirectionsUrl(latitude, longitude)
      ?? validateGoogleMapsLocationUrl(this.listing().service_providers.google_maps_url ?? '')?.url
      ?? null;
  });
  protected readonly places = computed(() => this.listing().listing_locations.flatMap(place => place.locations ? [{
    name: this.i18n.language() === 'ta' ? place.locations.name_ta : place.locations.name_en ?? place.locations.name_ta,
    based: place.coverage_type === 'based_here',
  }] : []));
  protected readonly contacts = computed(() => {
    const provider = this.listing().service_providers;
    const rows = [...this.listing().listing_contacts]
      .filter(contact => contact.is_public && !(this.hidePhoneContacts() && ['phone', 'whatsapp'].includes(contact.contact_type)))
      .sort((a, b) => a.sort_order - b.sort_order);
    const hasPhone = rows.some(contact => contact.contact_type === 'phone' && contactHref('phone', contact.contact_value) !== null);
    if (provider.public_email) rows.push({ contact_type: 'email', contact_value: provider.public_email, is_public: true, sort_order: 0 });
    if (provider.website_url) rows.push({ contact_type: 'website', contact_value: provider.website_url, is_public: true, sort_order: 0 });
    const seen = new Set<string>();
    return rows.flatMap(contact => {
      if (hasPhone && contact.contact_type === 'whatsapp') return [];
      const href = contactHref(contact.contact_type, contact.contact_value);
      if (!href || seen.has(href)) return [];
      seen.add(href);
      const tamil = this.i18n.language() === 'ta';
      const labels = {
          phone: tamil ? 'அழை / WhatsApp' : 'Call or WhatsApp', whatsapp: tamil ? 'WhatsApp விசாரணை' : 'Enquire via WhatsApp',
         email: tamil ? 'மின்னஞ்சல் விசாரணை' : 'Enquire by email', website: tamil ? 'இணையதளம்' : 'Website',
         facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', other: '',
      };
      return [{ href, value: contact.contact_value, label: labels[contact.contact_type], type: contact.contact_type }];
    });
  });

  constructor() {
    afterRenderEffect(() => this.heading()?.nativeElement.focus({ preventScroll: true }));
    effect(() => {
      const listing = this.listing();
      const hasEmbeddedImage = listing.listing_media.some((media) => media.media_assets?.visibility === 'public' && media.media_assets.media_type === 'image');
      if (hasEmbeddedImage || !isPlatformBrowser(this.platformId)) { this.fallbackImages.set([]); return; }
      void this.loadFallbackImages(listing.id);
    });
  }

  private async loadFallbackImages(listingId: string): Promise<void> {
    try {
      const gallery = await this.media.getMediaGallery('listing', listingId);
      if (this.listing().id !== listingId) return;
      this.fallbackImages.set(gallery.filter((item) => item.asset.visibility === 'public').map((item) => item.url));
    } catch {
      this.fallbackImages.set([]);
    }
  }

  protected hideImage(image: string): void { this.failedImages.update(images => [...images, image]); }
  protected openPreview(image: string): void { const index = this.visibleImages().indexOf(image); if (index >= 0) this.previewIndex.set(index); }
  protected closePreview(): void { this.previewIndex.set(null); }
  protected openContactOptions(contact: { type: ListingContact['contact_type']; value: string; href: string }): void {
    if (contact.type !== 'phone') return;
    const whatsappContact = this.listing().listing_contacts.find(item => item.is_public && item.contact_type === 'whatsapp');
    const whatsappPhone = whatsappContact?.contact_value ?? contact.value;
    this.contactOptions.set({ phone: contact.value, callHref: contact.href, whatsappPhone, whatsappHref: contactHref('whatsapp', whatsappPhone) });
    const dialog = this.contactDialog()?.nativeElement;
    if (dialog && !dialog.open) dialog.showModal();
  }
  protected closeContactOptions(): void { this.contactDialog()?.nativeElement.close(); }
  protected onContactDialogClosed(): void { this.contactOptions.set(null); }

  protected trackContactClick(type: ListingContact['contact_type']): void {
    const contactMethod = type === 'phone' || type === 'whatsapp' || type === 'email' || type === 'website'
      ? type
      : 'other';
    this.analytics.track('service_contact_click', {
      public_listing_id: this.listing().id,
      service_category: this.listing().service_categories?.slug,
      contact_method: contactMethod,
      content_language: this.i18n.language(),
    });
  }
}
