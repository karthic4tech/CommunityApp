import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { findCategoryPathById, ServiceCategory } from '../core/models/service-category';
import { DirectoryLocation, locationOptions } from '../core/models/service-listing';
import { SubmissionFormInput } from '../core/models/service-submission';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { ServiceSubmissionService } from '../core/services/service-submission.service';
import { ListingMediaService } from '../core/services/listing-media.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-submit-service',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="submit-page" aria-labelledby="submit-title" [attr.aria-busy]="loading() || saving()">
      <a class="back-link" routerLink="/my-submissions">← Back to my submissions</a>
      <header><p class="eyebrow">COMMUNITY SERVICE</p><h1 id="submit-title">{{ editing() ? 'Edit your submission' : 'Add your service' }}</h1><p class="intro">Share accurate service information with the Nam Chidambaram community. Submissions are reviewed before publication.</p></header>
      @if (loading()) { <p class="state" role="status">Loading the submission form…</p> }
      @else if (!auth.emailVerified()) { <div class="notice" role="alert"><strong>Verify your email first.</strong><p>Only verified accounts can submit services.</p><a routerLink="/auth/verify-email">Verify email</a></div> }
      @else if (published() && pendingUpdate()) { <div class="notice" role="status"><strong>Update awaiting review.</strong><p>An administrator must review the current update before another update can be submitted.</p><a routerLink="/my-submissions">Return to my submissions</a></div> }
      @else {
        @if (published()) { <div class="notice" role="status"><strong>This is an update to a published listing.</strong><p>The current public version remains unchanged until an administrator approves this update.</p></div> }
        <nav class="steps" aria-label="Submission progress"><span [class.current]="step() === 1">1. Details</span><span [class.current]="step() === 2">2. Contacts</span><span [class.current]="step() === 3">3. Location</span><span [class.current]="step() === 4">4. Review</span></nav>
        <form [formGroup]="form" (ngSubmit)="step() === 4 ? save(true) : next()" novalidate>
          @if (step() === 1) {
            <fieldset><legend>Business and service details</legend>
              <label>Provider type<select formControlName="provider_type"><option value="individual">Individual</option><option value="business">Business</option><option value="organisation">Organisation</option></select></label>
              <label>Provider or business name<input formControlName="display_name" maxlength="160" required /></label>
              <label>Provider description<textarea formControlName="provider_description" rows="3" maxlength="2000"></textarea></label>
              <label>Parent category<select #parent formControlName="parent_slug" (change)="selectParent(parent.value)" required><option value="">Select a category</option>@for (category of rootCategories(); track category.id) { <option [value]="category.slug">{{ category.nameEnglish }} — {{ category.nameTamil }}</option> }</select></label>
              <label>Subcategory<select formControlName="category_id" required><option value="">Select a subcategory</option>@for (category of subcategories(); track category.id) { <option [value]="category.id">{{ category.nameEnglish }} — {{ category.nameTamil }}</option> }</select></label>
              <label>Service title<input formControlName="title" maxlength="200" required /></label>
              <label>Service description<textarea formControlName="description" rows="6" maxlength="5000" required></textarea></label>
            </fieldset>
          } @else if (step() === 2) {
            <fieldset><legend>Public contacts</legend><p class="help">Only checked contact details will be shown publicly after approval.</p>
              <label>Phone<input formControlName="phone" autocomplete="tel" maxlength="40" /></label><label class="check"><input type="checkbox" formControlName="phone_public" /> Show phone publicly</label>
              <label>WhatsApp<input formControlName="whatsapp" maxlength="40" /></label><label class="check"><input type="checkbox" formControlName="whatsapp_public" /> Show WhatsApp publicly</label>
              <label>Email<input type="email" formControlName="email" autocomplete="email" maxlength="200" /></label><label class="check"><input type="checkbox" formControlName="email_public" /> Show email publicly</label>
              <label>Website<input type="url" formControlName="website" maxlength="500" placeholder="https://example.com" /></label><label class="check"><input type="checkbox" formControlName="website_public" /> Show website publicly</label>
              <label>Facebook<input type="url" formControlName="facebook" maxlength="500" placeholder="https://facebook.com/..." /></label><label class="check"><input type="checkbox" formControlName="facebook_public" /> Show Facebook publicly</label>
              <label>Instagram<input type="url" formControlName="instagram" maxlength="500" placeholder="https://instagram.com/..." /></label><label class="check"><input type="checkbox" formControlName="instagram_public" /> Show Instagram publicly</label>
              <label>YouTube<input type="url" formControlName="youtube" maxlength="500" placeholder="https://youtube.com/..." /></label><label class="check"><input type="checkbox" formControlName="youtube_public" /> Show YouTube publicly</label>
            </fieldset>
          } @else if (step() === 3) {
            <fieldset><legend>Location and service coverage</legend><p class="help">The current schema stores structured locations and coverage. Street address and coordinates are optional.</p>
              <label>Business locality<select formControlName="based_location_id"><option value="">Select a locality</option>@for (place of places(); track place.id) { <option [value]="place.id">{{ place.label }}</option> }</select></label>
              <label>Coverage type<select formControlName="coverage_type"><option value="based_here">Based here</option><option value="serves_here">Serves here</option></select></label>
              <label>Business address<input formControlName="address" maxlength="500" /></label><label>Postal code<input formControlName="postal_code" maxlength="16" /></label>
              <div class="coordinate-grid"><label>Latitude<input type="number" formControlName="latitude" min="-90" max="90" step="any" /></label><label>Longitude<input type="number" formControlName="longitude" min="-180" max="180" step="any" /></label></div>
              <label>Additional service areas<select multiple formControlName="coverage_ids" size="6">@for (place of places(); track place.id) { <option [value]="place.id">{{ place.label }}</option> }</select></label>
            </fieldset>
          } @else {
            <fieldset><legend>Review and submit</legend><div class="preview"><h2>{{ form.controls.title.value || 'Untitled service' }}</h2><p class="provider">{{ form.controls.display_name.value }}</p><p>{{ form.controls.description.value }}</p><p><strong>Category:</strong> {{ selectedCategoryLabel() }}</p><p><strong>Contacts:</strong> {{ publicContactCount() }} public contact(s)</p><p><strong>Coverage:</strong> {{ form.controls.coverage_ids.value.length + (form.controls.based_location_id.value ? 1 : 0) }} location(s)</p></div><label>Service images (up to 10, 5 MB each)<input type="file" accept="image/*" multiple (change)="selectFiles($event)" />@if (selectedFiles().length) { <small>{{ selectedFiles().length }} image(s) selected.</small> } @if (!storageConfigured()) { <small class="help">Photo uploads require a configured Supabase Storage bucket. You can still submit text and contact details.</small> }</label><label class="declaration"><input type="checkbox" formControlName="declaration" required /> I confirm that I am authorized to submit this information and that it is accurate.</label></fieldset>
          }
          @if (errorMessage(); as message) { <p class="error" role="alert">{{ message }}</p> }
          <div class="actions"><button type="button" class="secondary" [disabled]="step() === 1 || saving()" (click)="previous()">Back</button>@if (step() < 4) { <button type="button" class="secondary" [disabled]="saving()" (click)="save(false)">Save draft</button><button type="button" [disabled]="!canNext() || saving()" (click)="next()">Continue</button> } @else { <button type="button" class="secondary" [disabled]="saving()" (click)="save(false)">Save draft</button><button type="submit" [disabled]="!form.controls.declaration.value || saving()">{{ saving() ? 'Submitting…' : 'Submit for review' }}</button> }</div>
        </form>
      }
    </section>
  `,
  styles: `
    :host { display:block; padding-block:1.5rem 2.5rem; }.submit-page { display:grid; gap:1.25rem; }.back-link { color:#075541; display:inline-flex; align-items:center; min-height:44px; }.eyebrow { margin:0 0 .35rem; color:#52665b; font-size:.72rem; font-weight:800; letter-spacing:.12em; } h1 { margin:0; color:#173f32; font-size:clamp(1.7rem,4vw,2.5rem); }.intro,.help { color:#52665b; line-height:1.8; }.steps { display:flex; gap:.5rem; flex-wrap:wrap; }.steps span { padding:.5rem .75rem; border:1px solid #dfe7e2; border-radius:99px; color:#52665b; background:white; }.steps .current { border-color:#075541; background:#e6f4e9; color:#075541; font-weight:700; } form { display:grid; gap:1rem; padding:clamp(1rem,3vw,1.5rem); border:1px solid #dfe7e2; border-radius:16px; background:white; } fieldset { display:grid; gap:1rem; border:0; padding:0; margin:0; } legend { margin-bottom:.25rem; color:#173f32; font-size:1.25rem; font-weight:800; } label { display:grid; gap:.4rem; color:#173f32; font-weight:650; } input,select,textarea { width:100%; min-height:44px; border:1px solid #b8c9bf; border-radius:9px; padding:.7rem; background:white; color:#173f32; font:inherit; } textarea { resize:vertical; line-height:1.6; }.check,.declaration { display:flex; align-items:center; gap:.6rem; font-weight:500; }.check input,.declaration input { width:1.1rem; height:1.1rem; accent-color:#075541; }.coordinate-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }.preview { padding:1rem; border:1px solid #dfe7e2; border-radius:12px; background:#f8fbf8; line-height:1.7; }.preview h2 { margin-top:0; color:#173f32; }.provider { color:#52665b; font-weight:700; }.actions { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:.75rem; }.actions button { min-height:44px; border:1px solid #075541; border-radius:9px; padding:.7rem 1rem; background:#075541; color:white; font:inherit; font-weight:700; }.actions .secondary { background:white; color:#075541; }.actions button:disabled { opacity:.6; }.notice { padding:1rem; border:1px solid #e7d9ae; border-radius:14px; background:#fffaf0; color:#625329; line-height:1.7; }.notice a { color:#075541; }.state { padding:1rem; border:1px solid #dfe7e2; border-radius:14px; background:white; color:#52665b; }.error { color:#8a261f; line-height:1.7; } :is(a,button,input,select,textarea):focus-visible { outline:3px solid #17583f; outline-offset:3px; } @media(max-width:650px) { .coordinate-grid { grid-template-columns:1fr; }.actions > * { flex:1 1 130px; } }
  `,
})
export class SubmitServiceComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly categories = inject(ServiceCategoryService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly submissions = inject(ServiceSubmissionService);
  private readonly media = inject(ListingMediaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly form = inject(NonNullableFormBuilder).group({
    provider_type: 'individual' as 'individual' | 'business' | 'organisation', display_name: ['', [Validators.required, Validators.maxLength(160)]], provider_description: ['', Validators.maxLength(2000)], parent_slug: '', category_id: ['', Validators.required], title: ['', [Validators.required, Validators.maxLength(200)]], description: ['', [Validators.required, Validators.maxLength(5000)]],
    phone: '', phone_public: true, whatsapp: '', whatsapp_public: true, email: '', email_public: true, website: '', website_public: true, facebook: '', facebook_public: true, instagram: '', instagram_public: true, youtube: '', youtube_public: true,
    based_location_id: '', coverage_type: 'based_here' as 'based_here' | 'serves_here', coverage_ids: new FormControl<string[]>([], { nonNullable: true }), address: '', postal_code: '', latitude: null as number | null, longitude: null as number | null, declaration: false,
  });
  protected readonly step = signal(1);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selectedFiles = signal<readonly File[]>([]);
  protected readonly storageConfigured = signal(Boolean(environment.supabaseStorageBucket.trim()));
  protected readonly locationRows = signal<DirectoryLocation[]>([]);
  protected readonly existingId = signal<string | null>(null);
  protected readonly existingStatus = signal<string | null>(null);
  protected readonly pendingUpdate = signal(false);
  protected readonly rootCategories = computed(() => this.categories.categories());
  protected readonly subcategories = computed<ServiceCategory[]>(() => {
    const parent = this.categories.categories().find(category => category.slug === this.form.controls.parent_slug.value);
    return parent?.subcategories ?? [];
  });
  protected readonly places = computed(() => locationOptions(this.locationRows(), 'en'));
  protected readonly editing = computed(() => Boolean(this.existingId()));
  protected readonly published = computed(() => this.existingStatus() === 'published');
  protected readonly selectedCategoryLabel = computed(() => {
    const category = this.categories.categories().flatMap(root => [root, ...root.subcategories]).find(item => item.id === this.form.controls.category_id.value);
    return category ? `${category.nameEnglish} — ${category.nameTamil}` : 'Not selected';
  });
  protected readonly publicContactCount = computed(() => this.publicContacts().length);

  ngOnInit(): void { void this.load(); }

  protected selectParent(slug: string): void { this.form.controls.parent_slug.setValue(slug); this.form.controls.category_id.setValue(''); }
  protected selectFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length > 10) { this.errorMessage.set('You can select up to 10 images.'); this.selectedFiles.set(files.slice(0, 10)); return; }
    this.errorMessage.set(null); this.selectedFiles.set(files);
  }
  protected next(): void { if (this.canNext()) this.step.update(value => Math.min(4, value + 1)); }
  protected previous(): void { this.step.update(value => Math.max(1, value - 1)); }
  protected canNext(): boolean {
    if (this.step() === 1) return Boolean(this.form.controls.display_name.value.trim() && this.form.controls.category_id.value && this.form.controls.title.value.trim() && this.form.controls.description.value.trim());
    if (this.step() === 2) return true;
    if (this.step() === 3) return true;
    return true;
  }

  protected async save(submitForReview: boolean): Promise<void> {
    if (!this.canNext() && submitForReview) { this.errorMessage.set('Complete the required service details first.'); return; }
    if (submitForReview && !this.form.controls.declaration.value) { this.errorMessage.set('Confirm the declaration before submitting.'); return; }
    this.saving.set(true); this.errorMessage.set(null);
    try {
      const raw = this.form.getRawValue();
      const input: SubmissionFormInput = { listingId: this.existingId(), providerId: this.loadedProviderId, provider: { provider_type: this.form.controls.provider_type.value, display_name: this.form.controls.display_name.value.trim(), description: this.form.controls.provider_description.value.trim() || null, public_email: raw.email_public && raw.email.trim() ? raw.email.trim() : null, website_url: raw.website_public && raw.website.trim() ? raw.website.trim() : null, address: this.form.controls.address.value.trim() || null, postal_code: this.form.controls.postal_code.value.trim() || null, latitude: this.form.controls.latitude.value, longitude: this.form.controls.longitude.value }, listing: { category_id: this.form.controls.category_id.value, title: this.form.controls.title.value.trim(), description: this.form.controls.description.value.trim() }, contacts: this.publicContacts(), locations: this.locationsInput(), submitForReview };
      const listingId = this.published() ? await this.submissions.saveRevision(input) : await this.submissions.save(input);
      if (!this.published() && this.selectedFiles().length) await this.media.uploadImages(listingId, this.selectedFiles(), this.existingMediaCount);
      await this.router.navigateByUrl('/my-submissions');
    } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to save this submission.'); }
    finally { this.saving.set(false); }
  }

  private loadedProviderId: string | null = null;
  private existingMediaCount = 0;
  private publicContacts() {
    const raw = this.form.getRawValue();
    const values = [
      ['phone', raw.phone, raw.phone_public], ['whatsapp', raw.whatsapp, raw.whatsapp_public], ['email', raw.email, raw.email_public], ['website', raw.website, raw.website_public], ['facebook', raw.facebook, raw.facebook_public], ['instagram', raw.instagram, raw.instagram_public], ['youtube', raw.youtube, raw.youtube_public],
    ] as const;
    return values.filter(([, value]) => value.trim()).map(([contact_type, contact_value, isPublic], index) => ({ contact_type, contact_value: contact_value.trim(), is_public: isPublic, sort_order: index }));
  }

  private locationsInput() {
    const raw = this.form.getRawValue();
    const ids = [...new Set([raw.based_location_id, ...raw.coverage_ids].filter(Boolean))];
    return ids.map(location_id => ({ location_id, coverage_type: location_id === raw.based_location_id ? raw.coverage_type : 'serves_here' as const }));
  }

  private async load(): Promise<void> {
    try {
      await this.categories.load();
      this.locationRows.set(await this.directory.locations());
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        const existing = await this.submissions.getMine(id);
        if (!existing) throw new Error('This submission was not found.');
        this.existingId.set(existing.id); this.existingStatus.set(existing.status); this.pendingUpdate.set(Boolean(existing.service_listing_revisions?.some(revision => revision.status === 'pending_review'))); this.loadedProviderId = existing.provider_id; this.existingMediaCount = existing.listing_media?.length ?? 0;
        const path = findCategoryPathById(this.categories.categories(), existing.category_id);
        this.form.patchValue({ provider_type: existing.service_providers.provider_type as 'individual' | 'business' | 'organisation', display_name: existing.service_providers.display_name, provider_description: existing.service_providers.description ?? '', parent_slug: path?.[0]?.slug ?? '', category_id: existing.category_id, title: existing.title, description: existing.description, address: existing.service_providers.address ?? '', postal_code: existing.service_providers.postal_code ?? '', latitude: existing.service_providers.latitude, longitude: existing.service_providers.longitude });
        this.form.controls.phone.setValue(existing.listing_contacts?.find(contact => contact.contact_type === 'phone')?.contact_value ?? '');
        this.form.controls.whatsapp.setValue(existing.listing_contacts?.find(contact => contact.contact_type === 'whatsapp')?.contact_value ?? '');
        this.form.controls.email.setValue(existing.listing_contacts?.find(contact => contact.contact_type === 'email')?.contact_value ?? existing.service_providers.public_email ?? '');
        this.form.controls.website.setValue(existing.listing_contacts?.find(contact => contact.contact_type === 'website')?.contact_value ?? existing.service_providers.website_url ?? '');
        this.form.controls.coverage_ids.setValue(existing.listing_locations?.map(location => location.locations?.id).filter((value): value is string => Boolean(value)) ?? []);
      }
    } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load the submission form.'); }
    finally { this.loading.set(false); }
  }
}
