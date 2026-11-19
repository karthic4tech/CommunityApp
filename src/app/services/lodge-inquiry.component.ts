import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LodgingQuestionType } from '../core/models/lodging-inquiry';
import { ServiceListing } from '../core/models/service-listing';
import { LodgingInquiryService } from '../core/services/lodging-inquiry.service';
import { LanguageService } from '../core/services/language.service';

const QUESTION_TYPES: readonly { value: LodgingQuestionType; english: string; tamil: string }[] = [
  { value: 'availability', english: 'Are rooms available for my dates?', tamil: 'எனது தேதிகளில் அறைகள் கிடைக்குமா?' },
  { value: 'assisted_booking', english: 'I’d like help booking a room', tamil: 'அறை முன்பதிவு செய்ய உதவி தேவை' },
  { value: 'booking_instructions', english: 'How can I book a room or stay?', tamil: 'அறை அல்லது தங்குமிடத்தை எப்படிப் பதிவு செய்வது?' },
  { value: 'other', english: 'I have another question', tamil: 'எனக்கு வேறு கேள்வி உள்ளது' },
];

@Component({
  selector: 'app-lodge-inquiry',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="enquiry-card" aria-labelledby="enquiry-title">
      <div><p class="eyebrow">PERSONAL BOOKING HELP</p><h2 id="enquiry-title">Planning a stay?</h2><p>Ask about availability or get help booking directly with {{ listing().service_providers.display_name }}.</p></div>
      <button type="button" class="enquiry-open" (click)="open()"><i class="bi bi-chat-square-text" aria-hidden="true"></i> Ask about this stay</button>
    </section>
    <dialog #inquiryDialog class="inquiry-dialog" aria-labelledby="inquiry-dialog-title" aria-describedby="inquiry-dialog-description" (close)="onClosed()">
      @if (submitted()) {
        <section class="confirmation" role="status"><span class="success-icon bi bi-check-circle" aria-hidden="true"></span><h2 id="inquiry-dialog-title">Enquiry sent</h2><p>Your question has been sent to {{ listing().service_providers.display_name }}. This is an enquiry, not a confirmed booking. The property will contact you directly.</p><button type="button" class="primary-action" (click)="close()">Done</button></section>
      } @else {
        <header class="dialog-heading"><div><p class="eyebrow">{{ listing().title }}</p><h2 id="inquiry-dialog-title">How can we help with your stay?</h2><p id="inquiry-dialog-description">Choose a question and share your contact details. No payment or reservation is made here.</p></div><button type="button" class="icon-close" aria-label="Close enquiry form" (click)="close()"><i class="bi bi-x-lg" aria-hidden="true"></i></button></header>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <fieldset class="question-fieldset"><legend>What would you like to know?</legend><div class="question-options" role="group" aria-label="Choose an enquiry topic">
            @for (question of questions; track question.value) { <button type="button" class="question-option" [class.selected]="questionType() === question.value" [attr.aria-pressed]="questionType() === question.value" (click)="selectQuestion(question.value)"><span class="radio-mark" aria-hidden="true"></span><span>{{ i18n.language() === 'ta' ? question.tamil : question.english }}</span></button> }
          </div></fieldset>
          @if (questionType() === 'availability') { <div class="date-grid"><label>Check-in<input type="date" formControlName="check_in" (change)="onCheckInChanged()" required /></label><label>Check-out<input type="date" formControlName="check_out" [min]="minimumCheckOutDate()" (change)="onCheckOutChanged()" required /></label><label class="guest-count">Guests<input type="number" min="1" max="20" formControlName="guest_count" inputmode="numeric" /></label></div> }
          <div class="form-grid"><label>Full name<input type="text" formControlName="guest_name" autocomplete="name" placeholder="Your name" /></label><label>Mobile number<input type="tel" formControlName="guest_phone" autocomplete="tel" inputmode="tel" maxlength="24" placeholder="+91 98765 43210" required /></label><label class="full-width">Email <span>(optional)</span><input type="email" formControlName="guest_email" autocomplete="email" maxlength="254" placeholder="you@example.com" /></label></div>
          <label class="message-field">{{ questionType() === 'other' ? 'Your question' : 'Anything else the property should know? (optional)' }}<textarea formControlName="message" rows="3" maxlength="3000" [required]="questionType() === 'other'" placeholder="Add dates, room preferences or a short message"></textarea></label>
          @if (errorMessage(); as message) { <p class="error-message" role="alert">{{ message }}</p> }
          <footer class="dialog-actions"><p>We’ll share your details only with this property to respond to your enquiry.</p><button type="submit" class="primary-action" [disabled]="sending()">{{ sending() ? 'Sending…' : 'Send enquiry' }}</button></footer>
        </form>
      }
    </dialog>
  `,
  styles: `
    :host { display:block; margin-top:1.25rem; }
    .enquiry-card { display:flex; align-items:center; justify-content:space-between; gap:1.25rem; padding:1.25rem; border:1px solid #cbe4df; border-radius:14px; background:linear-gradient(110deg,#f0faf7,#f7fbff); }
    .eyebrow { margin:0 0 .3rem; color:#087f69; font-size:.7rem; font-weight:800; letter-spacing:.1em; }
    .enquiry-card h2,.dialog-heading h2,.confirmation h2 { margin:0; color:#002050; font-size:1.25rem; }
    .enquiry-card p:not(.eyebrow),.dialog-heading p:not(.eyebrow),.confirmation p { margin:.35rem 0 0; color:#52657b; line-height:1.55; }
    .enquiry-open,.primary-action { display:inline-flex; align-items:center; justify-content:center; gap:.5rem; min-height:46px; padding:.65rem 1rem; border:1px solid #087f69; border-radius:9px; color:#fff; background:#087f69; font:inherit; font-weight:750; cursor:pointer; }
    .inquiry-dialog { width:min(94vw,680px); max-width:680px; max-height:min(92dvh,850px); overflow:auto; padding:clamp(1rem,3.5vw,1.5rem); border:1px solid #d7e2ed; border-radius:18px; color:#002050; background:#fff; box-shadow:0 24px 70px rgb(0 32 80 / .25); }
    .inquiry-dialog::backdrop { background:rgb(0 24 52 / .56); backdrop-filter:blur(3px); }
    .dialog-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:.8rem; margin-bottom:1rem; }
    .dialog-heading h2 { font-size:clamp(1.25rem,4vw,1.6rem); }
    .icon-close { flex:none; display:grid; place-items:center; width:42px; height:42px; border:1px solid #d7e2ed; border-radius:50%; color:#344c66; background:#fff; cursor:pointer; }
    form { display:grid; gap:1rem; }.question-fieldset { min-width:0; margin:0; padding:0; border:0; }.question-fieldset legend { margin-bottom:.55rem; color:#152f4b; font-size:.9rem; font-weight:750; }
    .question-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.55rem; }.question-option { display:flex; align-items:flex-start; gap:.55rem; min-width:0; min-height:54px; padding:.7rem; border:1px solid #d7e2ed; border-radius:10px; color:#263d57; background:#fff; font:inherit; font-size:.86rem; line-height:1.45; text-align:left; cursor:pointer; }.question-option.selected { border-color:#087f69; color:#075947; background:#effaf6; box-shadow:0 0 0 1px #087f6933; }.radio-mark { flex:none; width:17px; height:17px; margin-top:.08rem; border:1px solid #8ca0b4; border-radius:50%; background:#fff; }.question-option.selected .radio-mark { border:5px solid #087f69; }
    .date-grid,.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.75rem; }.form-grid label,.date-grid label,.message-field { display:grid; gap:.35rem; min-width:0; color:#263d57; font-size:.82rem; font-weight:700; }.form-grid label span { color:#657990; font-weight:500; }.form-grid .full-width { grid-column:1/-1; }.date-grid .guest-count { grid-column:1/-1; max-width:calc(50% - .4rem); }
    input,textarea { box-sizing:border-box; width:100%; min-height:44px; padding:.65rem .75rem; border:1px solid #c8d4df; border-radius:8px; color:#172b43; background:#fff; font:inherit; font-size:.9rem; }.message-field textarea { min-height:82px; resize:vertical; }.question-option:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible { outline:3px solid rgb(7 85 184 / .25); outline-offset:2px; border-color:#0755b8; }
    .dialog-actions { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:1rem; padding-top:.25rem; }.dialog-actions p { margin:0; color:#64778c; font-size:.78rem; line-height:1.45; }.primary-action:disabled { cursor:wait; opacity:.65; }.error-message { margin:0; padding:.65rem .75rem; border-radius:8px; color:#922b21; background:#fff1ef; font-size:.86rem; }
    .confirmation { display:grid; justify-items:start; gap:.7rem; padding:.5rem; }.success-icon { color:#087f69; font-size:2rem; }.confirmation .primary-action { justify-self:end; min-width:100px; }
    @media(max-width:560px) { .enquiry-card { align-items:stretch; flex-direction:column; gap:.8rem; }.enquiry-open { width:100%; }.question-options,.date-grid,.form-grid { grid-template-columns:1fr; }.form-grid .full-width,.date-grid .guest-count { grid-column:auto; max-width:none; }.dialog-actions { grid-template-columns:1fr; }.dialog-actions .primary-action { width:100%; }.inquiry-dialog { width:calc(100vw - 1rem); padding:1rem; } }
    :is(button,input,textarea):focus-visible { outline-offset:2px; }
  `,
})
export class LodgeInquiryComponent {
  readonly listing = input.required<ServiceListing>();
  protected readonly i18n = inject(LanguageService);
  private readonly inquiries = inject(LodgingInquiryService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('inquiryDialog');
  protected readonly questions = QUESTION_TYPES;
  protected readonly questionType = signal<LodgingQuestionType>('availability');
  protected readonly minimumCheckOutDate = signal('');
  protected readonly sending = signal(false);
  protected readonly submitted = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form = this.fb.group({
    guest_name: this.fb.control(''),
    guest_phone: this.fb.control('', [Validators.required, Validators.pattern(/^[+0-9][0-9\s().-]{6,23}$/)]),
    guest_email: this.fb.control('', [Validators.email, Validators.maxLength(254)]),
    check_in: this.fb.control(''), check_out: this.fb.control(''), guest_count: this.fb.control('2'),
    message: this.fb.control('', Validators.maxLength(3000)),
  });

  protected open(): void { this.errorMessage.set(null); this.dialog()?.nativeElement.showModal(); }
  protected close(): void { this.dialog()?.nativeElement.close(); }
  protected onClosed(): void { if (this.submitted()) { this.submitted.set(false); this.form.reset({ guest_name: '', guest_phone: '', guest_email: '', check_in: '', check_out: '', guest_count: '2', message: '' }); this.minimumCheckOutDate.set(''); } }
  protected selectQuestion(type: LodgingQuestionType): void { this.questionType.set(type); this.errorMessage.set(null); }
  protected onCheckInChanged(): void {
    const checkIn = this.form.controls.check_in.value;
    if (!checkIn) { this.minimumCheckOutDate.set(''); return; }
    const minimum = checkIn;
    this.minimumCheckOutDate.set(minimum);
    if (this.form.controls.check_out.value && this.form.controls.check_out.value < minimum) {
      this.form.controls.check_out.setValue('');
    }
  }
  protected onCheckOutChanged(): void {
    if (this.form.controls.check_out.value && !this.form.controls.check_in.value) {
      this.form.controls.check_out.setValue('');
      this.errorMessage.set('Choose a check-in date before selecting a check-out date.');
      return;
    }
    this.errorMessage.set(null);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.sending()) { this.errorMessage.set('Enter a valid mobile number and a valid email if provided.'); return; }
    const value = this.form.getRawValue();
    if (this.questionType() === 'availability') {
      if (!value.check_in || !value.check_out || value.check_out < value.check_in) { this.errorMessage.set('Choose valid check-in and check-out dates. Check-out cannot be before check-in.'); return; }
      const guests = Number(value.guest_count);
      if (!Number.isInteger(guests) || guests < 1 || guests > 20) { this.errorMessage.set('Enter a guest count between 1 and 20.'); return; }
    }
    if (this.questionType() === 'other' && !value.message.trim()) { this.errorMessage.set('Please add your question.'); return; }
    this.sending.set(true); this.errorMessage.set(null);
    try {
      const availability = this.questionType() === 'availability';
      await this.inquiries.submit({
        listing_id: this.listing().id,
        guest_name: value.guest_name,
        guest_phone: value.guest_phone,
        guest_email: value.guest_email || null,
        question_type: this.questionType(),
        check_in: availability ? value.check_in : null,
        check_out: availability ? value.check_out : null,
        guest_count: availability ? Number(value.guest_count) : null,
        message: value.message || null,
      });
      this.submitted.set(true);
    } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to send your enquiry. Please try again.'); }
    finally { this.sending.set(false); }
  }
}
