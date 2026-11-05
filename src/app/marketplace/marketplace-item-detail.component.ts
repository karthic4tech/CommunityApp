import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarketplaceListingCardComponent } from './marketplace-listing-card.component';
import { MarketplaceListing } from './marketplace.models';
import { MarketplaceService } from './marketplace.service';

@Component({
  selector: 'app-marketplace-item-detail',
  imports: [RouterLink, CurrencyPipe, DatePipe, MarketplaceListingCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mp-page container-xl" [attr.aria-busy]="loading()">
      <nav class="mp-breadcrumb" aria-label="Breadcrumb"><a routerLink="/marketplace">Marketplace</a><i class="bi bi-chevron-right" aria-hidden="true"></i>@if (listing()?.category; as category) { <a [routerLink]="['/marketplace/category', category.slug]">{{ category.name }}</a><i class="bi bi-chevron-right" aria-hidden="true"></i> }<span>{{ listing()?.title || 'Listing' }}</span></nav>
      @if (loading()) { <p class="mp-state" role="status">Loading listing…</p> }
      @else if (error()) { <div class="mp-empty"><i class="bi bi-exclamation-circle" aria-hidden="true"></i><h1>Listing unavailable</h1><p role="alert">{{ error() }}</p><a routerLink="/marketplace">Return to Marketplace</a></div> }
      @else if (listing(); as item) {
        <div class="mp-detail-layout">
          <section class="mp-gallery" aria-label="Product photos">
            @if (gallery().length) {
              <div class="mp-gallery-main"><img [src]="gallery()[activeImage()]?.url" [alt]="gallery()[activeImage()]?.alt_text || item.title"><button type="button" class="mp-gallery-arrow previous" aria-label="Previous photo" [disabled]="activeImage() === 0" (click)="showImage(activeImage() - 1)"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><button type="button" class="mp-gallery-arrow next" aria-label="Next photo" [disabled]="activeImage() >= gallery().length - 1" (click)="showImage(activeImage() + 1)"><i class="bi bi-chevron-right" aria-hidden="true"></i></button><button type="button" class="mp-fullscreen" (click)="fullScreen.set(true)" aria-label="Open photo full screen"><i class="bi bi-arrows-fullscreen" aria-hidden="true"></i></button></div>
              @if (gallery().length > 1) { <div class="mp-thumbnails">@for (image of gallery(); track image.id; let i = $index) { <button type="button" [class.active]="activeImage() === i" [attr.aria-label]="'Show product photo ' + (i + 1)" (click)="showImage(i)"><img [src]="image.url" [alt]="image.alt_text || item.title" loading="lazy"></button> }</div> }
            } @else { <div class="mp-gallery-placeholder"><i class="bi bi-image" aria-hidden="true"></i><span>No product photos</span></div> }
          </section>

          <aside class="mp-item-summary">
            @if (item.status !== 'published') { <p class="mp-preview-notice"><i class="bi bi-eye" aria-hidden="true"></i> Seller preview · {{ item.status.replace('_',' ') }}</p> }
            <div class="mp-item-topline">@if (item.is_featured) { <span class="mp-featured-inline"><i class="bi bi-stars" aria-hidden="true"></i> Featured</span> }@if (item.status === 'published') { <button type="button" class="mp-save-action" [class.saved]="saved()" [attr.aria-pressed]="saved()" (click)="toggleFavourite()"><i class="bi" [class.bi-heart]="!saved()" [class.bi-heart-fill]="saved()" aria-hidden="true"></i>{{ saved() ? 'Saved' : 'Save' }}</button> }</div>
            <h1>{{ item.title }}</h1><p class="mp-item-category">{{ item.category?.name }}@if (item.subcategory) { <span> / {{ item.subcategory.name }}</span> }</p>
            <div class="mp-item-price">{{ item.price | currency:'INR':'symbol':'1.0-0' }}@if (item.is_negotiable) { <span>Negotiable</span> }</div>
            <div class="mp-item-meta"><span class="mp-condition">{{ conditionLabel(item.condition) }}</span><span><i class="bi bi-geo-alt" aria-hidden="true"></i> {{ item.location?.name_en || item.location?.name_ta || 'Location shared by seller' }}</span><span><i class="bi bi-clock" aria-hidden="true"></i> Listed {{ (item.published_at || item.created_at) | date:'mediumDate' }}</span></div>
            <section class="mp-seller-panel"><p class="mp-eyebrow">SELLER</p><strong>{{ item.seller_display_name }}</strong><small>CDM 360 community seller</small>
              @if (item.status === 'published') {
              <div class="mp-contact-actions">
                @if (item.contact_method === 'phone' && phoneHref(item.seller_contact_phone); as href) { <a class="mp-contact-primary" [href]="href"><i class="bi bi-telephone" aria-hidden="true"></i> Call Seller</a> }
                @if (item.contact_method === 'whatsapp' && whatsappHref(item.seller_contact_phone); as href) { <a class="mp-contact-primary" [href]="href" target="_blank" rel="noopener noreferrer"><i class="bi bi-whatsapp" aria-hidden="true"></i> WhatsApp Seller</a> }
              <button type="button" class="mp-contact-secondary" (click)="openEnquiry()"><i class="bi bi-chat-dots" aria-hidden="true"></i> Send Enquiry</button>
              </div>
              @if (showEnquiry()) { <form class="mp-enquiry-form" (submit)="sendEnquiry($event, enquiryText.value)"><label for="item-enquiry">Your message</label><textarea #enquiryText id="item-enquiry" rows="3" maxlength="2000" placeholder="Hi, is this item still available?"></textarea><button type="submit" [disabled]="enquirySending()">{{ enquirySending() ? 'Sending…' : 'Send message' }}</button>@if (enquiryMessage()) { <p role="status">{{ enquiryMessage() }}</p> }@if (enquiryError()) { <p role="alert">{{ enquiryError() }}</p> }</form> }
              } @else { <p class="mp-preview-help">Contact actions are hidden until this listing is published.</p> }
            </section>
            @if (item.status === 'published') {
            <button type="button" class="mp-report-link" (click)="reportOpen.set(!reportOpen())"><i class="bi bi-flag" aria-hidden="true"></i> Report this listing</button>
            @if (reportOpen()) { <form class="mp-report-form" (submit)="submitReport($event, reportReason.value, reportDescription.value)"><label for="report-reason">Reason</label><select #reportReason id="report-reason"><option value="scam_or_suspicious">Scam or suspicious</option><option value="prohibited_item">Prohibited item</option><option value="misleading">Misleading information</option><option value="duplicate">Duplicate listing</option><option value="wrong_category">Wrong category</option><option value="other">Other</option></select><label for="report-description">Details (optional)</label><textarea #reportDescription id="report-description" rows="2" maxlength="2000"></textarea><button type="submit" [disabled]="reportSending()">{{ reportSending() ? 'Sending…' : 'Submit report' }}</button>@if (reportMessage()) { <p role="status">{{ reportMessage() }}</p> }@if (reportError()) { <p role="alert">{{ reportError() }}</p> }</form> }
            }
          </aside>
        </div>

        <section class="mp-detail-description" aria-labelledby="mp-description-title"><p class="mp-eyebrow">PRODUCT DETAILS</p><h2 id="mp-description-title">Description</h2><p class="mp-long-description">{{ item.description || 'The seller has not added a description.' }}</p>
          @if (item.attributes?.length) { <h3>Specifications</h3><dl class="mp-attributes">@for (attribute of item.attributes; track attribute.attribute_name) { <div><dt>{{ attribute.attribute_name }}</dt><dd>{{ attribute.attribute_value }}</dd></div> }</dl> }
        </section>
        <aside class="mp-safety"><i class="bi bi-shield-check" aria-hidden="true"></i><div><strong>Buy safely</strong><p>CDM 360 helps buyers and sellers connect. Verify the product and seller independently before making a payment or completing a transaction. CDM 360 does not guarantee product quality or ownership.</p></div></aside>
        @if (sellerListings().length) { <section class="mp-related"><header class="mp-section-head"><div><p class="mp-eyebrow">MORE FROM THIS SELLER</p><h2>Other local listings</h2></div></header><div class="mp-product-grid">@for (other of sellerListings(); track other.id) { <app-marketplace-listing-card [listing]="other" />}</div></section> }
        @if (item.status === 'published') { <div class="mp-mobile-contact-bar">@if (item.contact_method === 'phone' && phoneHref(item.seller_contact_phone); as href) { <a [href]="href"><i class="bi bi-telephone" aria-hidden="true"></i> Call</a> }@if (item.contact_method === 'whatsapp' && whatsappHref(item.seller_contact_phone); as href) { <a [href]="href" target="_blank" rel="noopener noreferrer"><i class="bi bi-whatsapp" aria-hidden="true"></i> WhatsApp</a> }<button type="button" (click)="openEnquiry()"><i class="bi bi-chat-dots" aria-hidden="true"></i> Enquire</button></div> }
      }
      @if (fullScreen() && gallery().length) { <div class="mp-lightbox" role="dialog" aria-modal="true" aria-label="Product image viewer"><button type="button" class="mp-lightbox-close" aria-label="Close viewer" (click)="fullScreen.set(false)"><i class="bi bi-x-lg" aria-hidden="true"></i></button><button type="button" aria-label="Previous photo" [disabled]="activeImage() === 0" (click)="showImage(activeImage() - 1)"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><img [src]="gallery()[activeImage()]?.url" [alt]="gallery()[activeImage()]?.alt_text || 'Product image'"><button type="button" aria-label="Next photo" [disabled]="activeImage() >= gallery().length - 1" (click)="showImage(activeImage() + 1)"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div> }
    </main>
  `,
})
export class MarketplaceItemDetailComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly listing = signal<MarketplaceListing | null>(null);
  protected readonly sellerListings = signal<MarketplaceListing[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly activeImage = signal(0);
  protected readonly fullScreen = signal(false);
  protected readonly showEnquiry = signal(false);
  protected readonly enquirySending = signal(false);
  protected readonly enquiryMessage = signal<string | null>(null);
  protected readonly enquiryError = signal<string | null>(null);
  protected readonly reportOpen = signal(false);
  protected readonly reportSending = signal(false);
  protected readonly reportMessage = signal<string | null>(null);
  protected readonly reportError = signal<string | null>(null);
  protected readonly gallery = () => this.listing()?.images ?? [];

  ngOnInit(): void { void this.load(); }

  private async load(): Promise<void> {
    this.loading.set(true); this.error.set(null);
    try {
      const params = this.route.snapshot.paramMap;
      let item = await this.marketplace.detailByRoute(params.get('id') ?? '', params.get('slug') ?? '');
      if (item && item.status !== 'published' && item.seller_id !== this.marketplace.currentUserId() && !this.marketplace.hasAdminAccess()) item = null;
      this.listing.set(item);
      if (!item) { this.error.set('This listing is no longer available.'); return; }
      if (item.status === 'published') this.marketplace.rememberViewed(item.id);
      if (this.marketplace.currentUserId()) {
        try { this.saved.set((await this.marketplace.favoriteIds()).has(item.id)); } catch { this.saved.set(false); }
      }
      const related = await this.marketplace.search({ sellerId: item.seller_id, sort: 'newest', pageSize: 5 });
      this.sellerListings.set(related.items.filter(row => row.id !== item.id));
    } catch { this.error.set('Unable to load this listing. Please try again.'); }
    finally { this.loading.set(false); }
  }

  protected conditionLabel(value: MarketplaceListing['condition']): string {
    return ({ brand_new: 'Brand New', like_new: 'Like New', gently_used: 'Gently Used', good: 'Good', fair: 'Fair', for_parts: 'For Parts / Repair' } as const)[value];
  }
  protected showImage(index: number): void { this.activeImage.set(Math.max(0, Math.min(index, this.gallery().length - 1))); }
  protected phoneHref(phone: string | null): string | null { const digits = phone?.replace(/[^+\d]/g, '') ?? ''; return /^\+?\d{7,15}$/.test(digits) ? `tel:${digits}` : null; }
  protected whatsappHref(phone: string | null): string | null { const digits = phone?.replace(/\D/g, '') ?? ''; return /^\d{7,15}$/.test(digits) ? `https://wa.me/${digits}` : null; }

  protected async toggleFavourite(): Promise<void> {
    const item = this.listing(); if (!item) return;
    if (!this.marketplace.currentUserId()) { void this.router.navigate(['/auth/sign-in'], { queryParams: { returnUrl: this.router.url } }); return; }
    try { await this.marketplace.toggleFavourite(item.id, this.saved()); this.saved.update(value => !value); }
    catch { this.error.set('Unable to update your saved listings. Please try again.'); }
  }

  protected openEnquiry(): void {
    this.showEnquiry.set(true);
    this.document.defaultView?.requestAnimationFrame(() => {
      const field = this.document.getElementById('item-enquiry');
      field?.scrollIntoView({ behavior: this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      field?.focus({ preventScroll: true });
    });
  }

  protected async sendEnquiry(event: Event, message: string): Promise<void> {
    event.preventDefault(); const item = this.listing(); if (!item) return;
    if (!this.marketplace.currentUserId()) { void this.router.navigate(['/auth/sign-in'], { queryParams: { returnUrl: this.router.url } }); return; }
    this.enquirySending.set(true); this.enquiryError.set(null); this.enquiryMessage.set(null);
    try { await this.marketplace.createEnquiry(item, message); this.enquiryMessage.set('Your enquiry has been sent to the seller.'); }
    catch (error) { this.enquiryError.set(error instanceof Error ? error.message : 'Unable to send your enquiry.'); }
    finally { this.enquirySending.set(false); }
  }

  protected async submitReport(event: Event, reason: string, description: string): Promise<void> {
    event.preventDefault(); const item = this.listing(); if (!item) return;
    if (!this.marketplace.currentUserId()) { void this.router.navigate(['/auth/sign-in'], { queryParams: { returnUrl: this.router.url } }); return; }
    this.reportSending.set(true); this.reportError.set(null); this.reportMessage.set(null);
    try { await this.marketplace.reportListing(item.id, reason, description); this.reportMessage.set('Thank you. The report has been sent to our moderation team.'); }
    catch (error) { this.reportError.set(error instanceof Error ? error.message : 'Unable to submit the report.'); }
    finally { this.reportSending.set(false); }
  }
}
