import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, output, signal, viewChildren } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/services/language.service';
import { ProfileService } from '../core/services/profile.service';
import { PHONE_COUNTRIES, normalizePhoneNumber } from '../auth/phone-number.utils';

@Component({
  selector: 'app-mobile-verification',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!phoneIsVerified()) {
      <section class="mobile-card" aria-labelledby="mobile-title">
        <div class="mobile-card-icon bi bi-phone" aria-hidden="true"></div>
        <div class="mobile-card-content">
          @if (dismissed() && !expanded() && !phone()) {
            <div><h2 id="mobile-title">{{ ta() ? 'மொபைல் எண்ணைச் சரிபார்க்கவும்' : 'Mobile number verification' }}</h2><button type="button" class="primary" (click)="expanded.set(true)">{{ ta() ? 'மொபைல் எண்ணைச் சேர்' : 'Add mobile number' }}</button></div>
          } @else if (!phone() && !expanded()) {
            <p class="eyebrow">{{ ta() ? 'மொபைல் சரிபார்ப்பு' : 'MOBILE VERIFICATION' }}</p>
            <h2 id="mobile-title">{{ ta() ? 'உங்கள் மொபைல் எண்ணைச் சேர்க்கவும்' : 'Add your mobile number' }}</h2>
            <p>{{ ta() ? 'CDM360 அறிவிப்புகள் மற்றும் முக்கிய தகவல்களைப் பெற உங்கள் மொபைல் எண்ணைச் சேர்த்து சரிபார்க்கவும்.' : 'Stay connected with CDM 360. Add and verify your mobile number to receive important account and community updates.' }}</p>
            <div class="banner-actions"><button type="button" class="primary" (click)="expanded.set(true)">{{ ta() ? 'மொபைல் எண்ணைச் சேர்' : 'Add mobile number' }}</button><button type="button" class="link-button" (click)="remindLater()">{{ ta() ? 'பின்னர் நினைவூட்டு' : 'Remind me later' }}</button></div>
          } @else if (!phone()) {
            <form [formGroup]="phoneForm" (ngSubmit)="send()" novalidate>
              <label for="account-mobile">{{ ta() ? 'மொபைல் எண்' : 'Mobile number' }}</label>
              <div class="phone-input"><span aria-hidden="true">+91</span><input id="account-mobile" type="tel" inputmode="numeric" autocomplete="tel-national" formControlName="mobile" maxlength="10" placeholder="9876543210" [attr.aria-invalid]="phoneForm.controls.mobile.touched && phoneForm.controls.mobile.invalid ? 'true' : null" /></div>
              <small>{{ ta() ? '10 இலக்க இந்திய மொபைல் எண்ணை உள்ளிடவும்.' : 'Enter a valid 10-digit Indian mobile number.' }}</small>
              @if (phoneForm.controls.mobile.touched && phoneForm.controls.mobile.invalid) { <span class="field-error" role="alert">{{ ta() ? 'சரியான மொபைல் எண்ணை உள்ளிடவும்.' : 'Enter a valid Indian mobile number.' }}</span> }
              @if (error(); as message) { <p class="error" role="alert">{{ message }}</p> }
              <button type="submit" class="primary" [disabled]="sending()">{{ sending() ? (ta() ? 'அனுப்பப்படுகிறது…' : 'Sending…') : (ta() ? 'OTP அனுப்பவும்' : 'Send verification code') }}</button>
            </form>
          } @else {
            <p class="eyebrow">{{ ta() ? 'சரிபார்ப்புக் குறியீடு' : 'VERIFICATION CODE' }}</p>
            <h2 id="mobile-title">{{ ta() ? 'உங்கள் எண்ணைச் சரிபார்க்கவும்' : 'Verify your mobile number' }}</h2>
            <p>{{ ta() ? phone() : 'We sent a 6-digit code to ' + phone() }}</p>
            <div class="otp-grid" aria-label="Six-digit verification code">
              @for (digit of digits(); track $index; let i = $index) { <input #otpInput type="text" inputmode="numeric" maxlength="1" [value]="digit" [attr.aria-label]="'Digit ' + (i + 1)" (input)="setDigit(i, $event)" (keydown)="keyDown(i, $event)" (paste)="paste($event)" /> }
            </div>
            @if (error(); as message) { <p class="error" role="alert">{{ message }}</p> }
            <div class="otp-actions"><button type="button" class="primary" [disabled]="verifying() || code().length !== 6" (click)="verify()">{{ verifying() ? (ta() ? 'சரிபார்க்கப்படுகிறது…' : 'Verifying…') : (ta() ? 'சரிபார்க்கவும்' : 'Verify number') }}</button><button type="button" class="link-button" [disabled]="sending() || countdown() > 0" (click)="resend()">{{ countdown() ? (ta() ? countdown() + ' வினாடிகள்' : 'Resend in ' + countdown() + 's') : (ta() ? 'மீண்டும் அனுப்பவும்' : 'Resend code') }}</button></div>
          }
        </div>
      </section>
    }
  `,
  styles: `
    :host { display:block; }
    .mobile-card { display:flex; gap:1rem; margin-bottom:1rem; padding:1.25rem; border:1px solid #f1d4c2; border-radius:16px; background:linear-gradient(120deg,#fff4ec,#fff); }
    .mobile-card-icon { display:grid; place-items:center; flex:0 0 46px; width:46px; height:46px; border-radius:12px; color:#0755b8; background:#eaf3ff; font-size:1.2rem; }
    .mobile-card-content { min-width:0; flex:1; }.eyebrow { margin:0 0 .35rem; color:#0755b8; font-size:.68rem; font-weight:800; letter-spacing:.12em; }.mobile-card h2 { margin:0; color:#002050; font-size:1.2rem; }.mobile-card p { color:#64748b; line-height:1.55; }.mobile-card form { display:grid; max-width:430px; gap:.45rem; }.mobile-card label { color:#002050; font-size:.82rem; font-weight:700; }.phone-input { display:flex; min-height:44px; overflow:hidden; border:1px solid #cbd5e1; border-radius:9px; background:#fff; }.phone-input span { display:grid; place-items:center; padding-inline:.75rem; border-right:1px solid #e2e8f0; color:#002050; font-weight:750; }.phone-input input { min-width:0; flex:1; border:0; outline:0; padding:.6rem .75rem; font:inherit; }.mobile-card small { color:#64748b; }.field-error,.error { color:#b42318 !important; font-size:.82rem; }.primary { min-height:42px; margin-top:.4rem; padding:.55rem .8rem; border:1px solid #0755b8; border-radius:8px; color:#fff; background:#0755b8; font:inherit; font-weight:750; cursor:pointer; }.primary:disabled { opacity:.6; cursor:not-allowed; }.otp-grid { display:flex; gap:.45rem; margin:1rem 0; }.otp-grid input { width:42px; height:48px; border:1px solid #cbd5e1; border-radius:8px; color:#002050; text-align:center; font:inherit; font-size:1.1rem; font-weight:750; }.otp-grid input:focus { border-color:#0755b8; outline:3px solid #0755b833; }.otp-actions { display:flex; align-items:center; flex-wrap:wrap; gap:.8rem; }.link-button { border:0; color:#0755b8; background:transparent; font:inherit; font-size:.82rem; font-weight:700; cursor:pointer; }.link-button:disabled { color:#64748b; cursor:not-allowed; }
    @media(max-width:480px) { .mobile-card { align-items:flex-start; padding:1rem; }.otp-grid { gap:.3rem; }.otp-grid input { width:38px; height:44px; } }
  `,
})
export class MobileVerificationComponent {
  protected readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfileService);
  private readonly i18n = inject(LanguageService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('otpInput');
  readonly verified = output<void>();
  protected readonly phoneForm = this.fb.group({ mobile: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]] });
  protected readonly phone = signal<string | null>(null);
  protected readonly expanded = signal(false);
  protected readonly dismissed = signal(false);
  protected readonly digits = signal<string[]>(Array.from({ length: 6 }, () => ''));
  protected readonly sending = signal(false); protected readonly verifying = signal(false); protected readonly error = signal<string | null>(null); protected readonly countdown = signal(0);
  protected readonly ta = () => this.i18n.language() === 'ta';
  protected readonly phoneIsVerified = () => typeof this.auth.phoneVerified === 'function' && this.auth.phoneVerified();
  protected readonly code = () => this.digits().join('');
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor() {
    try { this.dismissed.set(globalThis.sessionStorage?.getItem('cdm360-mobile-reminder-dismissed') === '1'); } catch { /* Storage may be unavailable. */ }
    this.destroyRef.onDestroy(() => { if (this.timer) clearInterval(this.timer); });
  }
  protected remindLater(): void { this.dismissed.set(true); try { globalThis.sessionStorage?.setItem('cdm360-mobile-reminder-dismissed', '1'); } catch { /* Storage may be unavailable. */ } }
  protected async send(): Promise<void> {
    this.phoneForm.markAllAsTouched(); if (this.phoneForm.invalid) return;
    const normalized = normalizePhoneNumber(PHONE_COUNTRIES[0], this.phoneForm.controls.mobile.value);
    if (!normalized) { this.error.set(this.ta() ? 'சரியான மொபைல் எண்ணை உள்ளிடவும்.' : 'Enter a valid Indian mobile number.'); return; }
    await this.requestCode(normalized);
  }
  protected async resend(): Promise<void> { const current = this.phone(); if (current) await this.requestCode(current); }
  private async requestCode(phone: string): Promise<void> { this.sending.set(true); this.error.set(null); try { await this.auth.sendPhoneChangeOtp(phone); this.phone.set(phone); this.digits.set(Array.from({ length: 6 }, () => '')); this.startCountdown(); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to send the verification code.'); } finally { this.sending.set(false); } }
  protected setDigit(index: number, event: Event): void { const input = event.target as HTMLInputElement; const value = input.value.replace(/\D/g, '').slice(-1); this.digits.update(current => current.map((digit, i) => i === index ? value : digit)); if (value) this.boxes()[index + 1]?.nativeElement.focus(); }
  protected keyDown(index: number, event: KeyboardEvent): void { if (event.key === 'Backspace' && !this.digits()[index]) this.boxes()[index - 1]?.nativeElement.focus(); }
  protected paste(event: ClipboardEvent): void { const pasted = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) ?? ''; if (!pasted) return; event.preventDefault(); this.digits.set(Array.from({ length: 6 }, (_, i) => pasted[i] ?? '')); this.boxes()[Math.min(pasted.length, 6) - 1]?.nativeElement.focus(); }
  protected async verify(): Promise<void> { const current = this.phone(); const token = this.code(); if (!current || token.length !== 6) return; this.verifying.set(true); this.error.set(null); try { await this.auth.verifyPhoneChangeOtp(current, token); await this.profiles.syncVerifiedPhone(); this.verified.emit(); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to verify the mobile number.'); } finally { this.verifying.set(false); } }
  private startCountdown(): void { if (this.timer) clearInterval(this.timer); this.countdown.set(60); this.timer = setInterval(() => this.countdown.update(value => { if (value <= 1) { if (this.timer) clearInterval(this.timer); return 0; } return value - 1; }), 1000); }
}
