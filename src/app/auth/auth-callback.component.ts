import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { ProfileService } from '../core/services/profile.service';
import { SupabaseService } from '../core/services/supabase.service';

@Component({
  selector: 'app-auth-callback',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="callback-card" aria-labelledby="callback-title" aria-live="polite">
      @if (errorMessage(); as error) {
        <div class="callback-icon callback-icon-error" aria-hidden="true"><i class="bi bi-exclamation-triangle"></i></div>
        <h1 id="callback-title">Sign-in could not be completed</h1>
        <p>{{ error }}</p>
        <a class="callback-action" routerLink="/auth/sign-in">Return to sign in</a>
      } @else {
        <div class="callback-spinner" aria-hidden="true"></div>
        <h1 id="callback-title">{{ statusMessage() }}</h1>
        <p>Please wait while we securely prepare your CDM 360 account.</p>
      }
    </section>
  `,
  styles: `
    :host { display:grid; min-height:55vh; place-items:center; padding:2rem 1rem; }
    .callback-card { width:min(100%, 480px); padding:clamp(2rem,6vw,3.5rem); border:1px solid var(--cdm-border); border-radius:20px; background:#fff; box-shadow:0 12px 36px #00205012; text-align:center; }
    h1 { margin:1rem 0 .6rem; color:var(--cdm-navy); font-size:clamp(1.35rem,4vw,1.8rem); }.callback-card p { color:var(--cdm-muted); line-height:1.7; }
    .callback-spinner { width:42px; height:42px; margin:0 auto; border:4px solid var(--cdm-border); border-top-color:var(--cdm-royal-blue); border-radius:50%; animation:spin .8s linear infinite; }
    .callback-icon { display:grid; place-items:center; width:46px; height:46px; margin:0 auto; border-radius:50%; background:#fff1ed; color:#b33a24; font-size:1.3rem; }.callback-action { display:inline-flex; min-height:44px; align-items:center; justify-content:center; margin-top:1rem; padding:.7rem 1rem; border-radius:9px; background:var(--cdm-btn-primary); color:#fff; font-weight:700; text-decoration:none; }
    @keyframes spin { to { transform:rotate(360deg); } }
    :is(a):focus-visible { outline:3px solid var(--cdm-royal-blue); outline-offset:3px; }
    @media (prefers-reduced-motion: reduce) { .callback-spinner { animation:none; } }
  `,
})
export class AuthCallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfileService);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  protected readonly statusMessage = signal('Completing sign-in…');
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void { void this.complete(); }

  private async complete(): Promise<void> {
    try {
      await this.auth.ready();
      this.statusMessage.set('Loading your profile…');
      const { data, error } = await this.supabase.client.auth.getUser();
      if (error || !data.user) throw new Error('We could not verify your Google account. Please try again.');

      const metadata = data.user.user_metadata;
      const fullName = this.metadataString(metadata, 'full_name') || this.metadataString(metadata, 'name');
      await this.profiles.ensure(fullName);
      this.statusMessage.set('Sign-in successful. Redirecting…');
      await this.router.navigateByUrl('/account', { replaceUrl: true });
    } catch (error) {
      this.errorMessage.set(error instanceof Error && error.message.includes('profile')
        ? 'Your account was verified, but we could not load your CDM 360 profile. Please try again.'
        : 'We could not complete sign-in. The link may have expired or the request may have been cancelled.');
    }
  }

  private metadataString(metadata: Record<string, unknown> | undefined, key: string): string {
    const value = metadata?.[key];
    return typeof value === 'string' ? value.trim() : '';
  }
}
