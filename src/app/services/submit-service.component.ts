import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { findCategoryPathById, ServiceCategory } from '../core/models/service-category';
import { DirectoryLocation, locationSearchOptions, normalizeContactValue } from '../core/models/service-listing';
import { SubmissionContactInput, SubmissionFormInput } from '../core/models/service-submission';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ServiceCategoryAssistantService, ServiceCategorySuggestion } from '../core/services/service-category-assistant.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { ServiceSubmissionService } from '../core/services/service-submission.service';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption, SearchableSelectValue } from '../shared/components/searchable-select/searchable-select.models';
import { MediaUploadComponent } from '../shared/components/media-upload/media-upload.component';

type AdvancedContact = 'email' | 'website' | 'facebook' | 'instagram' | 'youtube';
const indianWhatsAppValidator = (): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  return /^(?:\+91[\s-]?)?[6-9]\d{9}$/.test(value.replace(/[()]/g, '')) ? null : { whatsapp: true };
};
const contactValidator = (type: AdvancedContact): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  return !value || normalizeContactValue(type, value) ? null : { contact: true };
};

@Component({
  selector: 'app-submit-service',
  imports: [ReactiveFormsModule, RouterLink, SearchableSelectComponent, MediaUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="quick-submit" aria-labelledby="submit-title" [attr.aria-busy]="loading() || saving()">
      <div class="quick-submit__inner">
        <a class="back-link" routerLink="/my-submissions"><i class="bi bi-arrow-left" aria-hidden="true"></i> My Services</a>

        @if (loading()) {
          <p class="status-message" role="status"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Loading…</p>
        } @else if (!auth.emailVerified()) {
          <section class="notice notice--warning" role="alert">
            <h1 id="submit-title">Verify your email first</h1>
            <p>Only verified accounts can submit services.</p>
            <a class="button button--primary" routerLink="/auth/verify-email">Verify email</a>
          </section>
        } @else if (success()) {
          <section class="success-card" aria-labelledby="success-title">
            <div class="success-icon" aria-hidden="true"><i class="bi bi-check-lg"></i></div>
            <h1 id="success-title">Service submitted successfully.</h1>
            <p>Your listing is being reviewed. You can add more details anytime from My Services.</p>
            <a class="button button--primary" routerLink="/my-submissions">Go to My Services</a>
          </section>
        } @else {
          <header class="page-header">
            <p class="eyebrow">COMMUNITY SERVICES</p>
            <h1 id="submit-title">{{ editing() ? 'Edit your service' : 'Add Your Service' }}</h1>
            <p>Register now. Complete your profile anytime.</p>
          </header>

          @if (published()) {
            <div class="notice notice--info" role="status">Changes to a published listing are sent for administrator review. The current public version stays unchanged until approval.</div>
          }
          @if (pendingUpdate()) {
            <div class="notice notice--info" role="alert">An update is already awaiting review. Please return to My Services.</div>
          } @else {
            @if (photoSetupNotice()) { <div class="notice notice--info" role="status">Your service is saved. You can add photos here now and anytime later.</div> }
            <form [formGroup]="form" (ngSubmit)="save()" novalidate>
              <fieldset class="field-group">
                <legend>Provider type <span aria-hidden="true">*</span></legend>
                <div class="segmented-control">
                  @for (option of providerTypes; track option.value) {
                    <label [class.is-selected]="form.controls.provider_type.value === option.value">
                      <input type="radio" formControlName="provider_type" [value]="option.value" />
                      <span>{{ option.label }}</span>
                    </label>
                  }
                </div>
              </fieldset>

              <div class="field-group">
                <label for="display_name">Provider Name <span aria-hidden="true">*</span></label>
                <input id="display_name" formControlName="display_name" maxlength="160" autocomplete="organization" placeholder="Your name or business name" [class.is-invalid]="showError('display_name')" />
                @if (showError('display_name')) { <p class="field-error" id="display-name-error">Enter a provider name.</p> }
              </div>

              <section class="category-assistant" aria-labelledby="category-help-title">
                <h2 id="category-help-title">Need help choosing a category?</h2>
                <p>What service do you provide?</p>
                <textarea id="category-description" formControlName="category_description" rows="2" maxlength="200" placeholder="Describe it in English, Tamil or mixed Tamil-English..."></textarea>
                <small>CDM 360 will suggest a category from the existing list.</small>
                <button type="button" class="button button--secondary" [disabled]="categorySuggesting() || form.controls.category_description.value.trim().length < 2" (click)="suggestCategory()">
                  <i class="bi bi-stars" aria-hidden="true"></i> {{ categorySuggesting() ? 'Finding a category…' : 'Suggest Category' }}
                </button>
                @if (categorySuggestion(); as suggestion) {
                  <div class="suggestion" role="status">
                    <strong>Suggested category</strong>
                    <span>{{ suggestion.parent.nameEnglish }} — <span lang="ta">{{ suggestion.parent.nameTamil }}</span></span>
                    <small>{{ suggestion.subcategory.nameEnglish }} — <span lang="ta">{{ suggestion.subcategory.nameTamil }}</span></small>
                    <div class="suggestion-actions"><button type="button" class="button button--primary" (click)="confirmCategorySuggestion()">Use this category</button><button type="button" class="text-button" (click)="dismissCategorySuggestion()">Choose manually</button></div>
                  </div>
                }
                @if (categorySuggestionError(); as message) { <p class="field-error" role="alert">{{ message }}</p> }
              </section>

              <div class="field-group">
                <app-searchable-select controlId="parent_slug" label="Category" formControlName="parent_slug" [options]="parentCategoryOptions()" [required]="true" [clearable]="true" [emptyValue]="''" placeholder="Choose a category" searchPlaceholder="Search in English or Tamil…" (valueChange)="selectParentValue($event)" />
                <app-searchable-select controlId="category_id" label="Service type" formControlName="category_id" [options]="subcategoryOptions()" [required]="true" [clearable]="true" [emptyValue]="''" [disabled]="!selectedParentSlug() || !subcategoryOptions().length" placeholder="Choose a service type" searchPlaceholder="Search in English or Tamil…" />
                @if (form.controls.category_id.touched && form.controls.category_id.invalid) { <p class="field-error">Choose a service type.</p> }
              </div>

              <div class="field-group">
                <label for="title">Service Name <span aria-hidden="true">*</span></label>
                <input id="title" formControlName="title" maxlength="200" placeholder="e.g. Electrician, AC Repair, Catering" [class.is-invalid]="showError('title')" />
                @if (showError('title')) { <p class="field-error">Enter a service name.</p> }
              </div>

              <div class="field-group">
                <label for="phone">Mobile Number <span aria-hidden="true">*</span></label>
                <div class="phone-input"><span aria-hidden="true">+91</span><input id="phone" formControlName="phone" autocomplete="tel" inputmode="numeric" maxlength="10" placeholder="98765 43210" [class.is-invalid]="showError('phone')" /></div>
                @if (showError('phone')) { <p class="field-error">Enter a valid 10-digit Indian mobile number.</p> }
                @if (auth.phoneVerified()) { <small class="verified-hint"><i class="bi bi-shield-check" aria-hidden="true"></i> Prefilled from your verified account. You can change it.</small> }
              </div>

              <div class="field-group">
                <label for="description">Service Description <span class="optional">(Optional)</span></label>
                <textarea id="description" formControlName="description" rows="3" maxlength="5000" placeholder="Briefly describe your service..."></textarea>
              </div>

              <div class="field-group">
                <app-searchable-select controlId="based_location_id" label="Location" formControlName="based_location_id" [options]="placeOptions()" [required]="true" [clearable]="true" [emptyValue]="''" placeholder="e.g. Chidambaram, Annamalai Nagar" searchPlaceholder="Search localities in English or Tamil…" />
                @if (form.controls.based_location_id.touched && form.controls.based_location_id.invalid) { <p class="field-error">Choose your location.</p> }
              </div>

              <section class="advanced-details" aria-label="Optional profile details">
                <button type="button" class="button button--secondary details-toggle" [attr.aria-expanded]="contactDetailsExpanded()" aria-controls="contact-social-details" (click)="contactDetailsExpanded.update(value => !value)">
                  <span><i class="bi bi-chat-square-text" aria-hidden="true"></i> Contact &amp; Social Media <small>(Optional)</small></span>
                  <i class="bi" [class.bi-chevron-down]="!contactDetailsExpanded()" [class.bi-chevron-up]="contactDetailsExpanded()" aria-hidden="true"></i>
                </button>
                @if (contactDetailsExpanded()) {
                  <div id="contact-social-details" class="details-panel">
                    <p class="details-help">Add only the contact channels you want customers to see.</p>
                    <div class="field-group"><label for="whatsapp">WhatsApp <span class="optional">(Optional)</span></label><input id="whatsapp" formControlName="whatsapp" inputmode="tel" autocomplete="tel" placeholder="98765 43210" [class.is-invalid]="showAdvancedError('whatsapp')" />@if (showAdvancedError('whatsapp')) { <p class="field-error">Enter a valid Indian WhatsApp number.</p> }</div>
                    <div class="field-group"><label for="email">Email <span class="optional">(Optional)</span></label><input id="email" type="email" formControlName="email" autocomplete="email" [class.is-invalid]="showAdvancedError('email')" />@if (showAdvancedError('email')) { <p class="field-error">Enter a valid email address.</p> }</div>
                    <div class="field-group"><label for="website">Website <span class="optional">(Optional)</span></label><input id="website" type="url" formControlName="website" placeholder="https://example.com" [class.is-invalid]="showAdvancedError('website')" />@if (showAdvancedError('website')) { <p class="field-error">Enter a valid website URL.</p> }</div>
                    <div class="advanced-grid">
                      <div class="field-group"><label for="facebook">Facebook <span class="optional">(Optional)</span></label><input id="facebook" type="url" formControlName="facebook" placeholder="facebook.com/yourpage" [class.is-invalid]="showAdvancedError('facebook')" />@if (showAdvancedError('facebook')) { <p class="field-error">Enter a valid Facebook URL.</p> }</div>
                      <div class="field-group"><label for="instagram">Instagram <span class="optional">(Optional)</span></label><input id="instagram" type="url" formControlName="instagram" placeholder="instagram.com/yourpage" [class.is-invalid]="showAdvancedError('instagram')" />@if (showAdvancedError('instagram')) { <p class="field-error">Enter a valid Instagram URL.</p> }</div>
                      <div class="field-group"><label for="youtube">YouTube <span class="optional">(Optional)</span></label><input id="youtube" type="url" formControlName="youtube" placeholder="youtube.com/@yourchannel" [class.is-invalid]="showAdvancedError('youtube')" />@if (showAdvancedError('youtube')) { <p class="field-error">Enter a valid YouTube URL.</p> }</div>
                    </div>
                  </div>
                }
              </section>

              <section class="advanced-details" aria-label="Optional business details and photos">
                <button type="button" class="button button--secondary details-toggle" [attr.aria-expanded]="businessDetailsExpanded()" aria-controls="business-details" (click)="businessDetailsExpanded.update(value => !value)">
                  <span><i class="bi bi-building" aria-hidden="true"></i> Business Details &amp; Photos <small>(Optional)</small></span>
                  <i class="bi" [class.bi-chevron-down]="!businessDetailsExpanded()" [class.bi-chevron-up]="businessDetailsExpanded()" aria-hidden="true"></i>
                </button>
                @if (businessDetailsExpanded()) {
                  <div id="business-details" class="details-panel">
                    <div class="field-group"><label for="provider_description">Provider bio <span class="optional">(Optional)</span></label><textarea id="provider_description" formControlName="provider_description" rows="2" maxlength="2000"></textarea></div>
                    <div class="field-group"><label for="address">Business address <span class="optional">(Optional)</span></label><input id="address" formControlName="address" maxlength="500" /></div>
                    <div class="field-group"><label for="postal_code">Postal code <span class="optional">(Optional)</span></label><input id="postal_code" formControlName="postal_code" maxlength="16" inputmode="numeric" /></div>
                    @if (!editing()) { <p class="details-help">Take or choose photos now. They will be uploaded after you save your service.</p> }
                    <app-media-upload entityType="listing" [entityId]="existingId() ?? ''" [maxFiles]="10" [maxFileSizeMb]="5" [maxWidth]="1600" [autoUpload]="true" [showCameraActions]="true" headingId="service-images-title" />
                  </div>
                }
              </section>

              @if (errorMessage(); as message) { <div class="notice notice--error" role="alert">{{ message }}</div> }
              <button type="submit" class="button button--primary submit-button" [disabled]="saving() || form.invalid">{{ saving() ? 'Submitting...' : (editing() ? 'Save changes' : 'Submit Service') }}</button>
            </form>
          }
        }
      </div>
    </main>
  `,
  styles: `
    :host { display:block; min-height:100%; } .quick-submit { min-height:100vh; padding:1.25rem 1rem 3rem; background:#fbfcfe; color:var(--cdm-navy); } .quick-submit__inner { width:min(100%, 660px); margin:auto; } .back-link { display:inline-flex; gap:.45rem; align-items:center; min-height:44px; color:var(--cdm-navy); text-decoration:none; font-weight:700; } .page-header { margin:1.25rem 0 1.5rem; } .eyebrow { margin:0 0 .35rem; color:var(--cdm-orange); font-size:.72rem; font-weight:800; letter-spacing:.12em; } h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.8rem,7vw,2.45rem); line-height:1.1; } .page-header p:last-child { margin:.6rem 0 0; color:#52657b; font-size:1rem; } form { display:grid; gap:1.15rem; padding:clamp(1rem,4vw,1.75rem); border:1px solid #dce4ed; border-radius:16px; background:#fff; box-shadow:0 8px 25px rgba(0,32,80,.06); } .field-group { display:grid; gap:.42rem; min-width:0; } label, legend { color:var(--cdm-navy); font-weight:750; } legend { float:none; width:auto; padding:0; margin:0 0 .45rem; } label > span, legend > span { color:#b24b2a; } input:not([type=radio]), textarea { width:100%; min-height:48px; padding:.7rem .8rem; border:1px solid #b9c8d8; border-radius:9px; color:#172b43; background:#fff; font:inherit; font-size:1rem; } textarea { min-height:84px; resize:vertical; } input:focus, textarea:focus { outline:3px solid rgba(7,85,184,.18); border-color:#0755B8; } input.is-invalid { border-color:#b42318; } .optional { color:#52657b; font-size:.86rem; font-weight:500; } .segmented-control { display:grid; grid-template-columns:repeat(3,1fr); gap:.4rem; } .segmented-control label { display:flex; align-items:center; justify-content:center; min-height:46px; padding:.4rem; border:1px solid #b9c8d8; border-radius:8px; color:#52657b; cursor:pointer; text-align:center; font-size:.9rem; } .segmented-control label.is-selected { border-color:#0755B8; color:#002050; background:#eaf2fd; } .segmented-control input { position:absolute; opacity:0; } .category-assistant { display:grid; gap:.45rem; padding:1rem; border:1px solid #cfe0f5; border-radius:12px; background:#f5f9ff; } .category-assistant h2 { margin:0; font-size:1.05rem; } .category-assistant p { margin:0; color:#52657b; } .category-assistant small, .verified-hint { color:#52657b; line-height:1.45; } .button { display:inline-flex; align-items:center; justify-content:center; gap:.4rem; min-height:46px; padding:.65rem 1rem; border:1px solid transparent; border-radius:8px; font:inherit; font-weight:750; text-decoration:none; cursor:pointer; } .button:disabled { cursor:not-allowed; opacity:.55; } .button--primary { color:#fff; background:#0755B8; border-color:#0755B8; } .button--secondary { width:max-content; color:#002050; background:#fff; border-color:#0755B8; } .submit-button { width:100%; margin-top:.15rem; min-height:52px; background:#002050; border-color:#002050; font-size:1rem; } .suggestion { display:grid; gap:.2rem; padding:.8rem; border:1px solid #0DA68C; border-radius:9px; background:#effbf8; } .suggestion span { font-weight:700; } .suggestion small { color:#52657b; } .suggestion-actions { display:flex; flex-wrap:wrap; gap:.5rem; margin-top:.45rem; } .suggestion-actions .button { min-height:40px; font-size:.86rem; } .text-button { border:0; color:#0755B8; background:none; font:inherit; font-size:.86rem; font-weight:700; cursor:pointer; } .phone-input { display:grid; grid-template-columns:auto 1fr; align-items:center; gap:.6rem; padding-left:.8rem; border:1px solid #b9c8d8; border-radius:9px; } .phone-input span { font-weight:750; } .phone-input input { border:0; padding-left:0; } .phone-input:focus-within { outline:3px solid rgba(7,85,184,.18); border-color:#0755B8; } .field-error { margin:0; color:#b42318; font-size:.84rem; } .verified-hint { color:#087f6c; font-size:.84rem; } .notice, .success-card { margin:1rem 0; padding:1rem; border-radius:12px; } .notice--info { color:#002050; background:#eaf2fd; } .notice--warning { background:#fff5e8; } .notice--error { color:#8b1e16; background:#fff0ed; } .notice h1 { font-size:1.4rem; } .notice p { color:#52657b; } .success-card { display:grid; justify-items:center; gap:.7rem; padding:2rem 1.25rem; background:#effbf8; text-align:center; } .success-card h1 { font-size:1.65rem; } .success-card p { max-width:42ch; color:#52657b; line-height:1.6; } .success-icon { display:grid; place-items:center; width:58px; height:58px; border-radius:50%; color:#fff; background:#0DA68C; font-size:1.6rem; } .status-message { display:flex; gap:.6rem; align-items:center; color:#52657b; } .more-details { display:grid; gap:.5rem; padding-top:.8rem; border-top:1px solid #dce4ed; } .more-details summary { cursor:pointer; color:#0755B8; font-weight:750; } .more-details p { margin:0 0 .4rem; color:#52657b; font-size:.9rem; } .more-details label { margin-top:.4rem; } @media (max-width:380px) { .segmented-control { grid-template-columns:1fr; } .segmented-control label { justify-content:flex-start; padding-inline:.8rem; } form { padding:.9rem; } }
  `,
})
export class SubmitServiceComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly categories = inject(ServiceCategoryService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly submissions = inject(ServiceSubmissionService);
  private readonly assistant = inject(ServiceCategoryAssistantService);
  private readonly route = inject(ActivatedRoute);
  protected readonly form = this.fb.group({
    provider_type: this.fb.control<'individual' | 'business' | 'organisation'>('individual', Validators.required),
    display_name: this.fb.control('', [Validators.required, Validators.maxLength(160)]), category_description: this.fb.control('', Validators.maxLength(200)),
    parent_slug: this.fb.control('', Validators.required), category_id: this.fb.control('', Validators.required), title: this.fb.control('', [Validators.required, Validators.maxLength(200)]),
    phone: this.fb.control('', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]), description: this.fb.control('', Validators.maxLength(5000)), based_location_id: this.fb.control('', Validators.required),
    provider_description: this.fb.control('', Validators.maxLength(2000)), whatsapp: this.fb.control('', indianWhatsAppValidator()), email: this.fb.control('', contactValidator('email')), website: this.fb.control('', contactValidator('website')), facebook: this.fb.control('', contactValidator('facebook')), instagram: this.fb.control('', contactValidator('instagram')), youtube: this.fb.control('', contactValidator('youtube')), address: this.fb.control(''), postal_code: this.fb.control(''),
  });
  protected readonly providerTypes = [{ value: 'individual', label: 'Individual' }, { value: 'business', label: 'Business' }, { value: 'organisation', label: 'Organisation' }] as const;
  protected readonly loading = signal(true); protected readonly saving = signal(false); protected readonly success = signal(false); protected readonly errorMessage = signal<string | null>(null); protected readonly pendingUpdate = signal(false); protected readonly contactDetailsExpanded = signal(false); protected readonly businessDetailsExpanded = signal(false); protected readonly photoSetupNotice = signal(false);
  protected readonly categorySuggesting = signal(false); protected readonly categorySuggestion = signal<ServiceCategorySuggestion | null>(null); protected readonly categorySuggestionError = signal<string | null>(null); protected readonly locationRows = signal<DirectoryLocation[]>([]); protected readonly existingId = signal<string | null>(null); protected readonly existingStatus = signal<string | null>(null);
  protected readonly selectedParentSlug = signal('');
  protected readonly editing = computed(() => Boolean(this.existingId())); protected readonly published = computed(() => this.existingStatus() === 'published');
  protected readonly parentCategoryOptions = computed<readonly SearchableSelectOption[]>(() => this.categories.categories().map(category => ({ value: category.slug, label: `${category.nameEnglish} — ${category.nameTamil}`, searchText: `${category.nameEnglish} ${category.nameTamil} ${category.slug}` })));
  protected readonly subcategoryOptions = computed<readonly SearchableSelectOption[]>(() => (this.categories.categories().find(category => category.slug === this.selectedParentSlug())?.subcategories ?? []).map(category => ({ value: category.id, label: `${category.nameEnglish} — ${category.nameTamil}`, searchText: `${category.nameEnglish} ${category.nameTamil} ${category.slug}` })));
  protected readonly placeOptions = computed(() => locationSearchOptions(this.locationRows(), 'en'));
  private loadedProviderId: string | null = null; private preservedContacts: SubmissionContactInput[] = []; private preservedLocations: SubmissionFormInput['locations'] = []; private preservedCoordinates = { latitude: null as number | null, longitude: null as number | null };

  ngOnInit(): void { void this.load(); }
  protected showError(control: 'display_name' | 'title' | 'phone'): boolean { const field = this.form.controls[control]; return field.touched && field.invalid; }
  protected showAdvancedError(control: 'whatsapp' | 'email' | 'website' | 'facebook' | 'instagram' | 'youtube'): boolean { const field = this.form.controls[control]; return field.touched && field.invalid; }
  protected selectParentValue(value: SearchableSelectValue): void { if (typeof value !== 'string') return; this.selectedParentSlug.set(value); this.form.controls.parent_slug.setValue(value); this.form.controls.category_id.reset(''); this.categorySuggestion.set(null); }
  protected async suggestCategory(): Promise<void> { const text = this.form.controls.category_description.value.trim(); if (text.length < 2 || this.categorySuggesting()) return; this.categorySuggesting.set(true); this.categorySuggestionError.set(null); this.categorySuggestion.set(null); try { const suggestion = await this.assistant.suggest(text); if (suggestion) this.categorySuggestion.set(suggestion); else this.categorySuggestionError.set('No confident match found. Please choose a category manually.'); } catch { this.categorySuggestionError.set('Category assistance is unavailable right now. Please choose a category manually.'); } finally { this.categorySuggesting.set(false); } }
  protected confirmCategorySuggestion(): void { const suggestion = this.categorySuggestion(); if (!suggestion) return; this.selectedParentSlug.set(suggestion.parent.slug); this.form.controls.parent_slug.setValue(suggestion.parent.slug); this.form.controls.category_id.setValue(suggestion.subcategory.id); this.form.controls.category_id.markAsDirty(); this.categorySuggestion.set(null); }
  protected dismissCategorySuggestion(): void { this.categorySuggestion.set(null); }
  protected async save(): Promise<void> {
    this.form.markAllAsTouched(); if (this.form.invalid || this.saving()) return; this.saving.set(true); this.errorMessage.set(null);
    try {
      const raw = this.form.getRawValue(); const phone = `+91${raw.phone}`; const contacts = this.preservedContacts.filter(contact => !['phone', 'whatsapp', 'email', 'website', 'facebook', 'instagram', 'youtube'].includes(contact.contact_type));
      contacts.unshift({ contact_type: 'phone', contact_value: phone, is_public: true, sort_order: 0 });
      const whatsapp = raw.whatsapp.trim() ? normalizeContactValue('whatsapp', raw.whatsapp) : null; if (whatsapp) contacts.push({ contact_type: 'whatsapp', contact_value: whatsapp, is_public: true, sort_order: contacts.length });
      const email = raw.email.trim() ? normalizeContactValue('email', raw.email) : null; if (email) contacts.push({ contact_type: 'email', contact_value: email, is_public: true, sort_order: contacts.length });
      const website = raw.website.trim() ? normalizeContactValue('website', raw.website) : null; if (website) contacts.push({ contact_type: 'website', contact_value: website, is_public: true, sort_order: contacts.length });
      for (const type of ['facebook', 'instagram', 'youtube'] as const) { const value = raw[type].trim() ? normalizeContactValue(type, raw[type]) : null; if (value) contacts.push({ contact_type: type, contact_value: value, is_public: true, sort_order: contacts.length }); }
      // Keep compatibility with the currently deployed NOT NULL constraint. An empty
      // description is an intentional optional value, not generated placeholder text.
      const input: SubmissionFormInput = { listingId: this.existingId(), providerId: this.loadedProviderId, provider: { provider_type: raw.provider_type, display_name: raw.display_name.trim(), description: raw.provider_description.trim() || null, public_email: email, website_url: website, address: raw.address.trim() || null, postal_code: raw.postal_code.trim() || null, latitude: this.preservedCoordinates.latitude, longitude: this.preservedCoordinates.longitude }, listing: { category_id: raw.category_id, title: raw.title.trim(), description: raw.description.trim() }, contacts, locations: [{ location_id: raw.based_location_id, coverage_type: 'based_here' }, ...this.preservedLocations.filter(location => location.location_id !== raw.based_location_id)], submitForReview: true };
      this.success.set(false);
      const creating = !this.existingId();
      const savedListingId = await (this.published() ? this.submissions.saveRevision(input) : this.submissions.save(input));
      if (creating) {
        this.existingId.set(savedListingId);
        this.existingStatus.set('pending_review');
        this.businessDetailsExpanded.set(true);
        this.photoSetupNotice.set(true);
      } else {
        this.success.set(true);
      }
    } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to submit this service. Please try again.'); } finally { this.saving.set(false); }
  }
  private async load(): Promise<void> { try { await this.categories.load(); this.locationRows.set(await this.directory.locations()); const id = this.route.snapshot.paramMap.get('id'); const verifiedPhone = this.auth.phoneVerified() ? this.auth.user()?.phone ?? '' : ''; if (!id) { this.form.controls.phone.setValue(verifiedPhone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10)); return; } const existing = await this.submissions.getMine(id); if (!existing) throw new Error('This submission was not found.'); this.existingId.set(existing.id); this.existingStatus.set(existing.status); this.pendingUpdate.set(Boolean(existing.service_listing_revisions?.some(revision => revision.status === 'pending_review'))); this.loadedProviderId = existing.provider_id; this.preservedCoordinates = { latitude: existing.service_providers.latitude, longitude: existing.service_providers.longitude }; const path = findCategoryPathById(this.categories.categories(), existing.category_id); this.selectedParentSlug.set(path?.[0]?.slug ?? ''); this.preservedContacts = (existing.listing_contacts ?? []).map(contact => ({ ...contact })); this.preservedLocations = (existing.listing_locations ?? []).flatMap(location => location.locations?.id ? [{ location_id: location.locations.id, coverage_type: location.coverage_type }] : []); const contactValue = (type: SubmissionContactInput['contact_type']): string => this.preservedContacts.find(contact => contact.contact_type === type)?.contact_value ?? ''; const phone = contactValue('phone') || verifiedPhone; this.form.patchValue({ provider_type: existing.service_providers.provider_type as 'individual' | 'business' | 'organisation', display_name: existing.service_providers.display_name, provider_description: existing.service_providers.description ?? '', parent_slug: path?.[0]?.slug ?? '', category_id: existing.category_id, title: existing.title, description: existing.description ?? '', based_location_id: this.preservedLocations.find(location => location.coverage_type === 'based_here')?.location_id ?? '', phone: phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10), whatsapp: contactValue('whatsapp'), email: contactValue('email') || existing.service_providers.public_email || '', website: contactValue('website') || existing.service_providers.website_url || '', facebook: contactValue('facebook'), instagram: contactValue('instagram'), youtube: contactValue('youtube'), address: existing.service_providers.address ?? '', postal_code: existing.service_providers.postal_code ?? '' }); } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load the submission form.'); } finally { this.loading.set(false); } }
}
