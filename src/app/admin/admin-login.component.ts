import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/services/language.service';

@Component({
  selector: 'app-admin-login',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="admin-shell" aria-labelledby="admin-login-title">
      <p class="eyebrow">{{ i18n.language() === 'ta' ? 'நிர்வாக அணுகல்' : 'ADMIN ACCESS' }}</p>
      <h1 id="admin-login-title">{{ i18n.language() === 'ta' ? 'நிர்வாக உள்நுழைவு' : 'Administrator sign in' }}</h1>
      <p class="intro">{{ i18n.language() === 'ta' ? 'அங்கீகரிக்கப்பட்ட நிர்வாகிகள் மட்டுமே இந்தப் பகுதியை அணுக முடியும்.' : 'Only approved administrators can access this area.' }}</p>

      @if (initialising()) {
        <p class="state" role="status">{{ i18n.language() === 'ta' ? 'அணுகல் சரிபார்க்கப்படுகிறது…' : 'Checking access…' }}</p>
      } @else if (auth.user() && !auth.isAdmin()) {
        <div class="state" role="alert">
          <p>{{ i18n.language() === 'ta' ? 'இந்தக் கணக்கிற்கு நிர்வாக அனுமதி இல்லை.' : 'This account does not have administrator access.' }}</p>
          <button type="button" class="secondary" (click)="signOut()">{{ i18n.language() === 'ta' ? 'வெளியேறு' : 'Sign out' }}</button>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label>
            {{ i18n.language() === 'ta' ? 'மின்னஞ்சல்' : 'Email' }}
            <input type="email" formControlName="email" autocomplete="username" required />
          </label>
          <label>
            {{ i18n.language() === 'ta' ? 'கடவுச்சொல்' : 'Password' }}
            <input type="password" formControlName="password" autocomplete="current-password" required />
          </label>
          @if (errorMessage(); as message) { <p class="error" role="alert">{{ message }}</p> }
          <button type="submit" [disabled]="form.invalid || submitting()">
            {{ submitting() ? (i18n.language() === 'ta' ? 'உள்நுழைகிறது…' : 'Signing in…') : (i18n.language() === 'ta' ? 'உள்நுழைக' : 'Sign in') }}
          </button>
        </form>
        @if (auth.error(); as authError) { <p class="error" role="status">{{ authError }}</p> }
      }
      <a class="back-link" routerLink="/services">{{ i18n.language() === 'ta' ? 'சேவைகளுக்குத் திரும்பு' : 'Back to services' }}</a>
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }
    .admin-shell { width:min(100%, 560px); margin-inline:auto; padding:clamp(1.5rem,4vw,2.5rem); border:1px solid #dfe7e2; border-radius:20px; background:white; box-shadow:0 8px 24px #1d48350c; }
    .eyebrow { margin:0 0 .35rem; color:#52665b; font-size:.72rem; font-weight:800; letter-spacing:.12em; }
    h1 { margin:0; color:#173f32; font-size:clamp(1.6rem,4vw,2.25rem); overflow-wrap:anywhere; }
    .intro { color:#52665b; line-height:1.8; }
    form { display:grid; gap:1rem; margin-top:1.5rem; }
    label { display:grid; gap:.4rem; color:#173f32; font-weight:650; }
    input { width:100%; min-height:46px; border:1px solid #b8c9bf; border-radius:9px; padding:.7rem; background:white; color:#173f32; font:inherit; }
    button { min-height:46px; border:1px solid #075541; border-radius:9px; padding:.7rem 1rem; background:#075541; color:white; font:inherit; font-weight:700; cursor:pointer; }
    button:disabled { cursor:default; opacity:.6; }
    button.secondary { background:white; color:#075541; }
    .error { color:#8a261f; line-height:1.6; }
    .state { margin-block:1.25rem; padding:1rem; border:1px solid #dfe7e2; border-radius:12px; background:#f8fbf8; color:#52665b; line-height:1.7; }
    .state button { margin-top:.5rem; }
    .back-link { display:inline-flex; align-items:center; min-height:44px; margin-top:1.25rem; color:#075541; }
    :is(a,button,input):focus-visible { outline:3px solid #17583f; outline-offset:3px; }
  `,
})
export class AdminLoginComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  protected readonly initialising = signal(true);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    void this.prepare();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signInAdmin(email, password);
      await this.router.navigateByUrl(this.destination());
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
      this.errorMessage.set(null);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  }

  private async prepare(): Promise<void> {
    await this.auth.ready();
    this.initialising.set(false);
    if (this.auth.isAdmin()) await this.router.navigateByUrl(this.destination());
  }

  private destination(): string {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/admin';
    return requested.startsWith('/') && !requested.startsWith('//') ? requested : '/admin';
  }
}
