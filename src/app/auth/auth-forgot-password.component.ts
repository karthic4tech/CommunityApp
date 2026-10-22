import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-auth-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card" aria-labelledby="forgot-title"><h1 id="forgot-title">Reset your password</h1><p class="intro">Enter your email and Supabase Auth will send a recovery link.</p>
      <form [formGroup]="form" (ngSubmit)="submit()"><label>Email<input type="email" formControlName="email" autocomplete="email" required /></label><button type="submit" [disabled]="form.invalid || sending()">{{ sending() ? 'Sending…' : 'Send recovery email' }}</button></form>
      @if (message(); as text) { <p class="message" role="status">{{ text }}</p> }<a class="back-link" routerLink="/auth/sign-in">Back to sign in</a>
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }.auth-card { width:min(100%,520px); margin-inline:auto; padding:clamp(1.5rem,4vw,2.5rem); border:1px solid #dfe7e2; border-radius:20px; background:white; }.auth-card h1 { color:#173f32; }.intro,.message { color:#52665b; line-height:1.8; } form { display:grid; gap:1rem; } label { display:grid; gap:.4rem; color:#173f32; font-weight:650; } input { min-height:46px; border:1px solid #b8c9bf; border-radius:9px; padding:.7rem; font:inherit; } button { min-height:46px; border:1px solid #075541; border-radius:9px; background:#075541; color:white; font:inherit; font-weight:700; } button:disabled { opacity:.6; }.back-link { display:inline-flex; align-items:center; min-height:44px; margin-top:1rem; color:#075541; }
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
