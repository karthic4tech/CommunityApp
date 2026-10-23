import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { DirectoryLocation, locationOptions } from '../core/models/service-listing';
import { LanguageService } from '../core/services/language.service';
import { ProfileService } from '../core/services/profile.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';

@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="account-page" aria-labelledby="account-title" [attr.aria-busy]="loading() || saving()">
      <header><p class="eyebrow">ACCOUNT</p><h1 id="account-title">Your account</h1><p class="intro">Manage your profile and community submissions.</p></header>
      @if (!auth.emailVerified()) { <div class="notice" role="status"><strong>Email verification required.</strong><p>Verify your email before submitting a service.</p><a routerLink="/auth/verify-email">Verify email</a></div> }
      @if (loading()) { <p class="state" role="status">Loading your profile…</p> } @else {
        <div class="account-grid">
          <form class="card" [formGroup]="form" (ngSubmit)="save()"><h2>Profile</h2>
            <label>Email<input [value]="auth.user()?.email ?? ''" readonly aria-describedby="email-help" /></label><small id="email-help">Email is managed by Supabase Auth.</small>
            <label>Full name<input formControlName="full_name" autocomplete="name" maxlength="160" required /></label>
            <label>Phone<input formControlName="phone" autocomplete="tel" maxlength="40" /></label>
            <label>Preferred language<select formControlName="preferred_language"><option value="ta">தமிழ்</option><option value="en">English</option></select></label>
            <label>Preferred locality<select formControlName="preferred_locality_id"><option value="">Not selected</option>@for (place of places(); track place.id) { <option [value]="place.id">{{ place.label }}</option> }</select></label>
            @if (message(); as text) { <p class="message" role="status">{{ text }}</p> }
            <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving…' : 'Save profile' }}</button>
          </form>
          <aside class="card actions-card"><h2>Community services</h2><a routerLink="/services/submit"><i class="bi bi-plus-circle" aria-hidden="true"></i> Add your service</a><a routerLink="/my-submissions"><i class="bi bi-card-list" aria-hidden="true"></i> View my submissions</a><button type="button" class="secondary" (click)="signOut()"><i class="bi bi-box-arrow-right" aria-hidden="true"></i> Sign out</button></aside>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }.account-page { display:grid; gap:1.25rem; }.eyebrow { margin:0 0 .35rem; color:#52665b; font-size:.72rem; font-weight:800; letter-spacing:.12em; } h1 { margin:0; color:#173f32; font-size:clamp(1.7rem,4vw,2.5rem); }.intro,small { color:#52665b; line-height:1.7; }.notice { padding:1rem; border:1px solid #e7d9ae; border-radius:14px; background:#fffaf0; color:#625329; line-height:1.7; }.notice a,.actions-card a { color:#075541; }.account-grid { display:grid; grid-template-columns:minmax(0,2fr) minmax(240px,1fr); gap:1rem; }.card { display:grid; align-content:start; gap:1rem; padding:1.25rem; border:1px solid #dfe7e2; border-radius:16px; background:white; }.card h2 { margin:0; color:#173f32; font-size:1.2rem; }.card label { display:grid; gap:.4rem; color:#173f32; font-weight:650; }.card input,.card select { min-height:44px; border:1px solid #b8c9bf; border-radius:9px; padding:.7rem; background:white; color:#173f32; font:inherit; }.card button { min-height:44px; border:1px solid #075541; border-radius:9px; padding:.7rem 1rem; background:#075541; color:white; font:inherit; font-weight:700; }.actions-card a { display:flex; align-items:center; min-height:44px; }.actions-card .secondary { background:white; color:#075541; }.message { color:#275b3c; line-height:1.7; }.state { padding:1.25rem; border:1px solid #dfe7e2; border-radius:14px; background:white; color:#52665b; }.card :is(a,button,input,select):focus-visible { outline:3px solid #17583f; outline-offset:3px; } @media(max-width:700px) { .account-grid { grid-template-columns:1fr; } }
  `,
})
export class AccountComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfileService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly router = inject(Router);
  protected readonly form = inject(NonNullableFormBuilder).group({ full_name: ['', [Validators.required, Validators.maxLength(160)]], phone: ['', Validators.maxLength(40)], preferred_language: 'ta' as 'ta' | 'en', preferred_locality_id: '' });
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly places = signal<{ id: string; label: string }[]>([]);

  ngOnInit(): void { void this.load(); }

  protected async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true); this.message.set(null);
    try { await this.profiles.save(this.form.getRawValue()); this.message.set('Profile saved.'); }
    catch (error) { this.message.set(error instanceof Error ? error.message : 'Unable to save your profile.'); }
    finally { this.saving.set(false); }
  }

  protected async signOut(): Promise<void> { await this.auth.signOut(); await this.router.navigateByUrl('/auth/sign-in'); }

  private async load(): Promise<void> {
    try {
      const [profile, locations] = await Promise.all([this.profiles.ensure(this.auth.user()?.user_metadata?.['full_name'] as string | null ?? null), this.directory.locations()]);
      this.form.reset({ full_name: profile.full_name ?? '', phone: profile.phone ?? '', preferred_language: profile.preferred_language, preferred_locality_id: profile.preferred_locality_id ?? '' });
      this.places.set(locationOptions(locations, profile.preferred_language));
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'Unable to load your profile.'); }
    finally { this.loading.set(false); }
  }
}
