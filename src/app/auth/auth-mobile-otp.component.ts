import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, afterNextRender, inject, input, output, signal, viewChildren } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { formatPhoneForDisplay } from './phone-number.utils';

@Component({
  selector: 'app-auth-mobile-otp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="otp-panel" aria-labelledby="otp-title">
      <button type="button" class="back-link" (click)="changeNumber.emit()" [disabled]="busy()">
        <i class="bi bi-arrow-left" aria-hidden="true"></i> Change mobile number
      </button>
      <p class="eyebrow">MOBILE VERIFICATION</p>
      <h2 id="otp-title">Verify your mobile number</h2>
      <p class="intro">We sent a verification code to <strong>{{ displayPhone() }}</strong>.</p>

      <div class="otp-fields" role="group" aria-label="Six-digit verification code">
        @for (digit of digits(); track $index; let index = $index) {
          <input #otpInput type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="1"
            [value]="digit" [attr.aria-label]="'Verification code digit ' + (index + 1) + ' of 6'"
            [disabled]="busy()" (input)="inputDigit(index, $event)" (keydown)="keyDown(index, $event)"
            (paste)="pasteCode($event)" />
        }
      </div>
      @if (errorMessage(); as message) { <p class="error" role="alert">{{ message }}</p> }
      @if (successMessage(); as message) { <p class="success" role="status">{{ message }}</p> }
      <button type="button" class="verify-button" [disabled]="otp().length !== 6 || busy()" [attr.aria-busy]="busy()" (click)="verify()">
        {{ verifying() ? 'Verifying…' : 'Verify mobile number' }}
      </button>
      <div class="resend-row">
        @if (countdown() > 0) { <span>Resend code in {{ countdown() }}s</span> }
        @else { <button type="button" class="text-button" [disabled]="busy()" (click)="resend()">Resend OTP</button> }
      </div>
    </section>
  `,
  styles: `
    :host { display:block; }
    .otp-panel { margin-top:1.5rem; padding-top:1.35rem; border-top:1px solid var(--cdm-border); }
    .back-link { display:inline-flex; gap:.4rem; align-items:center; margin-bottom:1.25rem; padding:0; border:0; background:none; color:var(--cdm-royal-blue); font:inherit; font-size:.82rem; font-weight:700; cursor:pointer; }.back-link:disabled { opacity:.6; cursor:wait; }
    .eyebrow { margin:0 0 .35rem; color:var(--cdm-muted); font-size:.72rem; font-weight:800; letter-spacing:.12em; } h2 { margin:0; color:var(--cdm-navy); font-size:clamp(1.45rem,4vw,2rem); }.intro { color:var(--cdm-muted); line-height:1.7; }.intro strong { color:var(--cdm-navy); white-space:nowrap; }
    .otp-fields { display:flex; justify-content:center; gap:.6rem; margin:1.5rem 0 1rem; }.otp-fields input { width:48px; height:56px; border:1px solid var(--cdm-border); border-radius:10px; color:var(--cdm-navy); background:#fff; font:700 1.4rem/1 inherit; text-align:center; }.otp-fields input:focus-visible { border-color:var(--cdm-royal-blue); outline:3px solid #0755b833; outline-offset:2px; }.otp-fields input:disabled { background:var(--cdm-page); }
    .verify-button { width:100%; min-height:46px; border:1px solid var(--cdm-green); border-radius:9px; background:var(--cdm-green); color:#fff; font:inherit; font-weight:750; cursor:pointer; }.verify-button:disabled { cursor:wait; opacity:.6; }.error { color:#b42318; line-height:1.6; }.success { color:var(--cdm-green); line-height:1.6; }.resend-row { min-height:42px; display:flex; align-items:center; justify-content:center; color:var(--cdm-muted); font-size:.84rem; }.text-button { padding:0; border:0; background:none; color:var(--cdm-royal-blue); font:inherit; font-weight:750; text-decoration:underline; cursor:pointer; }.text-button:disabled { cursor:wait; opacity:.6; }
    @media (max-width:420px) { .otp-fields { gap:.35rem; }.otp-fields input { width:42px; height:52px; } }
  `,
})
export class AuthMobileOtpComponent implements OnInit, OnDestroy {
  readonly phone = input.required<string>();
  readonly verified = output<void>();
  readonly changeNumber = output<void>();
  private readonly auth = inject(AuthService);
  private readonly otpInputs = viewChildren<ElementRef<HTMLInputElement>>('otpInput');
  protected readonly digits = signal<string[]>(['', '', '', '', '', '']);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly verifying = signal(false);
  protected readonly resending = signal(false);
  protected readonly countdown = signal(30);
  protected readonly otp = signal('');
  protected readonly busy = signal(false);
  protected readonly displayPhone = () => formatPhoneForDisplay(this.phone());
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  constructor() { afterNextRender(() => this.focusFirst()); }

  ngOnInit(): void { this.startCountdown(); }

  ngOnDestroy(): void { this.stopCountdown(); }

  protected inputDigit(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(-1);
    this.setDigit(index, value);
    if (value && index < 5) this.focus(index + 1);
  }

  protected keyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      event.preventDefault(); this.setDigit(index - 1, ''); this.focus(index - 1);
    }
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); this.focus(index - 1); }
    if (event.key === 'ArrowRight' && index < 5) { event.preventDefault(); this.focus(index + 1); }
  }

  protected pasteCode(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) ?? '';
    const next = [...this.digits()];
    pasted.split('').forEach((digit, index) => next[index] = digit);
    while (next.length < 6) next.push('');
    this.digits.set(next.slice(0, 6)); this.updateOtp(next.slice(0, 6));
    this.focus(Math.min(pasted.length, 5));
  }

  protected async verify(): Promise<void> {
    const token = this.otp();
    if (token.length !== 6 || this.busy()) return;
    this.verifying.set(true); this.busy.set(true); this.errorMessage.set(null); this.successMessage.set(null);
    try { await this.auth.verifyPhoneOtp(this.phone(), token); this.verified.emit(); }
    catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'That verification code is not valid.'); }
    finally { this.verifying.set(false); this.busy.set(false); }
  }

  protected async resend(): Promise<void> {
    if (this.countdown() > 0 || this.busy()) return;
    this.resending.set(true); this.busy.set(true); this.errorMessage.set(null); this.successMessage.set(null);
    try { await this.auth.sendPhoneOtp(this.phone()); this.startCountdown(); this.successMessage.set('A new verification code has been sent.'); }
    catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to resend the code. Please try again later.'); }
    finally { this.resending.set(false); this.busy.set(false); }
  }

  private setDigit(index: number, value: string): void { const next = [...this.digits()]; next[index] = value; this.digits.set(next); this.updateOtp(next); }
  private updateOtp(digits: readonly string[]): void { this.otp.set(digits.join('')); }
  private focus(index: number): void { this.otpInputs()[index]?.nativeElement.focus(); this.otpInputs()[index]?.nativeElement.select(); }
  private focusFirst(): void { this.focus(0); }
  private startCountdown(): void { this.stopCountdown(); this.countdown.set(30); this.countdownTimer = setInterval(() => { const next = this.countdown() - 1; this.countdown.set(Math.max(next, 0)); if (next <= 0) this.stopCountdown(); }, 1000); }
  private stopCountdown(): void { if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; } }
}
