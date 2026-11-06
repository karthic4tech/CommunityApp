import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { findCategoryPathById, ServiceCategory } from '../core/models/service-category';
import { contactValidationMessage, DirectoryLocation, ListingContact, locationOptions, locationSearchOptions, normalizeContactValue } from '../core/models/service-listing';
import { SubmissionFormInput } from '../core/models/service-submission';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { ServiceSubmissionService } from '../core/services/service-submission.service';
import { ServiceCategoryAssistantService, ServiceCategorySuggestion } from '../core/services/service-category-assistant.service';
import { ListingMediaService } from '../core/services/listing-media.service';
import { FormProgressComponent } from '../shared/forms/form-progress.component';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption, SearchableSelectValue } from '../shared/components/searchable-select/searchable-select.models';
import { FormRadioGroupComponent } from '../shared/forms/form-radio-group.component';

@Component({
  selector: 'app-submit-service',
  imports: [ReactiveFormsModule, RouterLink, FormProgressComponent, SearchableSelectComponent, FormRadioGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="submit-container">
      <div class="container-fluid px-3 px-md-4">
        <main class="submit-content mx-auto">
            <a class="back-link text-decoration-none mb-4 d-inline-flex align-items-center gap-2" routerLink="/my-submissions">
              <i class="bi bi-arrow-left"></i>
              <span>Back to my submissions</span>
            </a>

            @if (!loading()) {
              <div class="page-header mb-4">
                <p class="eyebrow text-uppercase fw-bold mb-2">Community service</p>
                <h1 class="page-title fw-bold mb-2">{{ editing() ? 'Edit your submission' : 'Add your service' }}</h1>
                <p class="page-intro mb-0">Share accurate service information with the CDM360 community. Submissions are reviewed before publication.</p>
              </div>
            }

            @if (loading()) {
              <div class="spinner-border text-success" role="status">
                <span class="visually-hidden">Loading…</span>
              </div>
            } @else if (!auth.emailVerified()) {
              <div class="alert alert-warning border-0 rounded-3 mb-4">
                <div class="d-flex gap-3">
                  <i class="bi bi-exclamation-triangle-fill flex-shrink-0" style="font-size:1.25rem;"></i>
                  <div>
                    <h5 class="alert-heading fw-bold">Verify your email first</h5>
                    <p class="mb-3 text-muted">Only verified accounts can submit services.</p>
                    <a routerLink="/auth/verify-email" class="btn btn-sm btn-warning">
                      <i class="bi bi-check-circle me-2"></i>Verify email
                    </a>
                  </div>
                </div>
              </div>
            } @else if (published() && pendingUpdate()) {
              <div class="alert alert-info border-0 rounded-3 mb-4">
                <div class="d-flex gap-3">
                  <i class="bi bi-info-circle-fill flex-shrink-0" style="font-size:1.25rem;"></i>
                  <div>
                    <h5 class="alert-heading fw-bold">Update awaiting review</h5>
                    <p class="mb-3 text-muted">An administrator must review the current update before another update can be submitted.</p>
                    <a routerLink="/my-submissions" class="btn btn-sm btn-outline-info">Return to my submissions</a>
                  </div>
                </div>
              </div>
            } @else {
              @if (published()) {
                <div class="alert alert-info border-0 rounded-3 mb-4">
                  <div class="d-flex gap-3">
                    <i class="bi bi-info-circle-fill flex-shrink-0" style="font-size:1.25rem;"></i>
                    <div>
                      <h5 class="alert-heading fw-bold">Update to published listing</h5>
                      <p class="mb-0 text-muted">The public version remains unchanged until an administrator approves this update.</p>
                    </div>
                  </div>
                </div>
              }

              <!-- Step Indicator -->
              <app-form-progress class="submission-progress" [steps]="submissionSteps" [currentStep]="step()" [allowForward]="true" (stepSelected)="step.set($event)" />

              <form [formGroup]="form" (ngSubmit)="step() === 4 ? save(true) : next()" class="submission-form card border-0 cdm-form" novalidate>
                <div class="card-body p-3 p-md-4">
                  
                  @if (step() === 1) {
                    <div class="form-section">
                      <div class="section-heading mb-4">
                        <span class="section-icon" aria-hidden="true"><i class="bi bi-card-checklist"></i></span>
                        <div><h2 class="h4 fw-bold mb-1">Business and service details</h2><p class="mb-0">Start with the details people will use to find and understand your service.</p></div>
                      </div>
                      
                      <div class="mb-5">
                        <fieldset class="provider-type-group">
                        <legend class="form-label fw-bold d-block mb-3">Provider type <span class="required-mark" aria-hidden="true">*</span></legend>
                        <div class="row g-3">
                          <div class="col-md-4">
                            <input class="btn-check" type="radio" id="provider-individual" formControlName="provider_type" value="individual" />
                            <label class="provider-choice btn btn-outline-success w-100 d-flex flex-column gap-2" for="provider-individual">
                              <i class="bi bi-person-fill" aria-hidden="true"></i>
                              <span>Individual</span>
                            </label>
                          </div>
                          <div class="col-md-4">
                            <input class="btn-check" type="radio" id="provider-business" formControlName="provider_type" value="business" />
                            <label class="provider-choice btn btn-outline-success w-100 d-flex flex-column gap-2" for="provider-business">
                              <i class="bi bi-shop" aria-hidden="true"></i>
                              <span>Business</span>
                            </label>
                          </div>
                          <div class="col-md-4">
                            <input class="btn-check" type="radio" id="provider-organisation" formControlName="provider_type" value="organisation" />
                            <label class="provider-choice btn btn-outline-success w-100 d-flex flex-column gap-2" for="provider-organisation">
                              <i class="bi bi-building" aria-hidden="true"></i>
                              <span>Organisation</span>
                            </label>
                          </div>
                        </div>
                        </fieldset>
                      </div>

                      <div class="mb-4">
                        <label for="display_name" class="form-label fw-bold">Provider or business name <span class="required-mark" aria-hidden="true">*</span></label>
                        <input class="form-control form-control-lg" id="display_name" formControlName="display_name" maxlength="160" required />
                        <div class="form-text">Use the name your customers or community members know you by.</div>
                      </div>

                      <div class="mb-4">
                        <label for="provider_description" class="form-label fw-bold">About the provider <span class="optional-mark">(optional)</span></label>
                        <textarea class="form-control form-control-lg" id="provider_description" formControlName="provider_description" rows="3" maxlength="2000" placeholder="Tell the community a little about your business or organisation"></textarea>
                        <div class="form-text">This describes you or your organisation, not an individual service.</div>
                      </div>

                       <div class="category-assistant mb-4">
                         <a class="category-help-link" routerLink="/help/choose-service-category"><i class="bi bi-question-circle" aria-hidden="true"></i> Need help choosing a category?</a>
                         <label for="category-description" class="form-label fw-bold">What service do you provide?</label>
                         <textarea id="category-description" class="form-control form-control-lg" formControlName="category_description" rows="2" maxlength="200" placeholder="Describe your business or service…"></textarea>
                         <div class="form-text">Describe it in English, Tamil or mixed Tamil-English, then let CDM 360 suggest the closest category.</div>
                         <button type="button" class="category-assist-button" [disabled]="categorySuggesting() || form.controls.category_description.value.trim().length < 2" (click)="suggestCategory()">
                           <i class="bi bi-stars" aria-hidden="true"></i>{{ categorySuggesting() ? 'Finding a category…' : 'Suggest category' }}
                         </button>
                         @if (categorySuggestion(); as suggestion) {
                           <div class="category-suggestion" role="status">
                             <div class="suggestion-icon"><i class="bi bi-check2-circle" aria-hidden="true"></i></div>
                             <div class="suggestion-copy"><strong>AI suggested category</strong><span>{{ suggestion.parent.nameEnglish }} — {{ suggestion.parent.nameTamil }}</span><small>{{ suggestion.subcategory.nameEnglish }} — {{ suggestion.subcategory.nameTamil }}</small><em>{{ suggestion.reason }}</em></div>
                             <div class="suggestion-actions"><button type="button" class="confirm-category" (click)="confirmCategorySuggestion()">Confirm</button><button type="button" class="change-category" (click)="dismissCategorySuggestion()">Change category</button></div>
                           </div>
                         }
                         @if (categorySuggestionError(); as message) { <p class="category-assist-error" role="status">{{ message }}</p> }
                       </div>

                       <div class="row g-4">
                        <div class="col-md-6">
                          <app-searchable-select controlId="parent_slug" label="Parent category" formControlName="parent_slug"
                            [options]="parentCategoryOptions()" [required]="true" [clearable]="true" [emptyValue]="''"
                            placeholder="Select a category" searchPlaceholder="Search in English or Tamil…"
                            [invalid]="form.controls.parent_slug.touched && form.controls.parent_slug.invalid"
                            [error]="form.controls.parent_slug.touched && form.controls.parent_slug.invalid ? 'Choose a parent category.' : ''"
                            (valueChange)="selectParentValue($event)" />
                        </div>
                        <div class="col-md-6">
                          <app-searchable-select controlId="category_id" label="Subcategory" formControlName="category_id"
                            [options]="subcategoryOptions()" [required]="true" [clearable]="true" [emptyValue]="''"
                            [disabled]="!selectedParentSlug() || !subcategoryOptions().length"
                            placeholder="Select a subcategory" searchPlaceholder="Search in English or Tamil…"
                            [invalid]="!!selectedParentSlug() && !!subcategoryOptions().length && form.controls.category_id.touched && form.controls.category_id.invalid"
                            [error]="selectedParentSlug() && subcategoryOptions().length && form.controls.category_id.touched && form.controls.category_id.invalid ? 'Choose a subcategory.' : ''" />
                        </div>
                      </div>

                      <div class="mb-4 mt-4">
                        <label for="title" class="form-label fw-bold">Service title <span class="required-mark" aria-hidden="true">*</span></label>
                        <input class="form-control form-control-lg" id="title" formControlName="title" maxlength="200" required />
                      </div>

                      <div class="mb-0">
                        <label for="description" class="form-label fw-bold">Service description <span class="required-mark" aria-hidden="true">*</span></label>
                        <textarea class="form-control form-control-lg" id="description" formControlName="description" rows="6" maxlength="5000" placeholder="Describe what you offer, who it is for and what makes your service useful" required></textarea>
                        <div class="form-text">A clear, specific description helps people decide if your service is right for them.</div>
                      </div>
                    </div>
                  }

                  @else if (step() === 2) {
                    <div class="form-section">
                      <h2 class="h4 fw-bold mb-2" style="color:var(--cdm-navy);">Public contacts</h2>
                      <p class="text-muted mb-5"><i class="bi bi-info-circle me-2"></i>Only checked contact details will be shown publicly. Web and social links without a protocol are saved with HTTPS.</p>

                      <div class="row g-4">
                        <div class="col-12">
                          <label for="phone" class="form-label fw-bold">Phone</label>
                          @let phoneError = contactError('phone', form.controls.phone.value);
                          <input class="form-control form-control-lg" id="phone" formControlName="phone" autocomplete="tel" inputmode="tel" maxlength="40" [class.is-invalid]="!!phoneError" [attr.aria-invalid]="phoneError ? 'true' : null" [attr.aria-describedby]="phoneError ? 'phone-error' : null" />
                          @if (phoneError; as message) { <div class="invalid-feedback d-block" id="phone-error" role="alert">{{ message }}</div> }
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="phone_public" formControlName="phone_public" />
                            <label class="form-check-label" for="phone_public">Show publicly</label>
                          </div>
                        </div>

                        <div class="col-12">
                          <label for="whatsapp" class="form-label fw-bold">WhatsApp</label>
                          @let whatsappError = contactError('whatsapp', form.controls.whatsapp.value);
                          <input class="form-control form-control-lg" id="whatsapp" formControlName="whatsapp" autocomplete="tel" inputmode="tel" maxlength="40" placeholder="+91 98765 43210" [class.is-invalid]="!!whatsappError" [attr.aria-invalid]="whatsappError ? 'true' : null" [attr.aria-describedby]="whatsappError ? 'whatsapp-error' : null" />
                          @if (whatsappError; as message) { <div class="invalid-feedback d-block" id="whatsapp-error" role="alert">{{ message }}</div> }
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="whatsapp_public" formControlName="whatsapp_public" />
                            <label class="form-check-label" for="whatsapp_public">Show publicly</label>
                          </div>
                        </div>

                        <div class="col-12">
                          <label for="email" class="form-label fw-bold">Email</label>
                          @let emailError = contactError('email', form.controls.email.value);
                          <input class="form-control form-control-lg" id="email" type="email" formControlName="email" autocomplete="email" maxlength="200" [class.is-invalid]="!!emailError" [attr.aria-invalid]="emailError ? 'true' : null" [attr.aria-describedby]="emailError ? 'email-error' : null" />
                          @if (emailError; as message) { <div class="invalid-feedback d-block" id="email-error" role="alert">{{ message }}</div> }
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="email_public" formControlName="email_public" />
                            <label class="form-check-label" for="email_public">Show publicly</label>
                          </div>
                        </div>

                        <div class="col-12">
                          <label for="website" class="form-label fw-bold">Website</label>
                          @let websiteError = contactError('website', form.controls.website.value);
                          <input class="form-control form-control-lg" id="website" type="url" formControlName="website" maxlength="500" placeholder="example.com or https://example.com" [class.is-invalid]="!!websiteError" [attr.aria-invalid]="websiteError ? 'true' : null" [attr.aria-describedby]="websiteError ? 'website-error' : null" />
                          @if (websiteError; as message) { <div class="invalid-feedback d-block" id="website-error" role="alert">{{ message }}</div> }
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="website_public" formControlName="website_public" />
                            <label class="form-check-label" for="website_public">Show publicly</label>
                          </div>
                        </div>

                        <div class="col-md-6">
                          <label for="facebook" class="form-label fw-bold">Facebook</label>
                          @let facebookError = contactError('facebook', form.controls.facebook.value);
                          <input class="form-control form-control-lg" id="facebook" type="url" formControlName="facebook" maxlength="500" placeholder="facebook.com/your-page" [class.is-invalid]="!!facebookError" [attr.aria-invalid]="facebookError ? 'true' : null" [attr.aria-describedby]="facebookError ? 'facebook-error' : null" />
                          @if (facebookError; as message) { <div class="invalid-feedback d-block" id="facebook-error" role="alert">{{ message }}</div> }
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="facebook_public" formControlName="facebook_public" />
                            <label class="form-check-label" for="facebook_public">Show publicly</label>
                          </div>
                        </div>

                        <div class="col-md-6">
                          <label for="instagram" class="form-label fw-bold">Instagram</label>
                          @let instagramError = contactError('instagram', form.controls.instagram.value);
                          <input class="form-control form-control-lg" id="instagram" type="url" formControlName="instagram" maxlength="500" placeholder="instagram.com/your-profile" [class.is-invalid]="!!instagramError" [attr.aria-invalid]="instagramError ? 'true' : null" [attr.aria-describedby]="instagramError ? 'instagram-error' : null" />
                          @if (instagramError; as message) { <div class="invalid-feedback d-block" id="instagram-error" role="alert">{{ message }}</div> }
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="instagram_public" formControlName="instagram_public" />
                            <label class="form-check-label" for="instagram_public">Show publicly</label>
                          </div>
                        </div>

                        <div class="col-12">
                          <label for="youtube" class="form-label fw-bold">YouTube</label>
                          @let youtubeError = contactError('youtube', form.controls.youtube.value);
                          <input class="form-control form-control-lg" id="youtube" type="url" formControlName="youtube" maxlength="500" placeholder="youtube.com/@your-channel or youtu.be/video" [class.is-invalid]="!!youtubeError" [attr.aria-invalid]="youtubeError ? 'true' : null" [attr.aria-describedby]="youtubeError ? 'youtube-error' : null" />
                          @if (youtubeError; as message) { <div class="invalid-feedback d-block" id="youtube-error" role="alert">{{ message }}</div> }
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="youtube_public" formControlName="youtube_public" />
                            <label class="form-check-label" for="youtube_public">Show publicly</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  }

                  @else if (step() === 3) {
                    <div class="form-section">
                      <h2 class="h4 fw-bold mb-2" style="color:var(--cdm-navy);">Location and service coverage</h2>
                      <p class="text-muted mb-5"><i class="bi bi-info-circle me-2"></i>Street address and coordinates are optional.</p>

                      <div class="row g-4">
                        <div class="col-md-6">
                          <app-searchable-select controlId="based_location_id" label="Business locality" formControlName="based_location_id"
                            [options]="placeOptions()" [clearable]="true" [emptyValue]="''" [loading]="loading() && !places().length"
                            placeholder="Select a locality" searchPlaceholder="Search localities in English or Tamil…" />
                        </div>
                        <div class="col-md-6"><app-form-radio-group label="Coverage type" groupId="coverage_type" [options]="coverageTypeOptions" formControlName="coverage_type" /></div>

                        <div class="col-md-6">
                          <label for="address" class="form-label fw-bold">Business address</label>
                          <input class="form-control form-control-lg" id="address" formControlName="address" maxlength="500" />
                        </div>
                        <div class="col-md-6">
                          <label for="postal_code" class="form-label fw-bold">Postal code</label>
                          <input class="form-control form-control-lg" id="postal_code" formControlName="postal_code" maxlength="16" />
                        </div>

                        <div class="col-md-6">
                          <label for="latitude" class="form-label fw-bold">Latitude</label>
                          <input class="form-control form-control-lg" id="latitude" type="number" formControlName="latitude" min="-90" max="90" step="any" />
                        </div>
                        <div class="col-md-6">
                          <label for="longitude" class="form-label fw-bold">Longitude</label>
                          <input class="form-control form-control-lg" id="longitude" type="number" formControlName="longitude" min="-180" max="180" step="any" />
                        </div>

                        <div class="col-12">
                          <fieldset class="coverage-fieldset" aria-describedby="coverage-hint">
                            <legend class="form-label fw-bold">Additional service areas <span class="optional-mark">(optional)</span></legend>
                            <label for="coverage-search" class="visually-hidden">Search service areas</label>
                            <div class="coverage-search"><i class="bi bi-search" aria-hidden="true"></i><input id="coverage-search" type="search" [value]="coverageSearch()" (input)="setCoverageSearch($event)" placeholder="Search localities in English or Tamil…" /></div>
                            <small id="coverage-hint" class="form-text">Choose every additional area your service covers.</small>
                            @if (filteredCoverageOptions().length) {
                              <div class="coverage-options">@for (place of filteredCoverageOptions(); track place.value) {
                                <label class="coverage-option"><input type="checkbox" [checked]="form.controls.coverage_ids.value.includes(place.value)" (change)="toggleCoverage(place.value,$event)"><span>{{ place.label }}</span></label>
                              }</div>
                            } @else { <p class="coverage-empty" role="status">No matching localities found.</p> }
                            @if (form.controls.coverage_ids.value.length) { <p class="coverage-count" role="status">{{ form.controls.coverage_ids.value.length }} area(s) selected</p> }
                          </fieldset>
                        </div>
                      </div>
                    </div>
                  }

                  @else {
                    <div class="form-section">
                      <h2 class="h4 fw-bold mb-4" style="color:var(--cdm-navy);">Review and submit</h2>
                      
                      <div class="card border-0 mb-4" style="background:var(--cdm-page);">
                        <div class="card-body">
                          <h3 class="h5 fw-bold mb-2" style="color:var(--cdm-navy);">{{ form.controls.title.value || 'Untitled service' }}</h3>
                          <p class="text-muted fw-600 mb-2">{{ form.controls.display_name.value }}</p>
                          <p class="mb-0">{{ form.controls.description.value }}</p>
                          <hr class="my-3">
                          <div class="row g-3 small">
                            <div class="col-12"><strong>Category:</strong> {{ selectedCategoryLabel() }}</div>
                            <div class="col-12"><strong>Contacts:</strong> {{ publicContactCount() }} public</div>
                            <div class="col-12"><strong>Coverage:</strong> {{ form.controls.coverage_ids.value.length + (form.controls.based_location_id.value ? 1 : 0) }} location(s)</div>
                          </div>
                        </div>
                      </div>

                      <div class="mb-4">
                        <label for="images" class="form-label fw-bold">Service images <span class="text-muted">(up to 10, compressed before upload)</span></label>
                        <input class="form-control form-control-lg" id="images" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple (change)="selectFiles($event)" />
                        @if (selectedFiles().length) {
                          <small class="text-success d-block mt-2"><i class="bi bi-check-circle me-1"></i>{{ selectedFiles().length }} image(s) ready</small>
                          @if (published()) { <small class="text-muted d-block mt-1"><i class="bi bi-info-circle me-1"></i>For a published listing, photos go live after the administrator approves your update.</small> }
                        }
                      </div>

                      <div class="form-check mb-0">
                        <input class="form-check-input" type="checkbox" id="declaration" formControlName="declaration" required />
                        <label class="form-check-label" for="declaration">
                          I confirm that I am authorized to submit this information and that it is accurate.
                        </label>
                      </div>
                    </div>
                  }

                  @if (errorMessage(); as message) {
                    <div class="alert alert-danger alert-dismissible fade show mt-4 mb-0 border-0 rounded-3" role="alert">
                      <i class="bi bi-exclamation-circle me-2"></i>
                      <span>{{ message }}</span>
                      <button type="button" class="btn-close" (click)="errorMessage.set(null)"></button>
                    </div>
                  }
                </div>

                <div class="card-footer submission-actions p-4 p-lg-5">
                  <div class="d-flex gap-3 justify-content-between">
                    <button type="button" class="btn btn-lg btn-outline-secondary" [disabled]="step() === 1 || saving()" (click)="previous()">
                      <i class="bi bi-chevron-left me-2"></i>Back
                    </button>
                    <div class="d-flex gap-3">
                      @if (step() < 4) {
                        <button type="button" class="btn btn-lg btn-light border" [disabled]="saving()" (click)="save(false)">
                          <i class="bi bi-cloud-arrow-down me-2"></i>Save draft
                        </button>
                        <button type="button" class="btn btn-lg btn-success" [disabled]="!canNext() || saving()" (click)="next()">
                          Next<i class="bi bi-chevron-right ms-2"></i>
                        </button>
                      } @else {
                        <button type="button" class="btn btn-lg btn-light border" [disabled]="saving()" (click)="save(false)">
                          <i class="bi bi-cloud-arrow-down me-2"></i>Save draft
                        </button>
                        <button type="submit" class="btn btn-lg btn-success" [disabled]="!form.controls.declaration.value || saving()">
                          <i class="bi bi-send me-2"></i>{{ saving() ? 'Submitting…' : 'Submit for review' }}
                        </button>
                      }
                    </div>
                  </div>
                </div>
              </form>
            }
        </main>
      </div>
    </div>
  `,
  styles: `
    .submit-container {
      background: var(--cdm-warm-white);
      min-height: 100vh;
      padding: clamp(1.1rem, 2.4vw, 2rem) 0 3rem;
    }

    .submit-content {
      width: min(100%, 1180px);
    }

    .submission-progress { display:block; margin:0 0 1.25rem; }

    .back-link {
      color: var(--cdm-navy);
      font-size: 1rem;
      font-weight: 600;
      min-height: 44px;
      align-items: center;
    }

    .back-link:hover { color: var(--cdm-navy); }
    .back-link i { font-size: 1.1rem; }

    .eyebrow {
      color: var(--cdm-orange);
      font-size: .78rem;
      letter-spacing: .14em;
    }

    .page-title {
      color: var(--cdm-navy-deep);
      font-size: clamp(1.9rem, 3.2vw, 2.6rem);
      line-height: 1.15;
      letter-spacing: -.035em;
    }

    .page-intro {
      max-width: 64ch;
      color: var(--cdm-muted);
      font-size: clamp(.98rem, 1.3vw, 1.08rem);
      line-height: 1.65;
    }

    .step-progress {
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--cdm-border);
    }

    .step-container {
      display: flex;
      gap: .75rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .submit-container .step-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .6rem;
      min-height: 54px;
      padding: .65rem 1.15rem;
      border: 1px solid var(--cdm-border);
      border-radius: .8rem;
      color: var(--cdm-navy);
      background: var(--cdm-page);
      font-size: 1rem;
      font-weight: 650;
      cursor: pointer;
      transition: background-color .18s ease, border-color .18s ease, color .18s ease, box-shadow .18s ease;
    }

    .step-circle {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      color: var(--cdm-navy);
      background: #fff;
      font-size: .82rem;
      font-weight: 750;
      flex: 0 0 auto;
    }

    .step-text { color: inherit; }

    .submit-container .step-btn.active,
    .submit-container .step-btn.completed {
      border-color: var(--cdm-navy);
      color: #fff;
      background: var(--cdm-navy);
    }

    .submit-container .step-btn.active .step-circle,
    .submit-container .step-btn.completed .step-circle {
      color:var(--cdm-navy);
      background: var(--cdm-green);
    }

    .submit-container .step-btn:hover {
      border-color: var(--cdm-navy);
      box-shadow: 0 0 0 3px rgba(23, 99, 70, .1);
    }

    .submit-container .step-btn:focus-visible,
    .submit-container .provider-choice:focus-visible {
      outline: 3px solid var(--cdm-royal-blue);
      outline-offset: 3px;
    }

    .submission-form {
      overflow: hidden;
      border: 1px solid var(--cdm-form-border) !important;
      border-radius: 1rem;
      background: var(--cdm-white);
      box-shadow: 0 8px 26px rgba(0, 32, 80, .055);
    }

    .section-heading {
      display: flex;
      align-items: flex-start;
      gap: .9rem;
    }

    .section-heading h2 { color: var(--cdm-navy-deep); }
    .section-heading p { color: var(--cdm-muted); line-height: 1.55; }

    .category-assistant { display:grid; gap:.55rem; padding:1rem; border:1px solid var(--cdm-blue-soft); border-radius:.85rem; background:linear-gradient(135deg,var(--cdm-page),#fff); }
    .category-assistant textarea { margin:0; }
    .category-assist-button { display:inline-flex; align-items:center; justify-content:center; gap:.4rem; width:max-content; min-height:42px; padding:.55rem .8rem; border:1px solid var(--cdm-btn-primary); border-radius:9px; color:#fff; background:var(--cdm-btn-primary); font:inherit; font-size:.82rem; font-weight:750; cursor:pointer; }
    .category-assist-button:hover:not(:disabled) { border-color:var(--cdm-btn-primary-hover); background:var(--cdm-btn-primary-hover); }
    .category-assist-button:disabled { cursor:not-allowed; opacity:.58; }
    .category-suggestion { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:.75rem; padding:.8rem; border:1px solid var(--cdm-green); border-radius:.75rem; background:var(--cdm-green-soft); }
    .suggestion-icon { display:grid; place-items:center; width:38px; height:38px; border-radius:10px; color:var(--cdm-royal-blue); background:#fff; font-size:1.15rem; }
    .suggestion-copy { display:grid; min-width:0; gap:.12rem; }.suggestion-copy strong { color:var(--cdm-navy); font-size:.78rem; }.suggestion-copy span,.suggestion-copy small { overflow-wrap:anywhere; color:var(--cdm-navy); font-size:.84rem; font-weight:700; }.suggestion-copy small { color:var(--cdm-muted); font-size:.75rem; font-weight:600; }.suggestion-copy em { color:var(--cdm-muted); font-size:.72rem; font-style:normal; }
    .suggestion-actions { display:flex; flex-wrap:wrap; gap:.4rem; justify-content:flex-end; }.suggestion-actions button { min-height:36px; padding:.4rem .6rem; border-radius:7px; font:inherit; font-size:.73rem; font-weight:700; cursor:pointer; }.confirm-category { border:1px solid var(--cdm-btn-primary); color:#fff; background:var(--cdm-btn-primary); }.change-category { border:1px solid var(--cdm-border); color:var(--cdm-navy); background:#fff; }.category-assist-error { margin:0; color:#C92A2A; font-size:.78rem; }

    .section-icon {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      flex: 0 0 auto;
      border-radius: .8rem;
      color:var(--cdm-royal-blue);
      background: var(--cdm-green-soft);
      font-size: 1.1rem;
    }

    .provider-type-group {
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .provider-type-group legend { float: none; width: auto; }

    .provider-type-group .row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin: 0;
    }

    .provider-type-group .row > .col-md-4 {
      width: auto;
      max-width: none;
      padding: 0;
    }

    .provider-choice {
      min-height: 102px;
      padding: 1rem;
      border: 1.5px solid var(--cdm-border);
      border-radius: .95rem;
      color:var(--cdm-royal-blue);
      background: #fff;
      font-weight: 650;
      justify-content: center;
      transition: transform .18s ease, background-color .18s ease, border-color .18s ease, box-shadow .18s ease;
    }

    .provider-choice i {
      color: var(--cdm-navy);
      font-size: 1.55rem;
    }

    .provider-choice:hover {
      border-color: var(--cdm-navy);
      color:var(--cdm-royal-blue);
      background: var(--cdm-page);
      transform: translateY(-2px);
    }

    .submit-container .btn-check:checked + .provider-choice {
      border-color:var(--cdm-royal-blue);
      color:var(--cdm-navy);
      background: var(--cdm-green);
      box-shadow: 0 8px 18px rgba(7, 85, 65, .18);
    }

    .submit-container .btn-check:checked + .provider-choice i { color: #fff; }

    .form-label { color: var(--cdm-navy); }
    .required-mark { color: var(--cdm-form-danger); }
    .optional-mark { color: var(--cdm-navy); font-size: .875rem; font-weight: 450; }
    .form-text { color: var(--cdm-muted); font-size: .84rem; line-height: 1.5; }
    .coverage-fieldset { display:grid; gap:.55rem; min-width:0; margin:0; padding:0; border:0; }
    .coverage-fieldset legend { float:none; width:auto; margin:0; }
    .coverage-search { position:relative; display:flex; align-items:center; }
    .coverage-search i { position:absolute; left:.85rem; z-index:1; color:var(--cdm-navy); pointer-events:none; }
    .coverage-search input { width:100%; min-height:48px; padding:.65rem .85rem .65rem 2.4rem; border:1px solid var(--cdm-form-border); border-radius:9px; color:var(--cdm-form-text); background:#fff; font:inherit; }
    .coverage-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.4rem .8rem; max-height:220px; overflow:auto; padding:.65rem; border:1px solid var(--cdm-border); border-radius:10px; background:var(--cdm-page); }
    .coverage-option { display:flex; align-items:flex-start; gap:.55rem; min-width:0; padding:.35rem; border-radius:7px; color:var(--cdm-muted); font-size:.8rem; font-weight:550; line-height:1.45; cursor:pointer; }
    .coverage-option:hover { background:var(--cdm-green-soft); }
    .coverage-option input { flex:none; margin-top:.15rem; accent-color:var(--cdm-royal-blue); }
    .coverage-option span { overflow-wrap:anywhere; }
    .coverage-empty,.coverage-count { margin:0; color:var(--cdm-muted); font-size:.78rem; }
    .coverage-count { color:var(--cdm-royal-blue); font-weight:700; }

    .submit-container .form-control-lg,
    .submit-container .form-select-lg {
      min-height: 50px;
      padding: .7rem .85rem;
      border: 1px solid var(--cdm-form-border);
      border-radius: .65rem;
      font-size: .96rem;
      transition: border-color .18s ease, box-shadow .18s ease;
    }

    .submit-container textarea.form-control-lg { min-height: 125px; }
    .submit-container #description { min-height: 180px; }

    .submit-container .form-control:focus,
    .submit-container .form-select:focus {
      border-color:var(--cdm-royal-blue);
      box-shadow: 0 0 0 .22rem rgba(56, 176, 0, .15);
    }

    .submission-actions {
      border-top: 1px solid var(--cdm-form-border);
      background: var(--cdm-page);
    }

    .submission-actions .d-flex { align-items:center; }
    .submission-actions .btn { min-height:46px; border-radius:.65rem; font-size:.9rem; font-weight:700; }

    .submit-container .btn-success {
      border-color: var(--cdm-btn-primary);
      color: var(--cdm-white);
      background: var(--cdm-btn-primary);
      font-weight: 600;
    }

    .submit-container .btn-success:hover:not(:disabled) {
      border-color: var(--cdm-btn-primary-hover);
      color: var(--cdm-white);
      background: var(--cdm-btn-primary-hover);
    }

    .submit-container .btn-success:active:not(:disabled) {
      border-color: var(--cdm-btn-primary-active);
      color: var(--cdm-white);
      background: var(--cdm-btn-primary-active);
    }

    .submit-container .btn-outline-secondary {
      border-color: var(--cdm-border);
      color: var(--cdm-navy);
      background: #fff;
      font-weight: 650;
    }

    .submit-container .btn-outline-secondary:hover:not(:disabled) {
      border-color: var(--cdm-royal-blue);
      color: var(--cdm-navy);
      background: var(--cdm-green-soft);
    }

    .submit-container .btn-light {
      color: var(--cdm-navy);
      font-weight: 650;
    }

    .alert { border: 0; border-radius: .85rem; }
    .alert-info { color: var(--cdm-navy); background: var(--cdm-green-soft); }
    .alert-warning { color: var(--cdm-navy); background: var(--cdm-yellow-soft); }
    .alert-danger { color: #C92A2A; background: var(--cdm-orange-soft); }
    .form-section { animation: fadeIn .25s ease-out; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    @media (max-width: 768px) {
      .provider-type-group .row { grid-template-columns: 1fr; }

      .step-container {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: .6rem;
      }

      .submit-container .step-btn {
        width: 100%;
        min-height: 48px;
        padding: .55rem .7rem;
        font-size: .9rem;
      }

      .provider-choice { min-height: 118px; }
      .coverage-options { grid-template-columns:1fr; }
      .submit-container .form-control-lg,
      .submit-container .form-select-lg {
        min-height: 48px;
        font-size: 1rem;
      }

      .submission-actions .d-flex { gap: .75rem !important; }
      .submission-actions .btn { min-height: 48px; }
      .submit-container #description { min-height: 150px; }
    }

    @media (max-width: 480px) {
      .submit-container { padding-top: 1.25rem; }
      .page-intro { font-size: 1rem; }
      .section-heading { gap: .65rem; }
      .section-icon { width: 36px; height: 36px; border-radius: .65rem; }
      .provider-choice { min-height: 108px; padding: .8rem; }
      .submission-actions > .d-flex { align-items: stretch; }
      .submission-actions > .d-flex > .btn,
      .submission-actions > .d-flex > div,
      .submission-actions > .d-flex > div > .btn { font-size: .9rem; }
      .submission-actions > .d-flex > div { gap: .5rem !important; }
      .category-suggestion { grid-template-columns:auto minmax(0,1fr); }.suggestion-actions { grid-column:1 / -1; justify-content:stretch; }.suggestion-actions button { flex:1; }
    }
  `,
})
export class SubmitServiceComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly categories = inject(ServiceCategoryService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly submissions = inject(ServiceSubmissionService);
  private readonly media = inject(ListingMediaService);
  private readonly categoryAssistant = inject(ServiceCategoryAssistantService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly form = inject(NonNullableFormBuilder).group({
    provider_type: 'individual' as 'individual' | 'business' | 'organisation', display_name: ['', [Validators.required, Validators.maxLength(160)]], provider_description: ['', Validators.maxLength(2000)], category_description: '', parent_slug: '', category_id: ['', Validators.required], title: ['', [Validators.required, Validators.maxLength(200)]], description: ['', [Validators.required, Validators.maxLength(5000)]],
    phone: '', phone_public: true, whatsapp: '', whatsapp_public: true, email: '', email_public: true, website: '', website_public: true, facebook: '', facebook_public: true, instagram: '', instagram_public: true, youtube: '', youtube_public: true,
    based_location_id: '', coverage_type: 'based_here' as 'based_here' | 'serves_here', coverage_ids: new FormControl<string[]>([], { nonNullable: true }), address: '', postal_code: '', latitude: null as number | null, longitude: null as number | null, declaration: false,
  });
  protected readonly step = signal(1);
  protected readonly submissionSteps = ['Details', 'Contacts', 'Location', 'Review'] as const;
  protected readonly coverageTypeOptions = [{value:'based_here',label:'Based here'},{value:'serves_here',label:'Serves here'}] as const;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selectedFiles = signal<readonly File[]>([]);
  protected readonly categorySuggesting = signal(false);
  protected readonly categorySuggestion = signal<ServiceCategorySuggestion | null>(null);
  protected readonly categorySuggestionError = signal<string | null>(null);
  protected readonly locationRows = signal<DirectoryLocation[]>([]);
  protected readonly existingId = signal<string | null>(null);
  protected readonly existingStatus = signal<string | null>(null);
  protected readonly pendingUpdate = signal(false);
  protected readonly selectedParentSlug = signal('');
  protected readonly coverageSearch = signal('');
  protected readonly rootCategories = computed(() => this.categories.categories());
  protected readonly subcategories = computed<ServiceCategory[]>(() => {
    const parent = this.categories.categories().find(category => category.slug === this.selectedParentSlug());
    return parent?.subcategories ?? [];
  });
  protected readonly places = computed(() => locationOptions(this.locationRows(), 'en'));
  protected readonly parentCategoryOptions = computed<readonly SearchableSelectOption[]>(() => this.rootCategories().map(category => ({
    value: category.slug,
    label: `${category.nameEnglish} — ${category.nameTamil}`,
    searchText: `${category.nameEnglish} ${category.nameTamil} ${category.slug}`,
  })));
  protected readonly subcategoryOptions = computed<readonly SearchableSelectOption[]>(() => this.subcategories().map(category => ({
    value: category.id,
    label: `${category.nameEnglish} — ${category.nameTamil}`,
    searchText: `${category.nameEnglish} ${category.nameTamil} ${category.slug}`,
  })));
  protected readonly placeOptions = computed(() => locationSearchOptions(this.locationRows(), 'en'));
  protected readonly filteredCoverageOptions = computed(() => {
    const query = this.coverageSearch().trim().toLocaleLowerCase();
    return query ? this.placeOptions().filter(option => `${option.label} ${option.searchText ?? ''}`.toLocaleLowerCase().includes(query)) : this.placeOptions();
  });
  protected readonly editing = computed(() => Boolean(this.existingId()));
  protected readonly published = computed(() => this.existingStatus() === 'published');
  protected readonly selectedCategoryLabel = computed(() => {
    const category = this.categories.categories().flatMap(root => [root, ...root.subcategories]).find(item => item.id === this.form.controls.category_id.value);
    return category ? `${category.nameEnglish} — ${category.nameTamil}` : 'Not selected';
  });
  protected readonly publicContactCount = computed(() => this.publicContacts().length);

  ngOnInit(): void { void this.load(); }

  protected selectParent(slug: string): void {
    this.categorySuggestion.set(null);
    this.selectedParentSlug.set(slug);
    this.form.controls.parent_slug.setValue(slug);
    this.form.controls.category_id.reset('');
  }
  protected selectParentValue(value: SearchableSelectValue): void {
    if (typeof value === 'string') this.selectParent(value);
  }
  protected async suggestCategory(): Promise<void> {
    const description = this.form.controls.category_description.value.trim();
    if (description.length < 2 || this.categorySuggesting()) return;
    this.categorySuggesting.set(true); this.categorySuggestionError.set(null); this.categorySuggestion.set(null);
    try {
      const suggestion = await this.categoryAssistant.suggest(description);
      if (!suggestion) this.categorySuggestionError.set('No confident category match was found. Please choose the category manually.');
      else this.categorySuggestion.set(suggestion);
    } catch { this.categorySuggestionError.set('Category assistance is unavailable right now. You can choose the category manually.'); }
    finally { this.categorySuggesting.set(false); }
  }
  protected confirmCategorySuggestion(): void {
    const suggestion = this.categorySuggestion();
    if (!suggestion) return;
    this.selectParent(suggestion.parent.slug);
    this.form.controls.category_id.setValue(suggestion.subcategory.id);
    this.form.controls.category_id.markAsDirty();
    this.categorySuggestion.set(null);
  }
  protected dismissCategorySuggestion(): void { this.categorySuggestion.set(null); this.form.controls.category_id.setValue(''); }
  protected selectFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length > 10) { this.errorMessage.set('You can select up to 10 images.'); this.selectedFiles.set(files.slice(0, 10)); return; }
    this.errorMessage.set(null); this.selectedFiles.set(files);
  }
  protected setCoverageSearch(event: Event): void { this.coverageSearch.set((event.currentTarget as HTMLInputElement).value); }
  protected toggleCoverage(locationId: string, event: Event): void {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    const current = this.form.controls.coverage_ids.value;
    this.form.controls.coverage_ids.setValue(checked
      ? current.includes(locationId) ? current : [...current, locationId]
      : current.filter(value => value !== locationId));
  }
  protected next(): void { if (this.canNext()) this.step.update(value => Math.min(4, value + 1)); }
  protected previous(): void { this.step.update(value => Math.max(1, value - 1)); }
  protected canNext(): boolean {
    if (this.step() === 1) return Boolean(this.form.controls.display_name.value.trim() && this.form.controls.category_id.value && this.form.controls.title.value.trim() && this.form.controls.description.value.trim());
    if (this.step() === 2) return !this.firstInvalidContactError();
    if (this.step() === 3) return true;
    return true;
  }

  protected contactError(type: ListingContact['contact_type'], value: string): string | null {
    return contactValidationMessage(type, value);
  }

  protected async save(submitForReview: boolean): Promise<void> {
    const contactError = this.firstInvalidContactError();
    if (contactError) { this.errorMessage.set(contactError); return; }
    if (!this.canNext() && submitForReview) { this.errorMessage.set('Complete the required service details first.'); return; }
    if (submitForReview && !this.form.controls.declaration.value) { this.errorMessage.set('Confirm the declaration before submitting.'); return; }
    this.saving.set(true); this.errorMessage.set(null);
    try {
      const raw = this.form.getRawValue();
      const input: SubmissionFormInput = { listingId: this.existingId(), providerId: this.loadedProviderId, provider: { provider_type: this.form.controls.provider_type.value, display_name: this.form.controls.display_name.value.trim(), description: this.form.controls.provider_description.value.trim() || null, public_email: raw.email_public && raw.email.trim() ? normalizeContactValue('email', raw.email) : null, website_url: raw.website_public && raw.website.trim() ? normalizeContactValue('website', raw.website) : null, address: this.form.controls.address.value.trim() || null, postal_code: this.form.controls.postal_code.value.trim() || null, latitude: this.form.controls.latitude.value, longitude: this.form.controls.longitude.value }, listing: { category_id: this.form.controls.category_id.value, title: this.form.controls.title.value.trim(), description: this.form.controls.description.value.trim() }, contacts: this.publicContacts(), locations: this.locationsInput(), submitForReview };
      const listingId = this.published() ? await this.submissions.saveRevision(input) : await this.submissions.save(input);
      if (this.selectedFiles().length) await this.media.uploadImages(listingId, this.selectedFiles(), this.existingMediaCount);
      await this.router.navigateByUrl('/my-submissions');
    } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to save this submission.'); }
    finally { this.saving.set(false); }
  }

  private loadedProviderId: string | null = null;
  private existingMediaCount = 0;
  private firstInvalidContactError(): string | null {
    const raw = this.form.getRawValue();
    const values = [
      ['phone', raw.phone], ['whatsapp', raw.whatsapp], ['email', raw.email], ['website', raw.website], ['facebook', raw.facebook], ['instagram', raw.instagram], ['youtube', raw.youtube],
    ] as const;
    for (const [type, value] of values) {
      const message = contactValidationMessage(type, value);
      if (message) return message;
    }
    return null;
  }

  private publicContacts() {
    const raw = this.form.getRawValue();
    const values = [
      ['phone', raw.phone, raw.phone_public], ['whatsapp', raw.whatsapp, raw.whatsapp_public], ['email', raw.email, raw.email_public], ['website', raw.website, raw.website_public], ['facebook', raw.facebook, raw.facebook_public], ['instagram', raw.instagram, raw.instagram_public], ['youtube', raw.youtube, raw.youtube_public],
    ] as const;
    return values.flatMap(([contact_type, value, is_public], sort_order) => {
      if (!value.trim()) return [];
      const contact_value = normalizeContactValue(contact_type, value) ?? value.trim();
      return [{ contact_type, contact_value, is_public, sort_order }];
    });
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
        this.selectedParentSlug.set(path?.[0]?.slug ?? '');
        const listingLocations = existing.listing_locations ?? [];
        const basedLocation = listingLocations.find(location => location.coverage_type === 'based_here');
        this.form.patchValue({ provider_type: existing.service_providers.provider_type as 'individual' | 'business' | 'organisation', display_name: existing.service_providers.display_name, provider_description: existing.service_providers.description ?? '', parent_slug: path?.[0]?.slug ?? '', category_id: existing.category_id, title: existing.title, description: existing.description, based_location_id: basedLocation?.locations?.id ?? '', coverage_type: basedLocation?.coverage_type ?? 'based_here', address: existing.service_providers.address ?? '', postal_code: existing.service_providers.postal_code ?? '', latitude: existing.service_providers.latitude, longitude: existing.service_providers.longitude });
        this.form.controls.phone.setValue(existing.listing_contacts?.find(contact => contact.contact_type === 'phone')?.contact_value ?? '');
        this.form.controls.whatsapp.setValue(existing.listing_contacts?.find(contact => contact.contact_type === 'whatsapp')?.contact_value ?? '');
        this.form.controls.email.setValue(existing.listing_contacts?.find(contact => contact.contact_type === 'email')?.contact_value ?? existing.service_providers.public_email ?? '');
        this.form.controls.website.setValue(existing.listing_contacts?.find(contact => contact.contact_type === 'website')?.contact_value ?? existing.service_providers.website_url ?? '');
        this.form.controls.coverage_ids.setValue(listingLocations.filter(location => location.coverage_type === 'serves_here').map(location => location.locations?.id).filter((value): value is string => Boolean(value)));
      }
    } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load the submission form.'); }
    finally { this.loading.set(false); }
  }
}
