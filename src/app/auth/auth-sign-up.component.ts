import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/services/language.service';
import { FormControlComponent } from '../shared/forms/form-control.component';

@Component({
  selector: 'app-auth-sign-up',
  imports: [ReactiveFormsModule, RouterLink, FormControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card" aria-labelledby="sign-up-title">
      <p class="eyebrow">CDM360</p><h1 id="sign-up-title">Create your account</h1>
      <p class="intro">Create an account to submit and manage your community service listings.</p>
      @if (created()) {
        <div class="success" role="status"><h2>Check your email</h2><p>We sent a verification link to <strong>{{ emailSentTo() }}</strong>. Verify your email before submitting a service.</p><a routerLink="/auth/verify-email">Continue to verification</a></div>
      } @else {
        <form class="cdm-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <app-form-input label="Full name" controlId="sign-up-name" autocomplete="name" placeholder="Your full name" [maxLength]="160" [required]="true" [error]="form.controls.fullName.touched && form.controls.fullName.invalid ? 'Enter your name (up to 160 characters).' : ''" formControlName="fullName" />
          <app-form-input label="Email" controlId="sign-up-email" type="email" autocomplete="email" placeholder="you@example.com" [required]="true" [error]="form.controls.email.touched && form.controls.email.hasError('required') ? 'Enter your email address.' : form.controls.email.touched && form.controls.email.hasError('email') ? 'Enter a valid email address.' : ''" formControlName="email" />
          <app-form-input label="Password" controlId="sign-up-password" type="password" autocomplete="new-password" placeholder="Create a strong password" hint="Use at least 8 characters with uppercase, lowercase and a number." [required]="true" [error]="form.controls.password.touched && form.controls.password.invalid ? 'Use at least 8 characters with uppercase, lowercase and a number.' : ''" formControlName="password" />
          <app-form-input label="Confirm password" controlId="sign-up-confirm" type="password" autocomplete="new-password" placeholder="Enter the password again" [required]="true" [error]="form.controls.confirmPassword.touched && form.controls.confirmPassword.invalid ? 'Confirm your password.' : form.controls.confirmPassword.touched && form.controls.password.value !== form.controls.confirmPassword.value ? 'Passwords do not match.' : ''" formControlName="confirmPassword" />
          @if (form.controls.confirmPassword.dirty && form.controls.password.value !== form.controls.confirmPassword.value) { <p class="error" role="alert">Passwords do not match.</p> }
          @if (errorMessage(); as message) { <p class="error" role="alert">{{ message }}</p> }
          <button type="submit" [disabled]="form.invalid || submitting() || form.controls.password.value !== form.controls.confirmPassword.value">{{ submitting() ? 'Creating account…' : 'Create account' }}</button>
        </form>
        <div class="oauth-separator" aria-hidden="true"><span>OR CONTINUE WITH</span></div>
        <button type="button" class="oauth-button" (click)="googleSignIn()" [disabled]="submitting()" [attr.aria-busy]="submitting()">
          <svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.27c0-.71-.06-1.4-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.22Z"/><path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.75Z"/><path fill="#FBBC05" d="M6.54 13.83A5.85 5.85 0 0 1 6.23 12c0-.64.11-1.26.31-1.83V7.64H3.3A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.05 4.36l3.24-2.53Z"/><path fill="#EA4335" d="M12 6.14c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.83 3.13 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 7.86 9.46 6.14 12 6.14Z"/></svg>
          <span>{{ submitting() ? 'Redirecting to Google…' : 'Continue with Google' }}</span>
        </button>
      }
      <p class="links"><a routerLink="/auth/sign-in">Already have an account? Sign in</a></p>
    </section>
  `,
  styles: `
     :host { display:block; padding-block:2rem; }.auth-card { width:min(100%, 560px); margin-inline:auto; padding:clamp(1.5rem,4vw,2.5rem); border:1px solid var(--cdm-border); border-radius:20px; background:white; box-shadow:0 8px 24px #0020500a; }.eyebrow { margin:0 0 .35rem; color:var(--cdm-muted); font-size:.72rem; font-weight:800; letter-spacing:.12em; } h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.7rem,4vw,2.4rem); }.intro, small { color:var(--cdm-muted); line-height:1.7; } form { display:grid; gap:1rem; margin-top:1.5rem; } label { display:grid; gap:.4rem; color:var(--cdm-navy); font-weight:650; } input { width:100%; min-height:46px; border:1px solid var(--cdm-border); border-radius:9px; padding:.7rem; background:white; color:var(--cdm-navy); font:inherit; } button { min-height:46px; border:1px solid var(--cdm-btn-primary); border-radius:9px; padding:.7rem 1rem; background:var(--cdm-btn-primary); color:var(--cdm-white); font:inherit; font-weight:700; cursor:pointer; } button:disabled { opacity:.6; cursor:default; }.oauth-separator { display:flex; align-items:center; gap:.75rem; margin-top:1.35rem; color:var(--cdm-muted); font-size:.68rem; font-weight:800; letter-spacing:.1em; }.oauth-separator::before,.oauth-separator::after { content:''; height:1px; flex:1; background:var(--cdm-border); }.oauth-button { display:flex; align-items:center; justify-content:center; gap:.65rem; width:100%; margin-top:.85rem; border-color:#d9dee7; background:#fff; color:#002050; }.oauth-button:hover:not(:disabled) { border-color:#aeb8c8; background:#f8fafc; }.google-icon { width:20px; height:20px; flex:0 0 20px; }.error { color:#C92A2A; line-height:1.6; }.success { margin-top:1.5rem; padding:1rem; border:1px solid var(--cdm-btn-primary); border-radius:12px; background:var(--cdm-btn-primary-light); color:var(--cdm-navy); line-height:1.7; }.success a, .links a { color:var(--cdm-royal-blue); }.links { margin-top:1.25rem; } :is(a,button,input):focus-visible { outline:3px solid var(--cdm-royal-blue); outline-offset:3px; }
  `,
})
export class AuthSignUpComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly form = inject(NonNullableFormBuilder).group({
    fullName: ['', [Validators.required, Validators.maxLength(160)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)]],
    confirmPassword: ['', Validators.required],
  });
  protected readonly submitting = signal(false);
  protected readonly created = signal(false);
  protected readonly emailSentTo = signal('');
  protected readonly errorMessage = signal<string | null>(null);

  protected async googleSignIn(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true); this.errorMessage.set(null);
    try { await this.auth.signInWithGoogle(); }
    catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Google sign-in is unavailable.'); this.submitting.set(false); }
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.form.controls.password.value !== this.form.controls.confirmPassword.value) return;
    this.submitting.set(true); this.errorMessage.set(null);
    try {
      const { fullName, email, password } = this.form.getRawValue();
      await this.auth.signUp(fullName, email, password);
      this.emailSentTo.set(email); this.created.set(true);
    } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to create your account.'); }
    finally { this.submitting.set(false); }
  }
}
