import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { JobCategory, JobService } from '../core/services/job.service';

@Component({
  selector: 'app-submit-job',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="job-page" aria-labelledby="job-title" [attr.aria-busy]="loading() || saving()">
      <div class="job-page__inner">
        <a class="back-link" routerLink="/services"><i class="bi bi-arrow-left" aria-hidden="true"></i> Services</a>
        @if (loading()) { <p role="status">Loading job categories…</p> }
        @else if (!auth.emailVerified()) {
          <section class="notice" role="alert"><h1 id="job-title">Verify your email first</h1><p>Only verified accounts can post jobs.</p><a class="button primary" routerLink="/auth/verify-email">Verify email</a></section>
        } @else if (success()) {
          <section class="notice success" role="status"><h1 id="job-title">Job submitted successfully</h1><p>Your job post is waiting for administrator review.</p><a class="button primary" routerLink="/services">Back to services</a></section>
        } @else {
          <header class="page-header"><p class="eyebrow">LOCAL JOBS</p><h1 id="job-title">Post New Job</h1><p>Share an opportunity with people in the Chidambaram community.</p></header>
          <form [formGroup]="form" (ngSubmit)="save()" novalidate>
            <div class="field"><label for="category">Job category <span aria-hidden="true">*</span></label><select id="category" formControlName="category_id"><option value="">Choose a category</option>@for (category of categories(); track category.id) { <option [value]="category.id">{{ category.name_en }} — {{ category.name_ta }}</option> }</select>@if (invalid('category_id')) { <p class="error">Choose a job category.</p> }</div>
            <div class="field"><label for="title">Job title <span aria-hidden="true">*</span></label><input id="title" formControlName="title" maxlength="200" placeholder="e.g. Accounts Assistant" />@if (invalid('title')) { <p class="error">Enter a job title.</p> }</div>
            <div class="field"><label for="company">Company or employer <span aria-hidden="true">*</span></label><input id="company" formControlName="company_name" maxlength="200" autocomplete="organization" />@if (invalid('company_name')) { <p class="error">Enter the employer name.</p> }</div>
            <div class="field"><label for="description">Job description <span aria-hidden="true">*</span></label><textarea id="description" formControlName="description" rows="6" maxlength="5000" placeholder="Describe the role, requirements, salary or working hours."></textarea>@if (invalid('description')) { <p class="error">Enter at least 10 characters.</p> }</div>
            <div class="field"><label for="location">Location <span aria-hidden="true">*</span></label><input id="location" formControlName="location" maxlength="200" placeholder="e.g. Chidambaram" />@if (invalid('location')) { <p class="error">Enter the job location.</p> }</div>
            <div class="two-col"><div class="field"><label for="phone">Contact phone</label><input id="phone" formControlName="contact_phone" inputmode="tel" maxlength="20" /></div><div class="field"><label for="email">Contact email</label><input id="email" type="email" formControlName="contact_email" maxlength="254" /></div></div>
            @if (form.touched && !form.controls.contact_phone.value.trim() && !form.controls.contact_email.value.trim()) { <p class="error">Provide a phone number or email address.</p> }
            @if (error(); as message) { <p class="notice error-notice" role="alert">{{ message }}</p> }
            <button class="button primary" type="submit" [disabled]="saving()">{{ saving() ? 'Submitting…' : 'Submit Job' }}</button>
          </form>
        }
      </div>
    </main>
  `,
  styles: `:host{display:block}.job-page{min-height:100vh;padding:1.25rem 1rem 3rem;background:#fbfcfe;color:var(--cdm-navy)}.job-page__inner{width:min(100%,680px);margin:auto}.back-link{display:inline-flex;gap:.45rem;align-items:center;min-height:44px;color:var(--cdm-navy);text-decoration:none;font-weight:700}.page-header{margin:1.25rem 0 1.5rem}.eyebrow{margin:0 0 .35rem;color:var(--cdm-orange);font-size:.72rem;font-weight:800;letter-spacing:.12em}h1{margin:0;font-size:clamp(1.8rem,7vw,2.45rem)}.page-header p:last-child{color:#52657b}form,.notice{display:grid;gap:1rem;padding:clamp(1rem,4vw,1.75rem);border:1px solid #dce4ed;border-radius:16px;background:#fff;box-shadow:0 8px 25px rgba(0,32,80,.06)}.field{display:grid;gap:.4rem}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:1rem}label{font-weight:750}input,select,textarea{width:100%;box-sizing:border-box;min-height:48px;padding:.7rem .8rem;border:1px solid #b9c8d8;border-radius:9px;color:#172b43;background:#fff;font:inherit;font-size:1rem}textarea{resize:vertical}.button{display:inline-flex;justify-content:center;align-items:center;min-height:46px;padding:.65rem .9rem;border-radius:9px;font-weight:750;text-decoration:none;border:0;cursor:pointer}.primary{background:var(--cdm-btn-primary);color:#fff}.primary:disabled{opacity:.6;cursor:wait}.error{margin:0;color:#b42318;font-size:.88rem}.notice{margin-top:2rem}.success{border-color:#9bd3b0}.error-notice{padding:.75rem;background:#fff3f0;border-radius:8px}@media(max-width:600px){.two-col{grid-template-columns:1fr}}`,
})
export class SubmitJobComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly jobs = inject(JobService);
  protected readonly categories = signal<readonly JobCategory[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly success = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.fb.group({
    category_id: this.fb.control('', Validators.required),
    title: this.fb.control('', [Validators.required, Validators.maxLength(200)]),
    company_name: this.fb.control('', [Validators.required, Validators.maxLength(200)]),
    description: this.fb.control('', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]),
    location: this.fb.control('', [Validators.required, Validators.maxLength(200)]),
    contact_phone: this.fb.control('', Validators.maxLength(20)),
    contact_email: this.fb.control('', [Validators.maxLength(254), Validators.email]),
  });

  async ngOnInit(): Promise<void> { try { this.categories.set(await this.jobs.categories()); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to load job categories.'); } finally { this.loading.set(false); } }
  protected invalid(control: keyof typeof this.form.controls): boolean { const field = this.form.controls[control]; return field.touched && field.invalid; }
  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || (!this.form.controls.contact_phone.value.trim() && !this.form.controls.contact_email.value.trim()) || this.saving()) return;
    const user = this.auth.user();
    if (!user) { this.error.set('Please sign in again before posting a job.'); return; }
    this.saving.set(true); this.error.set(null);
    try { const raw = this.form.getRawValue(); await this.jobs.create({ ...raw, category_id: raw.category_id, posted_by: user.id, title: raw.title.trim(), company_name: raw.company_name.trim(), description: raw.description.trim(), location: raw.location.trim(), contact_phone: raw.contact_phone.trim() || null, contact_email: raw.contact_email.trim() || null, status: 'pending_review' }); this.success.set(true); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to submit this job.'); }
    finally { this.saving.set(false); }
  }
}
