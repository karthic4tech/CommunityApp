import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/services/language.service';

@Component({
  selector: 'app-auth-sign-up',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card" aria-labelledby="sign-up-title">
      <p class="eyebrow">NAM CHIDAMBARAM</p><h1 id="sign-up-title">Create your account</h1>
      <p class="intro">Create an account to submit and manage your community service listings.</p>
      @if (created()) {
        <div class="success" role="status"><h2>Check your email</h2><p>We sent a verification link to <strong>{{ emailSentTo() }}</strong>. Verify your email before submitting a service.</p><a routerLink="/auth/verify-email">Continue to verification</a></div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label>Full name<input type="text" formControlName="fullName" autocomplete="name" maxlength="160" required /></label>
          <label>Email<input type="email" formControlName="email" autocomplete="email" required /></label>
          <label>Password<input type="password" formControlName="password" autocomplete="new-password" required /><small>Use at least 8 characters with uppercase, lowercase and a number.</small></label>
          <label>Confirm password<input type="password" formControlName="confirmPassword" autocomplete="new-password" required /></label>
          @if (form.controls.confirmPassword.touched && form.controls.password.value !== form.controls.confirmPassword.value) { <p class="error" role="alert">Passwords do not match.</p> }
          @if (errorMessage(); as message) { <p class="error" role="alert">{{ message }}</p> }
          <button type="submit" [disabled]="form.invalid || submitting() || form.controls.password.value !== form.controls.confirmPassword.value">{{ submitting() ? 'Creating account…' : 'Create account' }}</button>
        </form>
      }
      <p class="links"><a routerLink="/auth/sign-in">Already have an account? Sign in</a></p>
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }.auth-card { width:min(100%, 560px); margin-inline:auto; padding:clamp(1.5rem,4vw,2.5rem); border:1px solid #dfe7e2; border-radius:20px; background:white; box-shadow:0 8px 24px #1d48350c; }.eyebrow { margin:0 0 .35rem; color:#52665b; font-size:.72rem; font-weight:800; letter-spacing:.12em; } h1 { margin:0; color:#173f32; font-size:clamp(1.7rem,4vw,2.4rem); }.intro, small { color:#52665b; line-height:1.7; } form { display:grid; gap:1rem; margin-top:1.5rem; } label { display:grid; gap:.4rem; color:#173f32; font-weight:650; } input { width:100%; min-height:46px; border:1px solid #b8c9bf; border-radius:9px; padding:.7rem; background:white; color:#173f32; font:inherit; } button { min-height:46px; border:1px solid #075541; border-radius:9px; padding:.7rem 1rem; background:#075541; color:white; font:inherit; font-weight:700; cursor:pointer; } button:disabled { opacity:.6; cursor:default; }.error { color:#8a261f; line-height:1.6; }.success { margin-top:1.5rem; padding:1rem; border:1px solid #bcdcc6; border-radius:12px; background:#f1faf2; color:#275b3c; line-height:1.7; }.success a, .links a { color:#075541; }.links { margin-top:1.25rem; } :is(a,button,input):focus-visible { outline:3px solid #17583f; outline-offset:3px; }
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
