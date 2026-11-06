import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/services/language.service';
import { ProfileService } from '../core/services/profile.service';
import { FormControlComponent } from '../shared/forms/form-control.component';
import { AuthMobileOtpComponent } from './auth-mobile-otp.component';
import { PHONE_COUNTRIES, PhoneCountry, normalizePhoneNumber } from './phone-number.utils';

@Component({
  selector: 'app-auth-sign-in',
  imports: [ReactiveFormsModule, RouterLink, FormControlComponent, AuthMobileOtpComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card" aria-labelledby="sign-in-title">
      <p class="eyebrow">CDM360</p>
      <h1 id="sign-in-title">{{ i18n.language() === 'ta' ? 'உள்நுழைக' : 'Sign in' }}</h1>
      @if (!mobileEntry()) {
        <form class="cdm-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <app-form-input label="Email" controlId="sign-in-email" type="email" autocomplete="username" placeholder="you@example.com" [required]="true" [error]="form.controls.email.touched && form.controls.email.hasError('required') ? 'Enter your email address.' : form.controls.email.touched && form.controls.email.hasError('email') ? 'Enter a valid email address.' : ''" formControlName="email" />
           <app-form-input label="Password" controlId="sign-in-password" type="password" autocomplete="current-password" placeholder="Enter your password" [required]="true" [showPasswordToggle]="true" [error]="form.controls.password.touched && form.controls.password.hasError('required') ? 'Enter your password.' : ''" formControlName="password" />
          @if (errorMessage(); as message) { <p class="error" role="alert">{{ message }}</p> }
          <button type="submit" [disabled]="form.invalid || submitting()">{{ submitting() ? 'Signing in…' : 'Sign in' }}</button>
        </form>
        <div class="oauth-separator" aria-hidden="true"><span>OR CONTINUE WITH</span></div>
        <button type="button" class="oauth-button" (click)="googleSignIn()" [disabled]="submitting()" [attr.aria-busy]="submitting()">
          <svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.27c0-.71-.06-1.4-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.22Z"/><path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.75Z"/><path fill="#FBBC05" d="M6.54 13.83A5.85 5.85 0 0 1 6.23 12c0-.64.11-1.26.31-1.83V7.64H3.3A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.05 4.36l3.24-2.53Z"/><path fill="#EA4335" d="M12 6.14c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.83 3.13 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 7.86 9.46 6.14 12 6.14Z"/></svg>
          <span>{{ submitting() ? 'Redirecting to Google…' : 'Continue with Google' }}</span>
        </button>
        @if (mobileAuthEnabled) {
          <button type="button" class="mobile-button" (click)="startMobileLogin()" [disabled]="submitting()"><i class="bi bi-phone" aria-hidden="true"></i> Continue with Mobile Number</button>
        }
      } @else if (mobilePhone(); as phone) {
        <app-auth-mobile-otp [phone]="phone" (verified)="completeMobileLogin()" (changeNumber)="changeMobileNumber()" />
      } @else {
        <section class="mobile-entry" aria-labelledby="mobile-login-title">
          <button type="button" class="back-link" (click)="mobileEntry.set(false)"><i class="bi bi-arrow-left" aria-hidden="true"></i> Use email or Google instead</button>
          <p class="eyebrow">MOBILE SIGN-IN</p><h2 id="mobile-login-title">Login with your mobile number</h2>
          <p class="intro">Enter your mobile number and we'll send you a verification code.</p>
          <form class="mobile-form" [formGroup]="phoneForm" (ngSubmit)="requestMobileOtp()" novalidate>
            <label for="country-code">Country</label>
            <select id="country-code" formControlName="countryCode" aria-label="Country code">
              @for (country of countries; track country.code) { <option [value]="country.dialCode">{{ country.flag }} {{ country.name }} ({{ country.dialCode }})</option> }
            </select>
            <label for="mobile-number">Mobile number</label>
            <div class="phone-control"><span aria-hidden="true">{{ selectedCountry().dialCode }}</span><input id="mobile-number" type="tel" inputmode="tel" autocomplete="tel-national" formControlName="mobileNumber" placeholder="95146 36355" maxlength="15" aria-describedby="mobile-help" /></div>
            <small id="mobile-help">For India, enter a 10-digit number beginning with 6, 7, 8 or 9.</small>
            @if (errorMessage(); as message) { <p class="error" role="alert">{{ message }}</p> }
            <button type="submit" class="mobile-submit" [disabled]="mobileSending()" [attr.aria-busy]="mobileSending()">{{ mobileSending() ? 'Sending code…' : 'Continue' }}</button>
          </form>
        </section>
      }
      @if (verificationEmail(); as email) {
        <div class="notice" role="status"><p>Please verify {{ email }} before continuing.</p><button type="button" class="text-button" (click)="resendVerification()">Resend verification email</button></div>
      }
      <div class="links"><a routerLink="/auth/forgot-password">Forgot password?</a><a routerLink="/auth/sign-up">Create an account</a></div>
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }
    .auth-card { width:min(100%, 520px); margin-inline:auto; padding:clamp(1.5rem,4vw,2.5rem); border:1px solid var(--cdm-border); border-radius:20px; background:white; box-shadow:0 8px 24px #0020500a; }
    .eyebrow { margin:0 0 .35rem; color:var(--cdm-muted); font-size:.72rem; font-weight:800; letter-spacing:.12em; }
    h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.7rem,4vw,2.4rem); }.intro { color:var(--cdm-muted); line-height:1.8; }
    form { display:grid; gap:1rem; margin-top:1.5rem; } label { display:grid; gap:.4rem; color:var(--cdm-navy); font-weight:650; }
    input { width:100%; min-height:46px; border:1px solid var(--cdm-border); border-radius:9px; padding:.7rem; background:white; color:var(--cdm-navy); font:inherit; }
     button { min-height:46px; border:1px solid var(--cdm-btn-primary); border-radius:9px; padding:.7rem 1rem; background:var(--cdm-btn-primary); color:var(--cdm-white); font:inherit; font-weight:700; cursor:pointer; }
     button:disabled { cursor:default; opacity:.6; }.oauth-separator { display:flex; align-items:center; gap:.75rem; margin-top:1.35rem; color:var(--cdm-muted); font-size:.68rem; font-weight:800; letter-spacing:.1em; }.oauth-separator::before,.oauth-separator::after { content:''; height:1px; flex:1; background:var(--cdm-border); }.oauth-button { display:flex; align-items:center; justify-content:center; gap:.65rem; width:100%; margin-top:.85rem; border-color:#d9dee7; background:#fff; color:#002050; box-shadow:0 2px 4px #0020500a; }.oauth-button:hover:not(:disabled) { border-color:#aeb8c8; background:#f8fafc; box-shadow:0 4px 10px #00205012; }.google-icon { width:20px; height:20px; flex:0 0 20px; }.error { color:#C92A2A; line-height:1.6; }.notice { margin-top:1rem; padding:1rem; border:1px solid var(--cdm-border); border-radius:12px; background:var(--cdm-page); color:var(--cdm-muted); line-height:1.7; }.text-button { min-height:auto; padding:0; border:0; background:none; color:var(--cdm-royal-blue); text-decoration:underline; }.links { display:flex; justify-content:space-between; flex-wrap:wrap; gap:.75rem; margin-top:1.25rem; }.links a { color:var(--cdm-royal-blue); }
     .mobile-button { width:100%; margin-top:.85rem; border-color:var(--cdm-green); background:var(--cdm-green); }.mobile-entry { margin-top:1.25rem; }.mobile-entry h2 { margin:0; color:var(--cdm-navy); font-size:clamp(1.45rem,4vw,2rem); }.back-link { display:inline-flex; gap:.4rem; align-items:center; margin-bottom:1.25rem; padding:0; border:0; background:none; color:var(--cdm-royal-blue); font:inherit; font-size:.82rem; font-weight:700; cursor:pointer; }.mobile-form { display:grid; gap:.55rem; margin-top:1.25rem; }.mobile-form label { color:var(--cdm-navy); font-size:.86rem; font-weight:700; }.mobile-form select,.phone-control { width:100%; min-height:46px; border:1px solid var(--cdm-border); border-radius:9px; background:#fff; color:var(--cdm-navy); font:inherit; }.mobile-form select { padding:.65rem; }.phone-control { display:flex; align-items:center; overflow:hidden; }.phone-control span { padding-inline:.75rem; border-right:1px solid var(--cdm-border); color:var(--cdm-navy); font-weight:750; }.phone-control input { min-height:44px; flex:1; border:0; padding:.65rem .75rem; outline:0; font:inherit; }.mobile-form small { color:var(--cdm-muted); line-height:1.5; }.mobile-submit { margin-top:.6rem; background:var(--cdm-green); border-color:var(--cdm-green); }.mobile-form :is(select,input):focus-visible { outline:3px solid #0755b833; outline-offset:2px; }.error { color:#C92A2A; line-height:1.6; }
     :is(a,button,input,select):focus-visible { outline:3px solid var(--cdm-royal-blue); outline-offset:3px; }
  `,
})
export class AuthSignInComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly form = inject(NonNullableFormBuilder).group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });
  protected readonly phoneForm = inject(NonNullableFormBuilder).group({ countryCode: ['+91'], mobileNumber: ['', Validators.required] });
  protected readonly countries = PHONE_COUNTRIES;
  protected readonly mobileAuthEnabled = false;
  protected readonly submitting = signal(false);
  protected readonly mobileSending = signal(false);
  protected readonly mobileEntry = signal(false);
  protected readonly mobilePhone = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly verificationEmail = signal<string | null>(null);
  private readonly profiles = inject(ProfileService);

  protected readonly selectedCountry = () => this.countries.find(country => country.dialCode === this.phoneForm.controls.countryCode.value) ?? PHONE_COUNTRIES[0];

  ngOnInit(): void {
    void this.redirectIfAuthenticated();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true); this.errorMessage.set(null); this.verificationEmail.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signIn(email, password);
      if (!this.auth.emailVerified()) {
        this.verificationEmail.set(email);
        return;
      }
      await this.router.navigateByUrl(this.destination());
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally { this.submitting.set(false); }
  }

  protected async googleSignIn(): Promise<void> {
    this.submitting.set(true); this.errorMessage.set(null);
    try { await this.auth.signInWithGoogle(); } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Google sign-in is unavailable.'); }
    finally { this.submitting.set(false); }
  }

  protected startMobileLogin(): void { this.mobileEntry.set(true); this.errorMessage.set(null); }

  protected async requestMobileOtp(): Promise<void> {
    if (this.mobileSending()) return;
    const country = this.selectedCountry();
    const phone = normalizePhoneNumber(country, this.phoneForm.controls.mobileNumber.value);
    if (!phone) { this.errorMessage.set(country.code === 'IN' ? 'Enter a valid 10-digit Indian mobile number.' : 'Enter a valid mobile number.'); return; }
    this.mobileSending.set(true); this.errorMessage.set(null);
    try { await this.auth.sendPhoneOtp(phone); this.mobilePhone.set(phone); }
    catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to send the verification code.'); }
    finally { this.mobileSending.set(false); }
  }

  protected changeMobileNumber(): void { this.mobilePhone.set(null); this.errorMessage.set(null); }

  protected async completeMobileLogin(): Promise<void> {
    const phone = this.mobilePhone();
    if (!phone) return;
    try {
      const user = this.auth.user();
      const metadata = user?.user_metadata;
      const name = typeof metadata?.['full_name'] === 'string' ? metadata['full_name'] : typeof metadata?.['name'] === 'string' ? metadata['name'] : null;
      await this.profiles.ensure(name, phone);
      await this.router.navigateByUrl(this.destination());
    } catch {
      this.errorMessage.set('Your mobile number is verified. Please complete your profile from your account.');
      await this.router.navigateByUrl('/account');
    }
  }

  protected async resendVerification(): Promise<void> {
    const email = this.verificationEmail();
    if (!email) return;
    try { await this.auth.resendVerification(email); this.errorMessage.set('Verification email sent.'); }
    catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to resend verification email.'); }
  }

  private async redirectIfAuthenticated(): Promise<void> {
    await this.auth.ready();
    if (this.route.snapshot.queryParamMap.get('switchAccount') === 'true') return;
    if (this.auth.isAuthenticated()) await this.router.navigateByUrl(this.auth.emailVerified() ? this.destination() : '/auth/verify-email');
  }

  private destination(): string {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/account';
    return requested.startsWith('/') && !requested.startsWith('//') ? requested : '/account';
  }
}
