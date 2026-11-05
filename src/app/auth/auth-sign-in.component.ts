import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/services/language.service';
import { FormControlComponent } from '../shared/forms/form-control.component';

@Component({
  selector: 'app-auth-sign-in',
  imports: [ReactiveFormsModule, RouterLink, FormControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card" aria-labelledby="sign-in-title">
      <p class="eyebrow">CDM360</p>
      <h1 id="sign-in-title">{{ i18n.language() === 'ta' ? 'உள்நுழைக' : 'Sign in' }}</h1>
      <p class="intro">{{ i18n.language() === 'ta' ? 'உங்கள் கணக்கில் உள்நுழைந்து உங்கள் சேவைகளை நிர்வகிக்கவும்.' : 'Sign in to manage your account and service submissions.' }}</p>
      <form class="cdm-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-form-input label="Email" controlId="sign-in-email" type="email" autocomplete="username" placeholder="you@example.com" [required]="true" [error]="form.controls.email.touched && form.controls.email.hasError('required') ? 'Enter your email address.' : form.controls.email.touched && form.controls.email.hasError('email') ? 'Enter a valid email address.' : ''" formControlName="email" />
        <app-form-input label="Password" controlId="sign-in-password" type="password" autocomplete="current-password" placeholder="Enter your password" [required]="true" [error]="form.controls.password.touched && form.controls.password.hasError('required') ? 'Enter your password.' : ''" formControlName="password" />
        @if (errorMessage(); as message) { <p class="error" role="alert">{{ message }}</p> }
        <button type="submit" [disabled]="form.invalid || submitting()">{{ submitting() ? 'Signing in…' : 'Sign in' }}</button>
      </form>
      <button type="button" class="oauth-button" (click)="googleSignIn()" [disabled]="submitting()">Continue with Google</button>
      @if (verificationEmail(); as email) {
        <div class="notice" role="status"><p>Please verify {{ email }} before continuing.</p><button type="button" class="text-button" (click)="resendVerification()">Resend verification email</button></div>
      }
      <div class="links"><a routerLink="/auth/forgot-password">Forgot password?</a><a routerLink="/auth/sign-up">Create an account</a></div>
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }
    .auth-card { width:min(100%, 520px); margin-inline:auto; padding:clamp(1.5rem,4vw,2.5rem); border:1px solid var(--cdm-border); border-radius:20px; background:white; box-shadow:0 8px 24px #0020500a; }
    .eyebrow { margin:0 0 .35rem; color:var(--cdm-muted); font-size:.72rem; font-weight:800; letter-spacing:.12em; }
    h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.7rem,4vw,2.4rem); }.intro { color:var(--cdm-muted); line-height:1.8; }
    form { display:grid; gap:1rem; margin-top:1.5rem; } label { display:grid; gap:.4rem; color:var(--cdm-navy); font-weight:650; }
    input { width:100%; min-height:46px; border:1px solid var(--cdm-border); border-radius:9px; padding:.7rem; background:white; color:var(--cdm-navy); font:inherit; }
    button { min-height:46px; border:1px solid var(--cdm-btn-primary); border-radius:9px; padding:.7rem 1rem; background:var(--cdm-btn-primary); color:var(--cdm-white); font:inherit; font-weight:700; cursor:pointer; }
    button:disabled { cursor:default; opacity:.6; }.oauth-button { width:100%; margin-top:1rem; background:white; color:var(--cdm-royal-blue); }.error { color:#C92A2A; line-height:1.6; }.notice { margin-top:1rem; padding:1rem; border:1px solid var(--cdm-border); border-radius:12px; background:var(--cdm-page); color:var(--cdm-muted); line-height:1.7; }.text-button { min-height:auto; padding:0; border:0; background:none; color:var(--cdm-royal-blue); text-decoration:underline; }.links { display:flex; justify-content:space-between; flex-wrap:wrap; gap:.75rem; margin-top:1.25rem; }.links a { color:var(--cdm-royal-blue); }
    :is(a,button,input):focus-visible { outline:3px solid var(--cdm-royal-blue); outline-offset:3px; }
  `,
})
export class AuthSignInComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly form = inject(NonNullableFormBuilder).group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly verificationEmail = signal<string | null>(null);

  ngOnInit(): void {
    void this.redirectIfAuthenticated();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true); this.errorMessage.set(null); this.verificationEmail.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signIn(email, password);
      if (!this.auth.emailVerified()) {
        this.verificationEmail.set(email);
        return;
      }
      await this.router.navigateByUrl(this.destination());
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally { this.submitting.set(false); }
  }

  protected async googleSignIn(): Promise<void> {
    this.submitting.set(true); this.errorMessage.set(null);
    try { await this.auth.signInWithGoogle(); } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Google sign-in is unavailable.'); }
    finally { this.submitting.set(false); }
  }

  protected async resendVerification(): Promise<void> {
    const email = this.verificationEmail();
    if (!email) return;
    try { await this.auth.resendVerification(email); this.errorMessage.set('Verification email sent.'); }
    catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to resend verification email.'); }
  }

  private async redirectIfAuthenticated(): Promise<void> {
    await this.auth.ready();
    if (this.route.snapshot.queryParamMap.get('switchAccount') === 'true') return;
    if (this.auth.isAuthenticated()) await this.router.navigateByUrl(this.auth.emailVerified() ? this.destination() : '/auth/verify-email');
  }

  private destination(): string {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/account';
    return requested.startsWith('/') && !requested.startsWith('//') ? requested : '/account';
  }
}
