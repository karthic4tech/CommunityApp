import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-auth-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card" aria-labelledby="reset-title"><h1 id="reset-title">Set a new password</h1>
      @if (!auth.isAuthenticated()) { <p class="message" role="alert">Open this page from the recovery link sent to your email.</p> } @else if (updated()) { <p class="success" role="status">Your password was updated. <a routerLink="/account">Go to your account</a></p> } @else {
      <form [formGroup]="form" (ngSubmit)="submit()"><label>New password<input type="password" formControlName="password" autocomplete="new-password" required /></label><label>Confirm password<input type="password" formControlName="confirm" autocomplete="new-password" required /></label>@if (form.controls.password.value !== form.controls.confirm.value) { <p class="message" role="alert">Passwords do not match.</p> } @if (message(); as text) { <p class="message" role="alert">{{ text }}</p> }<button type="submit" [disabled]="form.invalid || form.controls.password.value !== form.controls.confirm.value || saving()">{{ saving() ? 'Updating…' : 'Update password' }}</button></form>
      }<a class="back-link" routerLink="/auth/sign-in">Back to sign in</a>
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }.auth-card { width:min(100%,520px); margin-inline:auto; padding:clamp(1.5rem,4vw,2.5rem); border:1px solid #dfe7e2; border-radius:20px; background:white; }.auth-card h1 { color:#173f32; }.success,.message { color:#52665b; line-height:1.8; }.success { padding:1rem; border:1px solid #bcdcc6; background:#f1faf2; }.success a,.back-link { color:#075541; } form { display:grid; gap:1rem; } label { display:grid; gap:.4rem; color:#173f32; font-weight:650; } input { min-height:46px; border:1px solid #b8c9bf; border-radius:9px; padding:.7rem; font:inherit; } button { min-height:46px; border:1px solid #075541; border-radius:9px; background:#075541; color:white; font:inherit; font-weight:700; } button:disabled { opacity:.6; }.back-link { display:inline-flex; align-items:center; min-height:44px; margin-top:1rem; }
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
