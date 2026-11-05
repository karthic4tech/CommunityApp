import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/services/language.service';
import { FormFieldComponent } from '../shared/forms/form-field.component';

@Component({
  selector: 'app-admin-login',
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent],
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
        <form class="cdm-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <app-form-field [label]="i18n.language() === 'ta' ? 'மின்னஞ்சல்' : 'Email'" controlId="admin-login-email" [required]="true" [error]="form.controls.email.touched && form.controls.email.hasError('required') ? 'Enter your email address.' : form.controls.email.touched && form.controls.email.hasError('email') ? 'Enter a valid email address.' : ''"><input class="form-control" id="admin-login-email" type="email" formControlName="email" autocomplete="username" required [attr.aria-invalid]="form.controls.email.touched && form.controls.email.invalid ? 'true' : null" [attr.aria-describedby]="form.controls.email.touched && form.controls.email.invalid ? 'admin-login-email-error' : null" /></app-form-field>
           <app-form-field [label]="i18n.language() === 'ta' ? 'கடவுச்சொல்' : 'Password'" controlId="admin-login-password" [required]="true" [error]="form.controls.password.touched && form.controls.password.hasError('required') ? 'Enter your password.' : ''"><span class="password-control"><input class="form-control" id="admin-login-password" [type]="passwordVisible() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" required [attr.aria-invalid]="form.controls.password.touched && form.controls.password.invalid ? 'true' : null" [attr.aria-describedby]="form.controls.password.touched && form.controls.password.invalid ? 'admin-login-password-error' : null" /><button class="password-toggle" type="button" [attr.aria-label]="passwordVisible() ? (i18n.language() === 'ta' ? 'கடவுச்சொல்லை மறைக்கவும்' : 'Hide password') : (i18n.language() === 'ta' ? 'கடவுச்சொல்லைக் காட்டவும்' : 'Show password')" [attr.aria-pressed]="passwordVisible()" (click)="passwordVisible.update(visible => !visible)"><i class="bi" [class.bi-eye-slash]="passwordVisible()" [class.bi-eye]="!passwordVisible()" aria-hidden="true"></i></button></span></app-form-field>
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
    .admin-shell { width:min(100%, 560px); margin-inline:auto; padding:clamp(1.5rem,4vw,2.5rem); border:1px solid var(--cdm-border); border-radius:20px; background:white; box-shadow:0 8px 24px #0020500a; }
    .eyebrow { margin:0 0 .35rem; color:var(--cdm-muted); font-size:.72rem; font-weight:800; letter-spacing:.12em; }
    h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.6rem,4vw,2.25rem); overflow-wrap:anywhere; }
    .intro { color:var(--cdm-muted); line-height:1.8; }
    form { display:grid; gap:1rem; margin-top:1.5rem; }
    label { display:grid; gap:.4rem; color:var(--cdm-navy); font-weight:650; }
    input { width:100%; min-height:46px; border:1px solid var(--cdm-border); border-radius:9px; padding:.7rem; background:white; color:var(--cdm-navy); font:inherit; }
    .password-control { position:relative; display:block; }
    .password-control .form-control { padding-inline-end:3.25rem; }
    .password-toggle { position:absolute; top:50%; right:.35rem; display:grid; place-items:center; width:2.5rem; min-height:2.5rem; padding:0; border:0; border-radius:7px; color:var(--cdm-navy); background:transparent; transform:translateY(-50%); cursor:pointer; }
    .password-toggle:hover { color:var(--cdm-royal-blue); background:var(--cdm-page); }
    button { min-height:46px; border:1px solid var(--cdm-btn-primary); border-radius:9px; padding:.7rem 1rem; background:var(--cdm-btn-primary); color:var(--cdm-white); font:inherit; font-weight:700; cursor:pointer; }
    button:disabled { cursor:default; opacity:.6; }
    button.secondary { background:white; color:var(--cdm-royal-blue); }
    .error { color:#C92A2A; line-height:1.6; }
    .state { margin-block:1.25rem; padding:1rem; border:1px solid var(--cdm-border); border-radius:12px; background:var(--cdm-page); color:var(--cdm-muted); line-height:1.7; }
    .state button { margin-top:.5rem; }
    .back-link { display:inline-flex; align-items:center; min-height:44px; margin-top:1.25rem; color:var(--cdm-royal-blue); }
    :is(a,button,input):focus-visible { outline:3px solid var(--cdm-royal-blue); outline-offset:3px; }
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
  protected readonly passwordVisible = signal(false);
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
