import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { FormFieldComponent } from '../shared/forms/form-field.component';

@Component({
  selector: 'app-auth-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card" aria-labelledby="forgot-title"><h1 id="forgot-title">Reset your password</h1><p class="intro">Enter your email and Supabase Auth will send a recovery link.</p>
      <form class="cdm-form" [formGroup]="form" (ngSubmit)="submit()" novalidate><app-form-field label="Email" controlId="forgot-email" [required]="true" [error]="form.controls.email.touched && form.controls.email.hasError('required') ? 'Enter your email address.' : form.controls.email.touched && form.controls.email.hasError('email') ? 'Enter a valid email address.' : ''"><input class="form-control" id="forgot-email" type="email" formControlName="email" autocomplete="email" required [attr.aria-invalid]="form.controls.email.touched && form.controls.email.invalid ? 'true' : null" [attr.aria-describedby]="form.controls.email.touched && form.controls.email.invalid ? 'forgot-email-error' : null" /></app-form-field><button type="submit" [disabled]="form.invalid || sending()">{{ sending() ? 'Sending…' : 'Send recovery email' }}</button></form>
      @if (message(); as text) { <p class="message" role="status">{{ text }}</p> }<a class="back-link" routerLink="/auth/sign-in">Back to sign in</a>
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }.auth-card { width:min(100%,520px); margin-inline:auto; padding:clamp(1.5rem,4vw,2.5rem); border:1px solid var(--cdm-border); border-radius:20px; background:white; }.auth-card h1 { color:var(--cdm-navy); }.intro,.message { color:var(--cdm-muted); line-height:1.8; } form { display:grid; gap:1rem; } label { display:grid; gap:.4rem; color:var(--cdm-navy); font-weight:650; } input { min-height:46px; border:1px solid var(--cdm-border); border-radius:9px; padding:.7rem; font:inherit; } button { min-height:46px; border:1px solid var(--cdm-btn-primary); border-radius:9px; background:var(--cdm-btn-primary); color:var(--cdm-white); font:inherit; font-weight:700; } button:disabled { opacity:.6; }.back-link { display:inline-flex; align-items:center; min-height:44px; margin-top:1rem; color:var(--cdm-royal-blue); }
  `,
})
export class AuthForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  protected readonly form = inject(NonNullableFormBuilder).group({ email: ['', [Validators.required, Validators.email]] });
  protected readonly sending = signal(false);
  protected readonly message = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.sending.set(true); this.message.set(null);
    try { await this.auth.sendPasswordReset(this.form.controls.email.value); this.message.set('If an account exists for this email, a recovery link has been sent.'); }
    catch { this.message.set('If an account exists for this email, a recovery link has been sent.'); }
    finally { this.sending.set(false); }
  }
}
