import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProfileService } from '../core/services/profile.service';
import { DirectoryLocation, locationSearchOptions } from '../core/models/service-listing';
import { MarketplaceAttributeDefinition, MarketplaceCategory, MarketplaceListing, MarketplaceListingAttribute, MarketplaceListingImage, MarketplaceCondition, MarketplaceContactMethod, MarketplaceDraftInput, marketplaceCategoryTree } from './marketplace.models';
import { MarketplaceService } from './marketplace.service';
import { FormProgressComponent } from '../shared/forms/form-progress.component';
import { FormReviewComponent, FormReviewRow } from '../shared/forms/form-review.component';
import { FormFeedbackComponent } from '../shared/forms/form-feedback.component';
import { FormRadioGroupComponent } from '../shared/forms/form-radio-group.component';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption, SearchableSelectValue } from '../shared/components/searchable-select/searchable-select.models';

interface PhotoDraft {
  id: string;
  file?: File;
  image?: MarketplaceListingImage;
  previewUrl: string;
}

@Component({
  selector: 'app-marketplace-listing-form',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, FormProgressComponent, FormReviewComponent, FormFeedbackComponent, FormRadioGroupComponent, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mp-page container-xl mp-sell-page" aria-labelledby="sell-title" [attr.aria-busy]="loading() || saving()">
      <a routerLink="/marketplace" class="mp-back-link"><i class="bi bi-arrow-left" aria-hidden="true"></i> Back to Marketplace</a>
      @if (loading()) { <section class="mp-form-shell"><p class="mp-state" role="status">Loading listing form…</p></section> }
      @else if (loadError(); as message) { <section class="mp-form-shell"><h1>Unable to edit listing</h1><p class="mp-state mp-error" role="alert">{{ message }}</p><a routerLink="/marketplace/my-listings">Go to My Advertisements</a></section> }
      @else {
        <header class="mp-form-heading"><p class="mp-eyebrow">{{ editing() ? 'EDIT YOUR ADVERTISEMENT' : 'SELL IN YOUR COMMUNITY' }}</p><h1 id="sell-title">{{ editing() ? 'Update your listing' : 'Sell an Item' }}</h1><p>Create a clear listing to help local buyers find what you’re selling.</p></header>
        <app-form-progress [steps]="stepLabels" [currentStep]="step()" (stepSelected)="goToStep($event)" />
        <form class="mp-listing-form cdm-form" [formGroup]="form" (ngSubmit)="submitListing()" novalidate>
          @if (step() === 1) {
            <section class="mp-form-section" aria-labelledby="product-info-title"><div class="mp-form-section-head"><span>01</span><div><h2 id="product-info-title">Product information</h2><p>Tell buyers the essentials about your item.</p></div></div>
              <div class="mp-form-grid">
                <label class="mp-field mp-span-2"><span>Listing title <b>*</b></span><input class="form-control" formControlName="title" maxlength="160" placeholder="Example: Gently used dining table"><small>Be specific and include the most important product detail.</small>@if (showError('title')) { <em>Enter a title with at least 3 characters.</em> }</label>
                <app-searchable-select label="Category" controlId="marketplace-category" formControlName="category_id" [options]="categoryOptions()" [required]="true" [emptyValue]="''" [clearable]="true" placeholder="Select a category" searchPlaceholder="Search category names…" [invalid]="showError('category_id')" [error]="showError('category_id') ? 'Select a category.' : ''" (valueChange)="categoryChangedValue($event)" />
                <app-searchable-select label="Subcategory" controlId="marketplace-subcategory" formControlName="subcategory_id" [options]="subcategoryOptions()" [disabled]="!selectedCategoryId() || !subcategoryOptions().length" [emptyValue]="''" [clearable]="true" placeholder="Select if applicable" searchPlaceholder="Search subcategories…" />
                <app-form-radio-group label="Product condition" groupId="marketplace-condition" [options]="conditionOptions" [required]="true" formControlName="condition" />
                <label class="mp-field"><span>Price (₹) <b>*</b></span><input class="form-control" type="number" formControlName="price" min="{{ allowFree() ? 0 : 1 }}" step="1" inputmode="numeric" placeholder="Enter amount">@if (showError('price')) { <em>Enter a valid asking price.</em> }</label>
                <label class="mp-field"><span>Brand</span><input class="form-control" formControlName="brand" maxlength="100" placeholder="Brand, if known"></label>
                <label class="mp-field"><span>Model</span><input class="form-control" formControlName="model" maxlength="100" placeholder="Model, if known"></label>
                <label class="mp-field mp-span-2"><span>Description</span><textarea class="form-control" formControlName="description" rows="5" maxlength="10000" placeholder="Describe the item, its condition and anything a buyer should know."></textarea><small>{{ form.controls.description.value.length }} / 10,000 characters</small></label>
                <label class="mp-check"><input type="checkbox" formControlName="is_negotiable"><span>Price is negotiable</span></label>
              </div>
            </section>
          }

          @if (step() === 2) {
            <section class="mp-form-section" aria-labelledby="photos-title"><div class="mp-form-section-head"><span>02</span><div><h2 id="photos-title">Product images</h2><p>Good photos help buyers understand what you’re selling.</p></div></div>
              <label class="mp-upload-zone" for="marketplace-photos"><i class="bi bi-cloud-arrow-up" aria-hidden="true"></i><strong>Add product photos</strong><small>JPG, PNG or WebP · up to 5 MB each · maximum {{ maxImages() }} images</small><span class="mp-upload-button">Choose images</span><input id="marketplace-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple (change)="addPhotos($event)"></label>
              @if (photoError()) { <p class="mp-error-text" role="alert">{{ photoError() }}</p> }
              @if (photoDrafts().length) { <div class="mp-photo-grid" aria-label="Selected product photos">@for (photo of photoDrafts(); track photo.id; let i = $index) { <article class="mp-photo-card"><img [src]="photo.previewUrl" [alt]="photo.image?.alt_text || photo.file?.name || 'Product image'" [class.primary]="isPrimary(photo)"><div class="mp-photo-actions"><button type="button" [disabled]="isPrimary(photo)" (click)="setPrimary(photo)">{{ isPrimary(photo) ? 'Main photo' : 'Set as main' }}</button><span><button type="button" aria-label="Move photo earlier" [disabled]="i === 0" (click)="movePhoto(i,-1)"><i class="bi bi-arrow-left" aria-hidden="true"></i></button><button type="button" aria-label="Move photo later" [disabled]="i === photoDrafts().length - 1" (click)="movePhoto(i,1)"><i class="bi bi-arrow-right" aria-hidden="true"></i></button><button type="button" class="remove-photo" [attr.aria-label]="'Remove photo ' + (i + 1)" (click)="removePhoto(photo)"><i class="bi bi-trash" aria-hidden="true"></i></button></span></div></article> }</div> }
              <p class="mp-form-note"><i class="bi bi-shield-lock" aria-hidden="true"></i> Your photos are stored in a private bucket and shown only for published listings.</p>
            </section>
          }

          @if (step() === 3) {
            <section class="mp-form-section" aria-labelledby="specifics-title"><div class="mp-form-section-head"><span>03</span><div><h2 id="specifics-title">Product-specific details</h2><p>Only fields relevant to the selected category are shown.</p></div></div>
              @if (attributesSchema().length) { <div class="mp-form-grid">@for (attribute of attributesSchema(); track attribute.key) {
                @switch (attribute.type) {
                  @case ('select') { <app-searchable-select [label]="attribute.label" [controlId]="'marketplace-attribute-' + attribute.key" [value]="attributeValues()[attribute.key] || ''" (valueChange)="setAttributeValue(attribute.key,$event)" [options]="attributeOptions(attribute)" [required]="!!attribute.required" [emptyValue]="''" [clearable]="true" [placeholder]="attribute.placeholder || 'Select'" /> }
                  @case ('boolean') { <fieldset class="mp-boolean-field"><legend>{{ attribute.label }}@if (attribute.required) { <b>*</b> }</legend><div><label><input type="radio" [name]="'marketplace-attribute-' + attribute.key" value="Yes" [checked]="attributeValues()[attribute.key] === 'Yes'" (change)="setAttributeValue(attribute.key,'Yes')"> Yes</label><label><input type="radio" [name]="'marketplace-attribute-' + attribute.key" value="No" [checked]="attributeValues()[attribute.key] === 'No'" (change)="setAttributeValue(attribute.key,'No')"> No</label></div></fieldset> }
                  @case ('number') { <label class="mp-field"><span>{{ attribute.label }}@if (attribute.required) { <b>*</b> }</span><input class="form-control" type="number" [value]="attributeValues()[attribute.key] || ''" (input)="setAttribute(attribute.key,$event)" [placeholder]="attribute.placeholder || ''"></label> }
                  @default { <label class="mp-field"><span>{{ attribute.label }}@if (attribute.required) { <b>*</b> }</span><input class="form-control" type="text" maxlength="500" [value]="attributeValues()[attribute.key] || ''" (input)="setAttribute(attribute.key,$event)" [placeholder]="attribute.placeholder || ''"></label> }
                }
              }</div> } @else { <div class="mp-state">This category has no additional specifications. You can continue.</div> }
            </section>
          }

          @if (step() === 4) {
            <section class="mp-form-section" aria-labelledby="seller-location-title"><div class="mp-form-section-head"><span>04</span><div><h2 id="seller-location-title">Seller & location</h2><p>Choose how buyers can reach you and where the item is located.</p></div></div>
              <div class="mp-form-grid">
                <label class="mp-field"><span>Seller display name <b>*</b></span><input class="form-control" formControlName="seller_display_name" maxlength="120" autocomplete="name"></label>
                <app-searchable-select label="Location" controlId="marketplace-location" formControlName="location_id" [options]="searchableLocations()" [required]="true" [emptyValue]="''" [clearable]="true" placeholder="Choose a town or locality" searchPlaceholder="Search localities in English or Tamil…" />
                <app-form-radio-group label="Preferred contact method" groupId="marketplace-contact-method" [options]="contactMethodOptions" formControlName="contact_method" hint="Your phone is only displayed if you choose Phone or WhatsApp and confirm consent." />
                @if (form.controls.contact_method.value !== 'enquiry') { <label class="mp-field"><span>Contact phone <b>*</b></span><input class="form-control" formControlName="seller_contact_phone" type="tel" autocomplete="tel" placeholder="+91 98765 43210"><small>Include the country code for reliable contact.</small></label><label class="mp-check mp-span-2"><input type="checkbox" formControlName="contact_consent"><span>I agree to display this phone number on my published listing.</span></label> }
              </div>
              <p class="mp-privacy-note"><i class="bi bi-lock" aria-hidden="true"></i> Contact information is only included when you explicitly choose phone or WhatsApp contact.</p>
            </section>
          }

          @if (step() === 5) {
            <section class="mp-form-section" aria-labelledby="preview-title"><div class="mp-form-section-head"><span>05</span><div><h2 id="preview-title">Preview & submit</h2><p>Check your listing before sending it for review.</p></div></div>
              <article class="mp-preview-card"><div class="mp-preview-image">@if (primaryPreview(); as image) { <img [src]="image" [alt]="form.controls.title.value"> } @else { <i class="bi bi-image" aria-hidden="true"></i> }</div><div><p class="mp-eyebrow">{{ selectedCategoryName() }}</p><h3>{{ form.controls.title.value || 'Your product title' }}</h3><strong>{{ form.controls.price.value | currency:'INR':'symbol':'1.0-0' }}</strong><p>{{ form.controls.description.value || 'No description provided.' }}</p><span>{{ conditionLabel(form.controls.condition.value) }} · {{ selectedLocationName() }}</span></div></article>
              <app-form-review [rows]="previewRows()" />
              <p class="mp-safety-copy">CDM 360 connects buyers and sellers. Verify products and sellers independently. We do not guarantee product quality, ownership or transaction safety, and we do not process payments.</p>
              <label class="mp-check mp-prohibited-confirm"><input type="checkbox" formControlName="policy_consent"><span>I confirm this item is legal and does not include prohibited goods such as illegal drugs, weapons, counterfeit or stolen property, or hazardous substances. <b>*</b></span></label>
              @if (uploadProgress()) { <p class="mp-upload-progress" role="status">Uploading photos {{ uploadProgress() }}…</p> }
              @if (saveMessage(); as message) { <app-form-feedback kind="success" [message]="message" /> }
            </section>
          }

          @if (formError(); as message) { <app-form-feedback kind="error" [message]="message" /> }
          <footer class="mp-form-footer">
            <div>@if (step() > 1) { <button type="button" class="mp-secondary" (click)="previousStep()">Back</button> }</div>
            <div class="mp-form-actions"><button type="button" class="mp-secondary" [disabled]="saving()" (click)="saveDraft()">{{ saving() ? 'Saving…' : 'Save as Draft' }}</button>@if (step() < 5) { <button type="button" class="mp-primary" [disabled]="saving()" (click)="nextStep()">{{ step() === 4 ? 'Preview listing' : 'Continue' }} <i class="bi bi-arrow-right" aria-hidden="true"></i></button> } @else { <button type="submit" class="mp-primary" [disabled]="saving() || uploading()">{{ saving() ? 'Submitting…' : 'Submit for Approval' }} <i class="bi bi-send" aria-hidden="true"></i></button> }</div>
          </footer>
        </form>
      }
    </main>
  `,
})
export class MarketplaceListingFormComponent implements OnInit, OnDestroy {
  readonly listingId = input<string | null>(null);
  private readonly marketplace = inject(MarketplaceService);
  private readonly document = inject(DOCUMENT);
  private readonly profiles = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly uploadProgress = signal('');
  protected readonly loadError = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly photoError = signal<string | null>(null);
  protected readonly saveMessage = signal<string | null>(null);
  protected readonly step = signal(1);
  protected readonly listingDraftId = signal<string | null>(null);
  protected readonly categories = signal<MarketplaceCategory[]>([]);
  protected readonly places = signal<DirectoryLocation[]>([]);
  protected readonly photoDrafts = signal<PhotoDraft[]>([]);
  protected readonly attributeValues = signal<Record<string, string>>({});
  protected readonly allowFree = signal(false);
  protected readonly maxImages = signal(10);
  protected readonly contactConsent = signal(false);
  protected readonly editing = computed(() => Boolean(this.listingId()));
  protected readonly rootCategories = computed(() => this.categories());
  protected readonly selectedCategoryId = signal('');
  protected readonly subcategories = computed(() => this.rootCategories().find(item => item.id === this.selectedCategoryId())?.subcategories ?? []);
  protected readonly categoryOptions = computed<readonly SearchableSelectOption[]>(() => this.rootCategories().map(category => ({
    value:category.id, label:category.name, searchText:`${category.name} ${category.name_ta} ${category.slug}`,
  })));
  protected readonly subcategoryOptions = computed<readonly SearchableSelectOption[]>(() => this.subcategories().map(category => ({
    value:category.id, label:category.name, searchText:`${category.name} ${category.name_ta} ${category.slug}`,
  })));
  protected readonly locationOptions = computed(() => locationSearchOptions(this.places(), 'en'));
  protected readonly searchableLocations = this.locationOptions;
  protected readonly attributesSchema = computed(() => {
    const root = this.rootCategories().find(item => item.id === this.selectedCategoryId());
    const child = root?.subcategories.find(item => item.id === this.form.controls.subcategory_id.value);
    return [...(root?.attributes_schema ?? []), ...(child?.attributes_schema ?? [])].filter(definition => definition.key !== 'brand' && definition.key !== 'model');
  });
  protected readonly stepLabels = ['Product info', 'Photos', 'Details', 'Seller & location', 'Preview'];
  protected readonly conditions = [
    { value: 'brand_new', label: 'Brand New' }, { value: 'like_new', label: 'Like New' },
    { value: 'gently_used', label: 'Gently Used' }, { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' }, { value: 'for_parts', label: 'For Parts / Repair' },
  ] as const;
  protected readonly conditionOptions = this.conditions;
  protected readonly contactMethodOptions = [
    {value:'enquiry',label:'In-platform enquiry'},
    {value:'phone',label:'Phone call'},
    {value:'whatsapp',label:'WhatsApp'},
  ] as const;
  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
    category_id: ['', Validators.required], subcategory_id: [''], description: ['', Validators.maxLength(10000)],
    condition: ['gently_used' as MarketplaceCondition, Validators.required],
    price: [0, [Validators.required, Validators.min(0)]], is_negotiable: false,
    brand: ['', Validators.maxLength(100)], model: ['', Validators.maxLength(100)],
    location_id: ['', Validators.required], seller_display_name: ['', [Validators.required, Validators.maxLength(120)]],
    seller_contact_phone: ['', Validators.maxLength(32)], contact_method: ['enquiry' as MarketplaceContactMethod],
    contact_consent: false, policy_consent: false,
  });
  private readonly objectUrls = new Set<string>();

  ngOnInit(): void { void this.load(); }
  ngOnDestroy(): void { for (const url of this.objectUrls) URL.revokeObjectURL(url); }

  private async load(): Promise<void> {
    this.loading.set(true); this.loadError.set(null);
    try {
      const [categories, places, settings, profile] = await Promise.all([
        this.marketplace.categories(), this.marketplace.locations(), this.marketplace.settings(), this.profiles.get(),
      ]);
      this.categories.set(categories); this.places.set(places); this.allowFree.set(settings.allow_free_listings); this.maxImages.set(settings.max_images_per_listing);
      this.form.controls.price.setValidators([Validators.required, Validators.min(settings.allow_free_listings ? 0 : 1)]);
      this.form.controls.price.updateValueAndValidity({ emitEvent: false });
      if (profile) this.form.patchValue({ seller_display_name: profile.full_name ?? '', seller_contact_phone: profile.phone ?? '', location_id: profile.preferred_locality_id ?? '' });
      if (this.listingId()) await this.loadExisting(this.listingId()!);
    } catch (error) { this.loadError.set(error instanceof Error ? error.message : 'Unable to load marketplace form data.'); }
    finally { this.loading.set(false); }
  }

  private async loadExisting(id: string): Promise<void> {
    const listing = await this.marketplace.ownListing(id);
    if (!listing || !['draft', 'rejected'].includes(listing.status)) throw new Error('Only your draft or rejected listings can be edited.');
    this.listingDraftId.set(listing.id); this.selectedCategoryId.set(listing.category_id);
    this.form.patchValue({ title: listing.title, category_id: listing.category_id, subcategory_id: listing.subcategory_id ?? '', description: listing.description,
      condition: listing.condition, price: listing.price, is_negotiable: listing.is_negotiable, brand: listing.brand ?? '', model: listing.model ?? '',
      location_id: listing.location_id, seller_display_name: listing.seller_display_name, seller_contact_phone: listing.seller_contact_phone ?? '', contact_method: listing.contact_method });
    this.form.controls.contact_consent.setValue(listing.seller_contact_consent);
    this.attributeValues.set(Object.fromEntries((listing.attributes ?? []).map(attribute => [attribute.attribute_name, attribute.attribute_value])));
    this.photoDrafts.set((listing.images ?? []).sort((a,b) => a.display_order-b.display_order).map(image => ({ id: image.id, image, previewUrl: image.url ?? '' })));
  }

  protected categoryChangedValue(value: SearchableSelectValue): void { this.categoryChanged(typeof value === 'string' ? value : ''); }
  private categoryChanged(id: string): void { this.selectedCategoryId.set(id); this.form.controls.subcategory_id.setValue(''); }
  protected setAttribute(key: string, event: Event): void { const value = (event.currentTarget as HTMLInputElement | HTMLSelectElement).value; this.attributeValues.update(current => ({ ...current, [key]: value })); }
  protected setAttributeValue(key: string, value: SearchableSelectValue): void { this.attributeValues.update(current => ({ ...current, [key]: value ?? '' })); }
  protected attributeOptions(attribute: MarketplaceAttributeDefinition): readonly SearchableSelectOption[] {
    return (attribute.options ?? []).map(option => ({ value:option, label:option, searchText:option }));
  }
  protected showError(name: 'title' | 'category_id' | 'price'): boolean { const control = this.form.controls[name]; return control.invalid && (control.touched || this.formError() !== null); }
  protected conditionLabel(value: MarketplaceCondition): string { return this.conditions.find(condition => condition.value === value)?.label ?? value; }
  protected selectedCategoryName(): string { const root = this.rootCategories().find(item => item.id === this.form.controls.category_id.value); return root?.subcategories.find(item => item.id === this.form.controls.subcategory_id.value)?.name ?? root?.name ?? 'Marketplace item'; }
  protected selectedLocationName(): string { return this.locationOptions().find(place => place.value === this.form.controls.location_id.value)?.label ?? 'Location not set'; }
  protected previewRows(): FormReviewRow[] {
    const raw = this.form.getRawValue();
    const rows = [
      { label: 'Category', value: this.selectedCategoryName() },
      { label: 'Condition', value: this.conditionLabel(raw.condition) },
      { label: 'Location', value: this.selectedLocationName() },
      { label: 'Brand', value: raw.brand },
      { label: 'Model', value: raw.model },
      ...this.attributesSchema().flatMap(definition => this.attributeValues()[definition.key]
        ? [{ label: definition.label, value: this.attributeValues()[definition.key] }]
        : []),
    ];
    return rows.filter(row => row.value && row.value !== 'Location not set');
  }
  protected primaryPreview(): string | null { return this.photoDrafts().find(photo => this.isPrimary(photo))?.previewUrl ?? this.photoDrafts()[0]?.previewUrl ?? null; }
  protected isPrimary(photo: PhotoDraft): boolean { return photo.id === this.primaryPhotoId(); }
  private primaryPhotoId(): string { return this.photoDrafts().find(photo => photo.image?.is_primary)?.id ?? this.photoDrafts()[0]?.id ?? ''; }

  protected addPhotos(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []); input.value = '';
    const available = this.maxImages() - this.photoDrafts().length;
    if (files.length > available) this.photoError.set(`You can add up to ${this.maxImages()} images.`); else this.photoError.set(null);
    const next = files.slice(0, Math.max(0, available));
    for (const file of next) {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { this.photoError.set(`${file.name}: use JPG, PNG or WebP.`); continue; }
      if (file.size > 5 * 1024 * 1024) { this.photoError.set(`${file.name}: images must be 5 MB or smaller.`); continue; }
      const id = `local-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
      const previewUrl = URL.createObjectURL(file); this.objectUrls.add(previewUrl);
      this.photoDrafts.update(rows => [...rows, { id, file, previewUrl }]);
    }
  }

  protected async removePhoto(photo: PhotoDraft): Promise<void> {
    this.photoError.set(null);
    try { if (photo.image) await this.marketplace.removeImage(photo.image); }
    catch (error) { this.photoError.set(error instanceof Error ? error.message : 'Unable to remove the image.'); return; }
    if (photo.file) { URL.revokeObjectURL(photo.previewUrl); this.objectUrls.delete(photo.previewUrl); }
    this.photoDrafts.update(rows => rows.filter(item => item.id !== photo.id));
  }

  protected async setPrimary(photo: PhotoDraft): Promise<void> {
    const listingId = this.listingDraftId();
    if (listingId && photo.image) {
      try { await this.marketplace.setPrimaryImage(listingId, photo.id); }
      catch { this.photoError.set('Unable to set this as the main photo.'); return; }
    }
    this.photoDrafts.update(rows => rows.map(item => ({ ...item, image: item.image ? { ...item.image, is_primary: item.id === photo.id } : item.image })));
    if (photo.file) this.photoDrafts.set([{ ...photo, image: { id: photo.id, listing_id: listingId ?? '', storage_path: '', alt_text: '', display_order: 0, is_primary: true } }, ...this.photoDrafts().filter(item => item.id !== photo.id)]);
  }

  protected movePhoto(index: number, direction: -1 | 1): void {
    const rows = [...this.photoDrafts()]; const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target], rows[index]]; this.photoDrafts.set(rows);
    const listingId = this.listingDraftId(); if (listingId) void this.marketplace.reorderImages(listingId, rows.flatMap(row => row.image ? [row.image] : []));
  }

  protected previousStep(): void { this.formError.set(null); this.step.update(value => Math.max(1, value - 1)); }
  protected goToStep(step: number): void { if (step <= this.step()) this.step.set(step); }
  protected async nextStep(): Promise<void> {
    this.formError.set(null);
    if (this.step() === 1) {
      const fields = ['title', 'category_id', 'price'] as const; fields.forEach(field => this.form.controls[field].markAsTouched());
      if (this.form.controls.title.invalid || this.form.controls.category_id.invalid || this.form.controls.price.invalid) { this.formError.set('Complete the required product information to continue.'); return; }
    }
    if (this.step() === 4) {
      if (!this.validateSellerStep()) return;
      this.saving.set(true);
      try { await this.persistDraftAndImages(); }
      catch (error) { this.formError.set(error instanceof Error ? error.message : 'Unable to prepare your listing preview.'); this.saving.set(false); return; }
      finally { this.saving.set(false); }
    }
    this.step.update(value => Math.min(5, value + 1));
  }

  protected async saveDraft(): Promise<void> {
    this.formError.set(null);
    if (!this.validateSellerStep()) return;
    this.saving.set(true); this.formError.set(null); this.saveMessage.set(null);
    try { await this.persistDraftAndImages(); this.saveMessage.set('Draft saved. You can continue editing before submission.'); }
    catch (error) { this.formError.set(error instanceof Error ? error.message : 'Unable to save draft.'); }
    finally { this.saving.set(false); }
  }

  protected async submitListing(): Promise<void> {
    this.formError.set(null); this.saveMessage.set(null);
    if (!this.validateSellerStep()) { this.step.set(4); return; }
    if (!this.form.controls.policy_consent.value) { this.formError.set('Confirm that the item complies with the marketplace prohibited-items and safety rules.'); return; }
    if (!this.photoDrafts().length) { this.step.set(2); this.photoError.set('Add at least one product photo before submission.'); return; }
    this.saving.set(true);
    try {
      const id = await this.persistDraftAndImages();
      await this.marketplace.submitForApproval(id, this.form.controls.policy_consent.value);
      this.saveMessage.set('Listing submitted for approval. It will appear publicly after moderation.');
      await this.router.navigate(['/marketplace/my-listings'], { queryParams: { status: 'pending_approval' } });
    } catch (error) { this.formError.set(error instanceof Error ? error.message : 'Unable to submit your listing.'); }
    finally { this.saving.set(false); }
  }

  private validateSellerStep(): boolean {
    const controls = [this.form.controls.location_id, this.form.controls.seller_display_name];
    controls.forEach(control => control.markAsTouched());
    if (controls.some(control => control.invalid)) { this.formError.set('Enter your display name and select a location.'); return false; }
    if (this.form.controls.contact_method.value !== 'enquiry') {
      if (!/^\+?[\d\s().-]{7,24}$/.test(this.form.controls.seller_contact_phone.value.trim())) { this.formError.set('Enter a valid seller phone number.'); return false; }
      if (!this.form.controls.contact_consent.value) { this.formError.set('Confirm that you want your phone number shown on the listing.'); return false; }
    }
    return true;
  }

  private async persistDraftAndImages(): Promise<string> {
    const raw = this.form.getRawValue();
    const input: MarketplaceDraftInput = {
      category_id: raw.category_id, subcategory_id: raw.subcategory_id || null, title: raw.title.trim(), description: raw.description.trim(),
      price: Number(raw.price), is_negotiable: raw.is_negotiable, condition: raw.condition,
      brand: raw.brand.trim() || null, model: raw.model.trim() || null, location_id: raw.location_id,
      seller_display_name: raw.seller_display_name.trim(),
      seller_contact_phone: raw.contact_method === 'enquiry' ? null : raw.seller_contact_phone.trim(), contact_method: raw.contact_method,
      seller_contact_consent: raw.contact_method !== 'enquiry' && raw.contact_consent,
    };
    let id = this.listingDraftId();
    if (id) await this.marketplace.updateDraft(id, input);
    else { id = (await this.marketplace.createDraft(input)).id; this.listingDraftId.set(id); }
    const schema = this.attributesSchema();
    const attributes: MarketplaceListingAttribute[] = schema.filter(def => this.attributeValues()[def.key]?.trim()).map(def => ({ attribute_name: def.key, attribute_value: this.attributeValues()[def.key].trim() }));
    await this.marketplace.saveAttributes(id, attributes);
    const files = this.photoDrafts().filter(photo => photo.file);
    if (files.length) {
      this.uploading.set(true);
      try {
        for (const [index, photo] of files.entries()) {
          this.uploadProgress.set(`${index + 1} of ${files.length}`);
          const compressed = await this.compressImage(photo.file!);
          const saved = await this.marketplace.uploadImage(id, compressed, photo.file!.name.replace(/\.[^.]+$/, ''), this.photoDrafts().findIndex(item => item.id === photo.id), this.isPrimary(photo) || this.photoDrafts().every(item => item.file));
          const url = await this.marketplace.imageUrl(saved.storage_path);
          URL.revokeObjectURL(photo.previewUrl); this.objectUrls.delete(photo.previewUrl);
          this.photoDrafts.update(rows => rows.map(item => item.id === photo.id ? { id: saved.id, image: { ...saved, url }, previewUrl: url ?? '' } : item));
        }
        await this.marketplace.reorderImages(id, this.photoDrafts().flatMap(row => row.image ? [row.image] : []));
        const primary = this.photoDrafts().find(row => this.isPrimary(row));
        if (primary?.image) await this.marketplace.setPrimaryImage(id, primary.image.id);
      } finally { this.uploading.set(false); this.uploadProgress.set(''); }
    }
    return id;
  }

  private async compressImage(file: File): Promise<File> {
    if (file.type === 'image/webp' || typeof createImageBitmap !== 'function') return file;
    try {
      const bitmap = await createImageBitmap(file); const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      const canvas = this.document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext('2d'); if (!context) { bitmap.close(); return file; }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', .82));
      return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }) : file;
    } catch { return file; }
  }
}
