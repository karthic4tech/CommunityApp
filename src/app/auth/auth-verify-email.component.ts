import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-auth-verify-email',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card" aria-labelledby="verify-title">
      <h1 id="verify-title">Email verification</h1>
      @if (auth.emailVerified()) {
        <div class="success" role="status"><p>Your email is verified. You can now submit a service.</p><a routerLink="/account">Go to your account</a></div>
      } @else {
        <p class="intro">Verify your email before submitting a community service. We never treat a URL parameter as proof of verification.</p>
        <form [formGroup]="form" (ngSubmit)="resend()" novalidate><label>Email<input type="email" formControlName="email" autocomplete="email" required /></label><button type="submit" [disabled]="form.invalid || sending()">{{ sending() ? 'Sending…' : 'Resend verification email' }}</button></form>
        @if (message(); as text) { <p class="message" role="status">{{ text }}</p> }
      }
      <a class="back-link" routerLink="/auth/sign-in">Back to sign in</a>
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }.auth-card { width:min(100%, 520px); margin-inline:auto; padding:clamp(1.5rem,4vw,2.5rem); border:1px solid #dfe7e2; border-radius:20px; background:white; }.auth-card h1 { margin:0; color:#173f32; }.intro,.message { color:#52665b; line-height:1.8; } form { display:grid; gap:1rem; margin-top:1.5rem; } label { display:grid; gap:.4rem; color:#173f32; font-weight:650; } input { min-height:46px; border:1px solid #b8c9bf; border-radius:9px; padding:.7rem; font:inherit; } button { min-height:46px; border:1px solid #075541; border-radius:9px; background:#075541; color:white; font:inherit; font-weight:700; } button:disabled { opacity:.6; }.success { padding:1rem; border:1px solid #bcdcc6; border-radius:12px; background:#f1faf2; color:#275b3c; line-height:1.7; }.success a,.back-link { color:#075541; }.back-link { display:inline-flex; min-height:44px; align-items:center; margin-top:1rem; }
  `,
})
export class AuthVerifyEmailComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  protected readonly form = inject(NonNullableFormBuilder).group({ email: ['', [Validators.required, Validators.email]] });
  protected readonly sending = signal(false);
  protected readonly message = signal<string | null>(null);

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email') ?? this.auth.user()?.email ?? '';
    this.form.controls.email.setValue(email);
  }

  protected async resend(): Promise<void> {
    if (this.form.invalid) return;
    this.sending.set(true); this.message.set(null);
    try { await this.auth.resendVerification(this.form.controls.email.value); this.message.set('Verification email sent.'); }
    catch (error) { this.message.set(error instanceof Error ? error.message : 'Unable to resend verification email.'); }
    finally { this.sending.set(false); }
  }
}
