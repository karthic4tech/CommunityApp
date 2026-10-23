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
    <div class="submit-container">
      <div class="container-xl">
        <div class="row">
          <div class="col-lg-8 offset-lg-2">
            <a class="btn btn-link text-decoration-none mb-4 d-inline-flex align-items-center gap-2" routerLink="/my-submissions">
              <i class="bi bi-arrow-left"></i>
              <span>Back to my submissions</span>
            </a>

            @if (!loading()) {
              <div class="page-header mb-5">
                <p class="text-uppercase fw-bold mb-2" style="color:#d9bd72; font-size:0.75rem; letter-spacing:0.12em;">Community Service</p>
                <h1 class="h2 fw-bold mb-3" style="color:#0b3026;">{{ editing() ? 'Edit your submission' : 'Add your service' }}</h1>
                <p class="text-muted lead" style="max-width:600px; margin:0;">Share accurate service information with the Nam Chidambaram community. Submissions are reviewed before publication.</p>
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
              <div class="step-progress mb-5">
                <div class="step-container">
                  <button class="step-btn" [class.active]="step() === 1" [class.completed]="step() > 1" (click)="step.set(1)" type="button">
                    <span class="step-circle">1</span>
                    <span class="step-text">Details</span>
                  </button>
                  <button class="step-btn" [class.active]="step() === 2" [class.completed]="step() > 2" (click)="step.set(2)" type="button">
                    <span class="step-circle">2</span>
                    <span class="step-text">Contacts</span>
                  </button>
                  <button class="step-btn" [class.active]="step() === 3" [class.completed]="step() > 3" (click)="step.set(3)" type="button">
                    <span class="step-circle">3</span>
                    <span class="step-text">Location</span>
                  </button>
                  <button class="step-btn" [class.active]="step() === 4" [class.completed]="step() > 4" (click)="step.set(4)" type="button">
                    <span class="step-circle">4</span>
                    <span class="step-text">Review</span>
                  </button>
                </div>
              </div>

              <form [formGroup]="form" (ngSubmit)="step() === 4 ? save(true) : next()" class="card border-0 shadow-sm" novalidate>
                <div class="card-body p-5">
                  
                  @if (step() === 1) {
                    <div class="form-section">
                      <h2 class="h4 fw-bold mb-4" style="color:#0b3026;">Business and service details</h2>
                      
                      <div class="mb-5">
                        <label class="form-label fw-bold d-block mb-3">Provider type</label>
                        <div class="row g-3">
                          <div class="col-md-4">
                            <input class="btn-check" type="radio" id="provider-individual" formControlName="provider_type" value="individual" />
                            <label class="btn btn-outline-success w-100 d-flex flex-column gap-2" style="min-height:140px; padding:1.5rem;" for="provider-individual">
                              <i class="bi bi-person-fill" style="font-size:2rem; color:#075541;"></i>
                              <span class="fw-600">Individual</span>
                            </label>
                          </div>
                          <div class="col-md-4">
                            <input class="btn-check" type="radio" id="provider-business" formControlName="provider_type" value="business" />
                            <label class="btn btn-outline-success w-100 d-flex flex-column gap-2" style="min-height:140px; padding:1.5rem;" for="provider-business">
                              <i class="bi bi-shop" style="font-size:2rem; color:#075541;"></i>
                              <span class="fw-600">Business</span>
                            </label>
                          </div>
                          <div class="col-md-4">
                            <input class="btn-check" type="radio" id="provider-organisation" formControlName="provider_type" value="organisation" />
                            <label class="btn btn-outline-success w-100 d-flex flex-column gap-2" style="min-height:140px; padding:1.5rem;" for="provider-organisation">
                              <i class="bi bi-building" style="font-size:2rem; color:#075541;"></i>
                              <span class="fw-600">Organisation</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div class="mb-4">
                        <label for="display_name" class="form-label fw-bold">Provider or business name</label>
                        <input class="form-control form-control-lg" id="display_name" formControlName="display_name" maxlength="160" required />
                      </div>

                      <div class="mb-4">
                        <label for="provider_description" class="form-label fw-bold">Provider description</label>
                        <textarea class="form-control form-control-lg" id="provider_description" formControlName="provider_description" rows="3" maxlength="2000"></textarea>
                      </div>

                      <div class="row g-4">
                        <div class="col-md-6">
                          <label for="parent_slug" class="form-label fw-bold">Parent category</label>
                          <select class="form-select form-select-lg" id="parent_slug" #parent formControlName="parent_slug" (change)="selectParent(parent.value)" required>
                            <option value="">Select a category</option>
                            @for (category of rootCategories(); track category.id) {
                              <option [value]="category.slug">{{ category.nameEnglish }} — {{ category.nameTamil }}</option>
                            }
                          </select>
                        </div>
                        <div class="col-md-6">
                          <label for="category_id" class="form-label fw-bold">Subcategory</label>
                          <select class="form-select form-select-lg" id="category_id" formControlName="category_id" required>
                            <option value="">Select a subcategory</option>
                            @for (category of subcategories(); track category.id) {
                              <option [value]="category.id">{{ category.nameEnglish }} — {{ category.nameTamil }}</option>
                            }
                          </select>
                        </div>
                      </div>

                      <div class="mb-4 mt-4">
                        <label for="title" class="form-label fw-bold">Service title</label>
                        <input class="form-control form-control-lg" id="title" formControlName="title" maxlength="200" required />
                      </div>

                      <div class="mb-0">
                        <label for="description" class="form-label fw-bold">Service description</label>
                        <textarea class="form-control form-control-lg" id="description" formControlName="description" rows="6" maxlength="5000" required></textarea>
                      </div>
                    </div>
                  }

                  @else if (step() === 2) {
                    <div class="form-section">
                      <h2 class="h4 fw-bold mb-2" style="color:#0b3026;">Public contacts</h2>
                      <p class="text-muted mb-5"><i class="bi bi-info-circle me-2"></i>Only checked contact details will be shown publicly.</p>

                      <div class="row g-4">
                        <div class="col-12">
                          <label for="phone" class="form-label fw-bold">Phone</label>
                          <input class="form-control form-control-lg" id="phone" formControlName="phone" autocomplete="tel" maxlength="40" />
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="phone_public" formControlName="phone_public" />
                            <label class="form-check-label" for="phone_public">Show publicly</label>
                          </div>
                        </div>

                        <div class="col-12">
                          <label for="whatsapp" class="form-label fw-bold">WhatsApp</label>
                          <input class="form-control form-control-lg" id="whatsapp" formControlName="whatsapp" maxlength="40" />
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="whatsapp_public" formControlName="whatsapp_public" />
                            <label class="form-check-label" for="whatsapp_public">Show publicly</label>
                          </div>
                        </div>

                        <div class="col-12">
                          <label for="email" class="form-label fw-bold">Email</label>
                          <input class="form-control form-control-lg" id="email" type="email" formControlName="email" autocomplete="email" maxlength="200" />
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="email_public" formControlName="email_public" />
                            <label class="form-check-label" for="email_public">Show publicly</label>
                          </div>
                        </div>

                        <div class="col-12">
                          <label for="website" class="form-label fw-bold">Website</label>
                          <input class="form-control form-control-lg" id="website" type="url" formControlName="website" maxlength="500" placeholder="https://example.com" />
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="website_public" formControlName="website_public" />
                            <label class="form-check-label" for="website_public">Show publicly</label>
                          </div>
                        </div>

                        <div class="col-md-6">
                          <label for="facebook" class="form-label fw-bold">Facebook</label>
                          <input class="form-control form-control-lg" id="facebook" type="url" formControlName="facebook" maxlength="500" placeholder="https://facebook.com/..." />
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="facebook_public" formControlName="facebook_public" />
                            <label class="form-check-label" for="facebook_public">Show publicly</label>
                          </div>
                        </div>

                        <div class="col-md-6">
                          <label for="instagram" class="form-label fw-bold">Instagram</label>
                          <input class="form-control form-control-lg" id="instagram" type="url" formControlName="instagram" maxlength="500" placeholder="https://instagram.com/..." />
                          <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" id="instagram_public" formControlName="instagram_public" />
                            <label class="form-check-label" for="instagram_public">Show publicly</label>
                          </div>
                        </div>

                        <div class="col-12">
                          <label for="youtube" class="form-label fw-bold">YouTube</label>
                          <input class="form-control form-control-lg" id="youtube" type="url" formControlName="youtube" maxlength="500" placeholder="https://youtube.com/..." />
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
                      <h2 class="h4 fw-bold mb-2" style="color:#0b3026;">Location and service coverage</h2>
                      <p class="text-muted mb-5"><i class="bi bi-info-circle me-2"></i>Street address and coordinates are optional.</p>

                      <div class="row g-4">
                        <div class="col-md-6">
                          <label for="based_location_id" class="form-label fw-bold">Business locality</label>
                          <select class="form-select form-select-lg" id="based_location_id" formControlName="based_location_id">
                            <option value="">Select a locality</option>
                            @for (place of places(); track place.id) {
                              <option [value]="place.id">{{ place.label }}</option>
                            }
                          </select>
                        </div>
                        <div class="col-md-6">
                          <label for="coverage_type" class="form-label fw-bold">Coverage type</label>
                          <select class="form-select form-select-lg" id="coverage_type" formControlName="coverage_type">
                            <option value="based_here">Based here</option>
                            <option value="serves_here">Serves here</option>
                          </select>
                        </div>

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
                          <label for="coverage_ids" class="form-label fw-bold">Additional service areas</label>
                          <select class="form-select form-select-lg" id="coverage_ids" multiple formControlName="coverage_ids" size="6">
                            @for (place of places(); track place.id) {
                              <option [value]="place.id">{{ place.label }}</option>
                            }
                          </select>
                        </div>
                      </div>
                    </div>
                  }

                  @else {
                    <div class="form-section">
                      <h2 class="h4 fw-bold mb-4" style="color:#0b3026;">Review and submit</h2>
                      
                      <div class="card border-0 mb-4" style="background:#f8fbf8;">
                        <div class="card-body">
                          <h3 class="h5 fw-bold mb-2" style="color:#0b3026;">{{ form.controls.title.value || 'Untitled service' }}</h3>
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
                        <label for="images" class="form-label fw-bold">Service images <span class="text-muted">(up to 10, 5 MB each)</span></label>
                        <input class="form-control form-control-lg" id="images" type="file" accept="image/*" multiple (change)="selectFiles($event)" />
                        @if (selectedFiles().length) {
                          <small class="text-success d-block mt-2"><i class="bi bi-check-circle me-1"></i>{{ selectedFiles().length }} image(s) ready</small>
                        }
                        @if (!storageConfigured()) {
                          <small class="text-warning d-block mt-2"><i class="bi bi-info-circle me-1"></i>Storage not configured. Text details only.</small>
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

                <div class="card-footer bg-light border-top p-5">
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
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .submit-container {
      background: linear-gradient(180deg, #fbfaf6 0%, #fbfaf6 100%);
      min-height: 100vh;
      padding: 2.5rem 0;
    }

    .page-header {
      animation: fadeInDown 0.6s ease-out;
    }

    .step-progress {
      animation: fadeIn 0.6s ease-out;
      margin-bottom: 2rem;
    }

    .step-container {
      display: flex;
      gap: 1rem;
      justify-content: flex-start;
      align-items: center;
      flex-wrap: wrap;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #e2e7dd;
    }

    .step-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.65rem 1.25rem;
      border: 2px solid #c3d0c8;
      background: white;
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 0.95rem;
      font-weight: 600;
      color: #62746b;
    }

    .step-circle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #e5ebe7;
      color: #62746b;
      font-weight: 700;
      font-size: 0.75rem;
      flex-shrink: 0;
      transition: all 0.3s ease;
    }

    .step-text {
      font-weight: 600;
      color: #62746b;
      transition: color 0.3s ease;
    }

    .step-btn.completed {
      border-color: #075541;
      color: #075541;
    }

    .step-btn.completed .step-circle {
      background: #075541;
      color: white;
    }

    .step-btn.completed .step-text {
      color: #075541;
    }

    .step-btn.active {
      border-color: #075541;
      background: white;
      color: #075541;
      box-shadow: 0 0 0 3px rgba(7, 85, 65, 0.12);
    }

    .step-btn.active .step-circle {
      background: #075541;
      color: white;
    }

    .step-btn.active .step-text {
      color: #075541;
      font-weight: 700;
    }

    .step-btn:hover:not(.active) {
      border-color: #43876a;
      color: #0e4932;
    }

    .step-btn:hover:not(.active) .step-circle {
      background: #e0f0eb;
    }

    .form-control-lg,
    .form-select-lg {
      font-size: 1rem;
      padding: 0.75rem 1rem;
      min-height: 48px;
      border: 1px solid #c3d0c8;
      border-radius: 0.5rem;
      transition: all 0.2s ease;
    }

    .form-control:focus,
    .form-select:focus,
    textarea:focus {
      border-color: #43876a;
      box-shadow: 0 0 0 0.2rem rgba(23, 99, 70, 0.15);
    }

    .btn-success {
      background-color: #075541;
      border-color: #075541;
      font-weight: 600;
    }

    .btn-success:hover:not(:disabled) {
      background-color: #053d2f;
      border-color: #053d2f;
    }

    .btn-outline-secondary {
      color: #075541;
      border-color: #b8c9bf;
      font-weight: 600;
    }

    .btn-outline-secondary:hover:not(:disabled) {
      background-color: #f2f7f2;
      border-color: #87aa94;
      color: #0e4932;
    }

    .btn-outline-success {
      border: 2px solid #c3d0c8;
      color: #075541;
      transition: all 0.3s ease;
    }

    .btn-outline-success:hover {
      border-color: #075541;
      background-color: #f8fbf8;
    }

    .btn-check:checked + .btn-outline-success {
      background-color: #075541;
      border-color: #075541;
      color: white;
      box-shadow: 0 4px 12px rgba(7, 85, 65, 0.2);
    }

    .card {
      box-shadow: 0 2px 8px rgba(20, 55, 39, 0.08);
      border: 1px solid #e2e7dd;
    }

    .card-footer {
      border-color: #e2e7dd;
    }

    .alert {
      border: 0;
      border-radius: 0.75rem;
      animation: slideDown 0.4s ease-out;
    }

    .alert-info {
      background: #f0f8f5;
      color: #14563d;
    }

    .alert-warning {
      background: #fffaf0;
      color: #625329;
    }

    .alert-danger {
      background: #fdf3f1;
      color: #8a261f;
    }

    .form-section {
      animation: fadeIn 0.5s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes fadeInDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 768px) {
      .step-container {
        gap: 0.5rem;
        padding-bottom: 1rem;
      }

      .step-btn {
        padding: 0.55rem 1rem;
        font-size: 0.85rem;
      }

      .step-circle {
        width: 20px;
        height: 20px;
        font-size: 0.65rem;
      }

      .form-control-lg,
      .form-select-lg {
        font-size: 0.95rem;
        padding: 0.65rem 0.85rem;
        min-height: 44px;
      }

      .card-body,
      .card-footer {
        padding: 1.5rem !important;
      }

      .d-flex {
        gap: 1rem !important;
      }
    }
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
