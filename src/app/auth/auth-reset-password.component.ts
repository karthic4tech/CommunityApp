import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { FormFieldComponent } from '../shared/forms/form-field.component';

@Component({
  selector: 'app-auth-reset-password',
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card" aria-labelledby="reset-title"><h1 id="reset-title">Set a new password</h1>
      @if (!auth.isAuthenticated()) { <p class="message" role="alert">Open this page from the recovery link sent to your email.</p> } @else if (updated()) { <p class="success" role="status">Your password was updated. <a routerLink="/account">Go to your account</a></p> } @else {
      <form class="cdm-form" [formGroup]="form" (ngSubmit)="submit()" novalidate><app-form-field label="New password" controlId="reset-password" [required]="true" hint="At least 8 characters, including uppercase, lowercase and a number." [error]="form.controls.password.touched && form.controls.password.invalid ? 'Use at least 8 characters with uppercase, lowercase and a number.' : ''"><input class="form-control" id="reset-password" type="password" formControlName="password" autocomplete="new-password" required [attr.aria-invalid]="form.controls.password.touched && form.controls.password.invalid ? 'true' : null" [attr.aria-describedby]="form.controls.password.touched && form.controls.password.invalid ? 'reset-password-hint reset-password-error' : 'reset-password-hint'" /></app-form-field><app-form-field label="Confirm password" controlId="reset-confirm" [required]="true" [error]="form.controls.confirm.touched && form.controls.password.value !== form.controls.confirm.value ? 'Passwords do not match.' : ''"><input class="form-control" id="reset-confirm" type="password" formControlName="confirm" autocomplete="new-password" required [attr.aria-invalid]="form.controls.confirm.touched && form.controls.password.value !== form.controls.confirm.value ? 'true' : null" [attr.aria-describedby]="form.controls.confirm.touched && form.controls.password.value !== form.controls.confirm.value ? 'reset-confirm-error' : null" /></app-form-field>@if (message(); as text) { <p class="message" role="alert">{{ text }}</p> }<button type="submit" [disabled]="form.invalid || form.controls.password.value !== form.controls.confirm.value || saving()">{{ saving() ? 'Updating…' : 'Update password' }}</button></form>
      }<a class="back-link" routerLink="/auth/sign-in">Back to sign in</a>
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }.auth-card { width:min(100%,520px); margin-inline:auto; padding:clamp(1.5rem,4vw,2.5rem); border:1px solid var(--cdm-border); border-radius:20px; background:white; }.auth-card h1 { color:var(--cdm-navy); }.success,.message { color:var(--cdm-muted); line-height:1.8; }.success { padding:1rem; border:1px solid var(--cdm-btn-primary); background:var(--cdm-btn-primary-light); }.success a,.back-link { color:var(--cdm-royal-blue); } form { display:grid; gap:1rem; } label { display:grid; gap:.4rem; color:var(--cdm-navy); font-weight:650; } input { min-height:46px; border:1px solid var(--cdm-border); border-radius:9px; padding:.7rem; font:inherit; } button { min-height:46px; border:1px solid var(--cdm-btn-primary); border-radius:9px; background:var(--cdm-btn-primary); color:var(--cdm-white); font:inherit; font-weight:700; } button:disabled { opacity:.6; }.back-link { display:inline-flex; align-items:center; min-height:44px; margin-top:1rem; }
  `,
})
export class AuthResetPasswordComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly form = inject(NonNullableFormBuilder).group({ password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)]], confirm: ['', Validators.required] });
  protected readonly saving = signal(false);
  protected readonly updated = signal(false);
  protected readonly message = signal<string | null>(null);
  ngOnInit(): void { void this.auth.ready(); }
  protected async submit(): Promise<void> {
    if (this.form.invalid || this.form.controls.password.value !== this.form.controls.confirm.value) return;
    this.saving.set(true); this.message.set(null);
    try { await this.auth.updatePassword(this.form.controls.password.value); this.updated.set(true); }
    catch (error) { this.message.set(error instanceof Error ? error.message : 'Unable to update your password.'); }
    finally { this.saving.set(false); }
  }
}
