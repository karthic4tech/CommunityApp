import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { findCategoryPathById } from '../core/models/service-category';
import { DirectoryLocation, locationSearchOptions, normalizeContactValue } from '../core/models/service-listing';
import { SubmissionContactInput, SubmissionFormInput } from '../core/models/service-submission';
import { CapturedServiceCoordinates, LocationCaptureError, LocationCaptureFailure, ServiceCoordinates, ServiceLocationSource, isValidServiceCoordinates, requestCurrentServiceLocation, validateGoogleMapsLocationUrl } from '../core/models/service-location';
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
                <label for="phone">Mobile Number <span class="optional">(Optional)</span></label>
                <div class="phone-input"><span aria-hidden="true">+91</span><input id="phone" formControlName="phone" autocomplete="tel" inputmode="numeric" maxlength="10" placeholder="98765 43210" [class.is-invalid]="showError('phone')" /></div>
                @if (showError('phone')) { <p class="field-error">Enter a valid 10-digit Indian mobile number, or leave it blank.</p> }
                @if (auth.phoneVerified()) { <small class="verified-hint"><i class="bi bi-shield-check" aria-hidden="true"></i> Prefilled from your verified account. You can change it.</small> }
              </div>

              <div class="field-group">
                <label for="description">Service Description <span class="optional">(Optional)</span></label>
                <textarea id="description" formControlName="description" rows="3" maxlength="5000" placeholder="Briefly describe your service..."></textarea>
              </div>

              @if (isLodgeCategory()) {
                <section class="lodge-details" aria-labelledby="lodge-details-title">
                  <h2 id="lodge-details-title">Lodge details / தங்குமிட விவரங்கள் <span class="optional">(Optional)</span></h2>
                  <p>Share amenities and an indicative per-room nightly price if available. Guests should confirm current rates directly. / வசதிகளையும், கிடைத்தால் அறைக்கான ஒரு இரவு தோராய விலையையும் சேர்க்கவும். தற்போதைய விலையை விருந்தினர்கள் நேரடியாக உறுதிப்படுத்த வேண்டும்.</p>
                  <div class="field-group"><label for="room-amenities">Room amenities / அறை வசதிகள்</label><textarea id="room-amenities" formControlName="room_amenities_text" rows="2" maxlength="500" placeholder="e.g. Wi-Fi, air conditioning, parking"></textarea><small>Separate amenities with commas. / வசதிகளை காற்புள்ளியால் பிரிக்கவும்.</small></div>
                  <div class="field-group"><label for="indicative-room-price">Indicative price per room / night (₹) <span class="optional">(Optional)</span> / அறை / இரவுக்கான தோராய விலை (₹)</label><input id="indicative-room-price" type="number" min="0" max="99999999" step="0.01" formControlName="indicative_room_price" inputmode="decimal" placeholder="Leave blank if unknown" /><small>Shown on public Hotels &amp; stays listings when provided. Confirm current rates directly with the lodge.</small></div>
                </section>
              }

              <div class="field-group">
                <app-searchable-select controlId="based_location_id" label="Location" formControlName="based_location_id" [options]="placeOptions()" [required]="true" [clearable]="true" [emptyValue]="''" placeholder="e.g. Chidambaram, Annamalai Nagar" searchPlaceholder="Search localities in English or Tamil…" />
                @if (form.controls.based_location_id.touched && form.controls.based_location_id.invalid) { <p class="field-error">Choose your location.</p> }
              </div>

              <section class="service-location" aria-labelledby="service-location-title">
                <div class="location-heading"><h2 id="service-location-title">Service Location / சேவை இருப்பிடம் <span>(Optional / விருப்பம்)</span></h2><i class="bi bi-geo-alt" aria-hidden="true"></i></div>
                <p>Optional. Add a location customers can visit. Capture GPS only while at the business location. / விருப்பம். வாடிக்கையாளர்கள் வரக்கூடிய இடத்தைச் சேர்க்கவும். வணிக இடத்தில் இருக்கும்போது மட்டும் GPS பதிவு செய்யவும்.</p>

                <div class="location-method-grid" role="radiogroup" aria-label="Choose a service location method / சேவை இருப்பிட முறையைத் தேர்ந்தெடுக்கவும்">
                  <label class="location-method-card" [class.is-selected]="locationMethod() === 'gps'">
                    <input type="radio" name="service-location-method" [checked]="locationMethod() === 'gps'" (change)="selectLocationMethod('gps')" />
                    <span class="location-method-icon bi bi-crosshair" aria-hidden="true"></span>
                    <span class="location-method-copy"><strong>Use My Current Location</strong><small>GPS · தற்போதைய இருப்பிடம்</small></span>
                  </label>
                  <label class="location-method-card" [class.is-selected]="locationMethod() === 'google_maps_link'">
                    <input type="radio" name="service-location-method" [checked]="locationMethod() === 'google_maps_link'" (change)="selectLocationMethod('google_maps_link')" />
                    <span class="location-method-icon bi bi-map" aria-hidden="true"></span>
                    <span class="location-method-copy"><strong>Paste Google Maps Link</strong><small>Google Maps இணைப்பை ஒட்டவும்</small></span>
                  </label>
                </div>

                @if (locationMethod() === 'gps') {
                  <div class="location-method-panel">
                    @if (locationCaptureState() === 'loading') { <p class="location-status" role="status">Getting your location… / இருப்பிடத்தைப் பெறுகிறது…</p> }
                    @switch (locationCaptureState()) {
                      @case ('denied') { <p class="location-error" role="alert">Location permission was denied. Allow location access in your browser settings and retry. / இருப்பிட அனுமதி மறுக்கப்பட்டது. உலாவி அமைப்புகளில் அனுமதித்து மீண்டும் முயற்சிக்கவும்.</p> }
                      @case ('timeout') { <p class="location-error" role="alert">GPS timed out. Move to an open area and retry. / GPS நேரம் முடிந்தது. திறந்த இடத்திற்குச் சென்று மீண்டும் முயற்சிக்கவும்.</p> }
                      @case ('unavailable') { <p class="location-error" role="alert">Your location is unavailable. Check device location settings and retry. / இருப்பிடத்தைக் கண்டறிய முடியவில்லை. சாதன அமைப்புகளைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.</p> }
                      @case ('unsupported') { <p class="location-error" role="alert">This browser does not provide GPS location. / இந்த உலாவியில் GPS இருப்பிட வசதி இல்லை.</p> }
                    }
                    @if (pendingLocation(); as candidate) {
                      <div class="location-candidate" aria-live="polite">
                        <strong>Location found — confirm before saving / இருப்பிடம் கிடைத்தது — சேமிப்பதற்கு முன் உறுதிப்படுத்தவும்</strong>
                        <span>Latitude / அட்சரேகை: {{ formatCoordinate(candidate.latitude) }} · Longitude / தீர்க்கரேகை: {{ formatCoordinate(candidate.longitude) }}</span>
                        <span>GPS accuracy: ±{{ formatAccuracy(candidate.accuracy) }} m</span>
                        @if (candidate.accuracy > 100) { <p class="accuracy-warning">GPS accuracy is poor. Retry in a clearer area, or confirm if this is correct. / GPS துல்லியம் குறைவாக உள்ளது. தெளிவான இடத்தில் மீண்டும் முயற்சிக்கவும் அல்லது உறுதிப்படுத்தவும்.</p> }
                        <div class="location-actions">
                          <button type="button" class="location-action location-action--primary text-button" (click)="confirmLocation()">Confirm this location / இந்த இடத்தை உறுதிப்படுத்து</button>
                          <button type="button" class="location-action text-button" [disabled]="locationCaptureState() === 'loading'" (click)="captureLocation()">Retry / மீண்டும் முயற்சி</button>
                          <button type="button" class="location-action text-button" (click)="discardCapturedLocation()">Remove / நீக்கு</button>
                        </div>
                      </div>
                    } @else {
                      <button type="button" class="location-action location-action--primary text-button" [disabled]="locationCaptureState() === 'loading'" (click)="captureLocation()">
                        <i class="bi bi-crosshair" aria-hidden="true"></i> Add This Location / இந்த இடத்தைச் சேர்
                      </button>
                    }
                  </div>
                }

                @if (locationMethod() === 'google_maps_link') {
                  <div class="location-method-panel maps-link-panel">
                    <label for="google-maps-location-link">Google Maps Location Link / Google Maps இருப்பிட இணைப்பு</label>
                    <input id="google-maps-location-link" type="url" inputmode="url" autocomplete="url" [value]="googleMapsLinkDraft()" (input)="updateGoogleMapsLink($event)" placeholder="https://maps.app.goo.gl/..." [attr.aria-invalid]="googleMapsLinkError() ? 'true' : null" aria-describedby="maps-link-help" />
                    <p id="maps-link-help">In Google Maps, open the correct business place, choose Share, then Copy link and paste it here. / Google Maps-ல் சரியான வணிக இடத்தைத் திறந்து Share → Copy link செய்து இங்கே ஒட்டவும்.</p>
                    @if (googleMapsLinkError(); as message) { <p class="location-error" role="alert">{{ message }}</p> }
                    <div class="location-actions">
                      <a class="location-action text-button" href="https://www.google.com/maps/" target="_blank" rel="noopener noreferrer"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i> Open Google Maps / Google Maps திறக்க</a>
                      @if (!pendingGoogleMapsUrl()) { <button type="button" class="location-action location-action--primary text-button" [disabled]="!googleMapsLinkDraft().trim()" (click)="validateMapsLink()">Check Link / இணைப்பைச் சரிபார்</button> }
                    </div>
                    @if (pendingGoogleMapsUrl(); as candidateUrl) {
                      <div class="location-candidate" aria-live="polite">
                        <strong>Review this link before saving / சேமிப்பதற்கு முன் இணைப்பைச் சரிபார்க்கவும்</strong>
                        @if (pendingMapCoordinates(); as coordinates) {
                          <span>Coordinates found / ஆயத்தொலைவுகள்: {{ formatCoordinate(coordinates.latitude) }}, {{ formatCoordinate(coordinates.longitude) }}</span>
                        } @else {
                          <span>No coordinates were extracted. Customers will open the saved map link; none are guessed. / ஆயத்தொலைவுகள் கிடைக்கவில்லை. எந்த ஆயத்தொலைவும் ஊகிக்கப்படாது.</span>
                        }
                        <div class="location-actions">
                          <a class="location-action text-button" [href]="candidateUrl" target="_blank" rel="noopener noreferrer"><i class="bi bi-eye" aria-hidden="true"></i> Preview map / வரைபடத்தைப் பார்க்க</a>
                          <button type="button" class="location-action location-action--primary text-button" (click)="confirmGoogleMapsLink()">Confirm this location / இந்த இடத்தை உறுதிப்படுத்து</button>
                          <button type="button" class="location-action text-button" (click)="discardGoogleMapsLink()">Remove / நீக்கு</button>
                        </div>
                        <p class="link-confirm-help">Confirm only if the preview points to the correct service location. / முன்னோட்டம் சரியான சேவை இடத்தைக் காட்டினால் மட்டும் உறுதிப்படுத்தவும்.</p>
                      </div>
                    }
                  </div>
                }

                @if (hasSavedLocation()) {
                  <div class="saved-location" role="status">
                    <strong>Saved service location / சேமித்த சேவை இருப்பிடம்</strong>
                    @if (hasSavedCoordinates()) { <span>Latitude / அட்சரேகை: {{ formatCoordinate(savedCoordinates().latitude!) }} · Longitude / தீர்க்கரேகை: {{ formatCoordinate(savedCoordinates().longitude!) }}</span> }
                    @if (confirmedAccuracy(); as accuracy) { <span>GPS accuracy: ±{{ formatAccuracy(accuracy) }} m</span> }
                    @if (validatedSavedGoogleMapsUrl(); as savedUrl) { <a class="saved-map-link" [href]="savedUrl" target="_blank" rel="noopener noreferrer">Preview saved Google Maps link / சேமித்த வரைபட இணைப்பைப் பார்க்க</a> }
                    @if (savedGoogleMapsUrl() && !validatedSavedGoogleMapsUrl()) { <p class="location-error">Saved link is not a supported Google Maps URL. Remove it or replace it before saving. / சேமித்த இணைப்பு ஆதரிக்கப்படும் Google Maps இணைப்பு அல்ல; நீக்கவும் அல்லது மாற்றவும்.</p> }
                    <button type="button" class="remove-saved-location text-button" (click)="removeSavedLocation()">Remove saved location / சேமித்த இடத்தை நீக்கு</button>
                  </div>
                } @else if (hasPartialSavedCoordinates()) {
                  <p class="location-error" role="status">Saved location data is incomplete and will be preserved unless you remove it. / சேமித்த இருப்பிடத் தரவு முழுமையில்லை; நீக்கும் வரை அது மாற்றப்படாது.</p>
                }
              </section>

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
    .service-location { display:grid; gap:.7rem; padding:1rem; border:1px solid #cbd9e8; border-radius:14px; background:#f8fbff; }
    .location-heading { display:flex; align-items:center; justify-content:space-between; gap:.75rem; }
    .location-heading h2 { margin:0; color:var(--cdm-navy); font-size:1.05rem; line-height:1.4; }
    .location-heading h2 span { color:#52657b; font-size:.82rem; font-weight:600; }
    .location-heading > i { color:#0755b8; font-size:1.2rem; }
    .service-location > p { margin:0; color:#52657b; font-size:.84rem; line-height:1.6; }
    .location-status,.location-error,.location-candidate,.saved-location { margin:0; padding:.8rem; border-radius:9px; font-size:.84rem; line-height:1.55; }
    .location-status { color:#0755b8; background:#eaf3ff; }
    .location-error { color:#8b1e1e; background:#fff1ef; }
    .saved-location,.location-candidate { display:grid; gap:.3rem; overflow-wrap:anywhere; }
    .saved-location { border:1px solid #b9ddcf; color:#155b49; background:#f0faf6; }
    .location-candidate { border:1px solid #bdd6f3; color:#173e69; background:#f1f7ff; }
    .location-candidate > strong,.saved-location > strong { color:var(--cdm-navy); }
    .accuracy-warning { margin:.25rem 0 0; padding:.6rem; border-radius:7px; color:#6b4500; background:#fff5d9; font-size:.82rem; line-height:1.5; }
    .location-actions { display:flex; flex-wrap:wrap; gap:.55rem; margin-top:.35rem; }
    .location-action { display:inline-flex; align-items:center; justify-content:center; gap:.4rem; min-height:44px; padding:.6rem .85rem; border:1px solid #b8c8da; border-radius:9px; color:#0755b8; background:#fff; font:inherit; font-size:.85rem; font-weight:750; cursor:pointer; }
    .location-action--primary { border-color:#087f69; color:#fff; background:#087f69; }
    .location-action:hover:not(:disabled) { border-color:#0755b8; background:#eff6ff; }
    .location-action--primary:hover:not(:disabled) { border-color:#066653; background:#066653; }
    .location-action:disabled { cursor:wait; opacity:.6; }
    .remove-saved-location { justify-self:start; min-height:44px; padding:.4rem 0; border:0; color:#9d2525; background:transparent; font:inherit; font-size:.82rem; font-weight:700; text-decoration:underline; text-underline-offset:.15em; cursor:pointer; }
    .location-action:focus-visible,.remove-saved-location:focus-visible { outline:3px solid #0755b855; outline-offset:2px; }
    @media(max-width:520px) { .service-location { padding:.8rem; }.location-actions { display:grid; grid-template-columns:1fr; }.location-action { width:100%; }.location-heading h2 { font-size:.98rem; } }
    .location-method-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.65rem; }
    .location-method-card { position:relative; display:flex; align-items:center; gap:.65rem; min-width:0; min-height:76px; margin:0; padding:.8rem; border:1px solid #cbd9e8; border-radius:11px; color:#17324f; background:#fff; cursor:pointer; transition:border-color .15s ease,background-color .15s ease,box-shadow .15s ease; }
    .location-method-card.is-selected { border-color:#087f69; background:#effaf6; box-shadow:0 0 0 2px #087f6920; }
    .location-method-card input[type="radio"] { flex:0 0 18px; width:18px; height:18px; margin:0; accent-color:#087f69; }
    .location-method-icon { display:grid; place-items:center; flex:0 0 38px; width:38px; height:38px; border-radius:9px; color:#0755b8; background:#eaf3ff; font-size:1rem; }
    .location-method-copy { display:grid; min-width:0; gap:.15rem; }
    .location-method-copy strong { color:var(--cdm-navy); font-size:.84rem; line-height:1.35; }
    .location-method-copy small { color:#52657b; font-size:.73rem; line-height:1.35; }
    .location-method-panel { display:grid; gap:.65rem; min-width:0; padding:.85rem; border:1px solid #d7e2ed; border-radius:10px; background:#fff; }
    .maps-link-panel > label { margin:0; color:var(--cdm-navy); font-size:.84rem; font-weight:750; }
    .maps-link-panel input[type="url"] { width:100%; min-width:0; box-sizing:border-box; min-height:46px; padding:.65rem .75rem; border:1px solid #b9c8d8; border-radius:8px; color:#172b43; background:#fff; font:inherit; font-size:.9rem; }
    .maps-link-panel > p { margin:0; color:#52657b; font-size:.79rem; line-height:1.5; }
    .location-actions .location-action { text-decoration:none; }
    .location-actions a.location-action { color:#0755b8; }
    .link-confirm-help { margin:0; color:#52657b; font-size:.78rem; line-height:1.45; }
    .saved-location { min-width:0; }
    .saved-map-link { justify-self:start; max-width:100%; overflow-wrap:anywhere; color:#0755b8; font-size:.82rem; font-weight:700; }
    @media(max-width:520px) { .location-method-grid { grid-template-columns:1fr; }.location-method-card { min-height:68px; }.location-method-panel { padding:.7rem; }.location-actions { grid-template-columns:minmax(0,1fr); } }
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
    phone: this.fb.control('', Validators.pattern(/^[6-9]\d{9}$/)), description: this.fb.control('', Validators.maxLength(5000)), based_location_id: this.fb.control('', Validators.required),
    room_amenities_text: this.fb.control('', Validators.maxLength(500)), indicative_room_price: this.fb.control('', [Validators.pattern(/^\d{0,8}(?:\.\d{1,2})?$/)]),
    provider_description: this.fb.control('', Validators.maxLength(2000)), whatsapp: this.fb.control('', indianWhatsAppValidator()), email: this.fb.control('', contactValidator('email')), website: this.fb.control('', contactValidator('website')), facebook: this.fb.control('', contactValidator('facebook')), instagram: this.fb.control('', contactValidator('instagram')), youtube: this.fb.control('', contactValidator('youtube')), address: this.fb.control(''), postal_code: this.fb.control(''),
  });
  protected readonly providerTypes = [{ value: 'individual', label: 'Individual' }, { value: 'business', label: 'Business' }, { value: 'organisation', label: 'Organisation' }] as const;
  protected readonly loading = signal(true); protected readonly saving = signal(false); protected readonly success = signal(false); protected readonly errorMessage = signal<string | null>(null); protected readonly pendingUpdate = signal(false); protected readonly contactDetailsExpanded = signal(false); protected readonly businessDetailsExpanded = signal(false); protected readonly photoSetupNotice = signal(false);
  protected readonly categorySuggesting = signal(false); protected readonly categorySuggestion = signal<ServiceCategorySuggestion | null>(null); protected readonly categorySuggestionError = signal<string | null>(null); protected readonly locationRows = signal<DirectoryLocation[]>([]); protected readonly existingId = signal<string | null>(null); protected readonly existingStatus = signal<string | null>(null);
  protected readonly savedCoordinates = signal<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });
  protected readonly savedGoogleMapsUrl = signal<string | null>(null);
  protected readonly confirmedLocationSource = signal<ServiceLocationSource | null>(null);
  protected readonly locationMethod = signal<ServiceLocationSource | null>(null);
  protected readonly pendingLocation = signal<CapturedServiceCoordinates | null>(null);
  protected readonly confirmedAccuracy = signal<number | null>(null);
  protected readonly googleMapsLinkDraft = signal('');
  protected readonly pendingGoogleMapsUrl = signal<string | null>(null);
  protected readonly pendingMapCoordinates = signal<ServiceCoordinates | null>(null);
  protected readonly googleMapsLinkError = signal<string | null>(null);
  protected readonly locationCaptureState = signal<'idle' | 'loading' | 'ready' | LocationCaptureFailure>('idle');
  protected readonly hasSavedCoordinates = computed(() => isValidServiceCoordinates(this.savedCoordinates().latitude, this.savedCoordinates().longitude));
  protected readonly hasAnySavedCoordinates = computed(() => this.savedCoordinates().latitude !== null || this.savedCoordinates().longitude !== null);
  protected readonly hasPartialSavedCoordinates = computed(() => this.hasAnySavedCoordinates() && !this.hasSavedCoordinates());
  protected readonly hasSavedLocation = computed(() => this.hasAnySavedCoordinates() || Boolean(this.savedGoogleMapsUrl()));
  protected readonly validatedSavedGoogleMapsUrl = computed(() => validateGoogleMapsLocationUrl(this.savedGoogleMapsUrl() ?? '')?.url ?? null);
  protected readonly selectedParentSlug = signal('');
  protected readonly editing = computed(() => Boolean(this.existingId())); protected readonly published = computed(() => this.existingStatus() === 'published');
  protected readonly parentCategoryOptions = computed<readonly SearchableSelectOption[]>(() => this.categories.categories().map(category => ({ value: category.slug, label: `${category.nameEnglish} — ${category.nameTamil}`, searchText: `${category.nameEnglish} ${category.nameTamil} ${category.slug}` })));
  protected readonly subcategoryOptions = computed<readonly SearchableSelectOption[]>(() => (this.categories.categories().find(category => category.slug === this.selectedParentSlug())?.subcategories ?? []).map(category => ({ value: category.id, label: `${category.nameEnglish} — ${category.nameTamil}`, searchText: `${category.nameEnglish} ${category.nameTamil} ${category.slug}` })));
  protected readonly placeOptions = computed(() => locationSearchOptions(this.locationRows(), 'en'));
  protected isLodgeCategory(): boolean {
    const categoryId = this.form.controls.category_id.value;
    const lodgingSlugs = ['hotels', 'lodge-stay'];
    const categoryPath = categoryId ? findCategoryPathById(this.categories.categories(), categoryId) : undefined;
    return lodgingSlugs.includes(this.selectedParentSlug())
      || Boolean(categoryPath?.some(category => lodgingSlugs.includes(category.slug)));
  }
  private loadedProviderId: string | null = null; private preservedContacts: SubmissionContactInput[] = []; private preservedLocations: SubmissionFormInput['locations'] = [];

  ngOnInit(): void { void this.load(); }
  protected showError(control: 'display_name' | 'title' | 'phone'): boolean { const field = this.form.controls[control]; return field.touched && field.invalid; }
  protected showAdvancedError(control: 'whatsapp' | 'email' | 'website' | 'facebook' | 'instagram' | 'youtube'): boolean { const field = this.form.controls[control]; return field.touched && field.invalid; }
  protected selectLocationMethod(method: ServiceLocationSource): void {
    this.locationMethod.set(method);
    this.pendingLocation.set(null);
    this.locationCaptureState.set('idle');
    this.pendingGoogleMapsUrl.set(null);
    this.pendingMapCoordinates.set(null);
    this.googleMapsLinkError.set(null);
  }
  protected async captureLocation(): Promise<void> {
    if (this.locationCaptureState() === 'loading') return;
    this.pendingLocation.set(null);
    this.locationCaptureState.set('loading');
    try {
      this.pendingLocation.set(await requestCurrentServiceLocation(globalThis.navigator?.geolocation));
      this.locationCaptureState.set('ready');
    } catch (error) {
      this.locationCaptureState.set(error instanceof LocationCaptureError ? error.reason : 'unavailable');
    }
  }
  protected confirmLocation(): void {
    const candidate = this.pendingLocation();
    if (!candidate) return;
    const previousMapUrl = this.savedGoogleMapsUrl();
    this.savedCoordinates.set({ latitude: candidate.latitude, longitude: candidate.longitude });
    this.savedGoogleMapsUrl.set(null);
    if (previousMapUrl === this.googleMapsLinkDraft()) this.googleMapsLinkDraft.set('');
    this.confirmedLocationSource.set('gps');
    this.confirmedAccuracy.set(candidate.accuracy);
    this.pendingLocation.set(null);
    this.locationCaptureState.set('idle');
  }
  protected discardCapturedLocation(): void { this.pendingLocation.set(null); this.locationCaptureState.set('idle'); }
  protected updateGoogleMapsLink(event: Event): void {
    this.googleMapsLinkDraft.set((event.target as HTMLInputElement).value);
    this.pendingGoogleMapsUrl.set(null);
    this.pendingMapCoordinates.set(null);
    this.googleMapsLinkError.set(null);
  }
  protected validateMapsLink(): void {
    const candidate = validateGoogleMapsLocationUrl(this.googleMapsLinkDraft());
    if (!candidate) {
      this.pendingGoogleMapsUrl.set(null);
      this.pendingMapCoordinates.set(null);
      this.googleMapsLinkError.set('Enter a valid HTTPS Google Maps link, such as maps.app.goo.gl or google.com/maps. / சரியான HTTPS Google Maps இணைப்பை உள்ளிடவும்.');
      return;
    }
    this.googleMapsLinkError.set(null);
    this.pendingGoogleMapsUrl.set(candidate.url);
    this.pendingMapCoordinates.set(candidate.coordinates);
  }
  protected confirmGoogleMapsLink(): void {
    const candidateUrl = this.pendingGoogleMapsUrl();
    if (!candidateUrl) return;
    const coordinates = this.pendingMapCoordinates();
    this.savedCoordinates.set(coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : { latitude: null, longitude: null });
    this.savedGoogleMapsUrl.set(candidateUrl);
    this.confirmedLocationSource.set('google_maps_link');
    this.confirmedAccuracy.set(null);
    this.pendingGoogleMapsUrl.set(null);
    this.pendingMapCoordinates.set(null);
    this.googleMapsLinkDraft.set(candidateUrl);
  }
  protected discardGoogleMapsLink(): void {
    this.pendingGoogleMapsUrl.set(null);
    this.pendingMapCoordinates.set(null);
    this.googleMapsLinkError.set(null);
  }
  protected removeSavedLocation(): void {
    const previousMapUrl = this.savedGoogleMapsUrl();
    this.savedCoordinates.set({ latitude: null, longitude: null });
    this.savedGoogleMapsUrl.set(null);
    if (previousMapUrl === this.googleMapsLinkDraft()) this.googleMapsLinkDraft.set('');
    this.confirmedLocationSource.set(null);
    this.confirmedAccuracy.set(null);
  }
  protected formatCoordinate(value: number): string { return value.toFixed(6); }
  protected formatAccuracy(value: number): string { return String(Math.round(value)); }
  protected selectParentValue(value: SearchableSelectValue): void { if (typeof value !== 'string') return; this.selectedParentSlug.set(value); this.form.controls.parent_slug.setValue(value); this.form.controls.category_id.reset(''); this.categorySuggestion.set(null); }
  protected async suggestCategory(): Promise<void> { const text = this.form.controls.category_description.value.trim(); if (text.length < 2 || this.categorySuggesting()) return; this.categorySuggesting.set(true); this.categorySuggestionError.set(null); this.categorySuggestion.set(null); try { const suggestion = await this.assistant.suggest(text); if (suggestion) this.categorySuggestion.set(suggestion); else this.categorySuggestionError.set('No confident match found. Please choose a category manually.'); } catch { this.categorySuggestionError.set('Category assistance is unavailable right now. Please choose a category manually.'); } finally { this.categorySuggesting.set(false); } }
  protected confirmCategorySuggestion(): void { const suggestion = this.categorySuggestion(); if (!suggestion) return; this.selectedParentSlug.set(suggestion.parent.slug); this.form.controls.parent_slug.setValue(suggestion.parent.slug); this.form.controls.category_id.setValue(suggestion.subcategory.id); this.form.controls.category_id.markAsDirty(); this.categorySuggestion.set(null); }
  protected dismissCategorySuggestion(): void { this.categorySuggestion.set(null); }
  protected async save(): Promise<void> {
    this.form.markAllAsTouched(); if (this.form.invalid || this.saving()) return; this.saving.set(true); this.errorMessage.set(null);
    try {
      const raw = this.form.getRawValue(); const phone = raw.phone.trim() ? `+91${raw.phone.trim()}` : null; const contacts = this.preservedContacts.filter(contact => !['phone', 'whatsapp', 'email', 'website', 'facebook', 'instagram', 'youtube'].includes(contact.contact_type));
      if (phone) contacts.unshift({ contact_type: 'phone', contact_value: phone, is_public: true, sort_order: 0 });
      const whatsapp = raw.whatsapp.trim() ? normalizeContactValue('whatsapp', raw.whatsapp) : null; if (whatsapp) contacts.push({ contact_type: 'whatsapp', contact_value: whatsapp, is_public: true, sort_order: contacts.length });
      const email = raw.email.trim() ? normalizeContactValue('email', raw.email) : null; if (email) contacts.push({ contact_type: 'email', contact_value: email, is_public: true, sort_order: contacts.length });
      const website = raw.website.trim() ? normalizeContactValue('website', raw.website) : null; if (website) contacts.push({ contact_type: 'website', contact_value: website, is_public: true, sort_order: contacts.length });
      for (const type of ['facebook', 'instagram', 'youtube'] as const) { const value = raw[type].trim() ? normalizeContactValue(type, raw[type]) : null; if (value) contacts.push({ contact_type: type, contact_value: value, is_public: true, sort_order: contacts.length }); }
      // Keep compatibility with the currently deployed NOT NULL constraint. An empty
      // description is an intentional optional value, not generated placeholder text.
      const coordinates = this.savedCoordinates();
      const amenities = raw.room_amenities_text.split(/[\n,]/u).map(value => value.trim()).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).slice(0, 20);
      const priceValue = String(raw.indicative_room_price ?? '').trim();
      const roomPrice = priceValue ? Number(priceValue) : null;
      if (roomPrice !== null && (!Number.isFinite(roomPrice) || roomPrice < 0 || roomPrice > 99_999_999)) throw new Error('Enter a valid indicative room price or leave it blank.');
      const input: SubmissionFormInput = { listingId: this.existingId(), providerId: this.loadedProviderId, provider: { provider_type: raw.provider_type, display_name: raw.display_name.trim(), description: raw.provider_description.trim() || null, public_email: email, website_url: website, address: raw.address.trim() || null, postal_code: raw.postal_code.trim() || null, latitude: coordinates.latitude, longitude: coordinates.longitude, google_maps_url: this.savedGoogleMapsUrl(), location_source: this.confirmedLocationSource() }, listing: { category_id: raw.category_id, title: raw.title.trim(), description: raw.description.trim(), room_amenities: this.isLodgeCategory() ? amenities : [], indicative_room_price: this.isLodgeCategory() ? roomPrice : null }, contacts, locations: [{ location_id: raw.based_location_id, coverage_type: 'based_here' }, ...this.preservedLocations.filter(location => location.location_id !== raw.based_location_id)], submitForReview: true };
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
  private async load(): Promise<void> { try { await this.categories.load(); this.locationRows.set(await this.directory.locations()); const id = this.route.snapshot.paramMap.get('id'); const verifiedPhone = this.auth.phoneVerified() ? this.auth.user()?.phone ?? '' : ''; if (!id) { this.form.controls.phone.setValue(verifiedPhone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10)); return; } const existing = await this.submissions.getMine(id); if (!existing) throw new Error('This submission was not found.'); this.existingId.set(existing.id); this.existingStatus.set(existing.status); this.pendingUpdate.set(Boolean(existing.service_listing_revisions?.some(revision => revision.status === 'pending_review'))); this.loadedProviderId = existing.provider_id; const savedMapUrl = existing.service_providers.google_maps_url ?? null; const hasCoordinates = isValidServiceCoordinates(existing.service_providers.latitude, existing.service_providers.longitude); const restoredSource = existing.service_providers.location_source ?? (savedMapUrl ? 'google_maps_link' : hasCoordinates ? 'gps' : null); this.savedCoordinates.set({ latitude: existing.service_providers.latitude, longitude: existing.service_providers.longitude }); this.savedGoogleMapsUrl.set(savedMapUrl); this.confirmedLocationSource.set(restoredSource); this.locationMethod.set(restoredSource); this.googleMapsLinkDraft.set(savedMapUrl ?? ''); this.confirmedAccuracy.set(null); const path = findCategoryPathById(this.categories.categories(), existing.category_id); this.selectedParentSlug.set(path?.[0]?.slug ?? ''); this.preservedContacts = (existing.listing_contacts ?? []).map(contact => ({ ...contact })); this.preservedLocations = (existing.listing_locations ?? []).flatMap(location => location.locations?.id ? [{ location_id: location.locations.id, coverage_type: location.coverage_type }] : []); const contactValue = (type: SubmissionContactInput['contact_type']): string => this.preservedContacts.find(contact => contact.contact_type === type)?.contact_value ?? ''; const phone = contactValue('phone') || verifiedPhone; this.form.patchValue({ provider_type: existing.service_providers.provider_type as 'individual' | 'business' | 'organisation', display_name: existing.service_providers.display_name, provider_description: existing.service_providers.description ?? '', parent_slug: path?.[0]?.slug ?? '', category_id: existing.category_id, title: existing.title, description: existing.description ?? '', room_amenities_text: (existing.room_amenities ?? []).join(', '), indicative_room_price: existing.indicative_room_price === null || existing.indicative_room_price === undefined ? '' : String(existing.indicative_room_price), based_location_id: this.preservedLocations.find(location => location.coverage_type === 'based_here')?.location_id ?? '', phone: phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10), whatsapp: contactValue('whatsapp'), email: contactValue('email') || existing.service_providers.public_email || '', website: contactValue('website') || existing.service_providers.website_url || '', facebook: contactValue('facebook'), instagram: contactValue('instagram'), youtube: contactValue('youtube'), address: existing.service_providers.address ?? '', postal_code: existing.service_providers.postal_code ?? '' }); } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load the submission form.'); } finally { this.loading.set(false); } }
}
