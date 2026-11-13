import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/services/language.service';
import { LodgeReview, LodgeReviewSort, LodgeReviewsService } from '../core/services/lodge-reviews.service';

@Component({
  selector: 'app-lodge-reviews',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="lodge-reviews" id="reviews" aria-labelledby="lodge-reviews-title" [attr.aria-busy]="loading() || saving()">
      <header class="reviews-header">
        <div>
          <p class="eyebrow">{{ ta() ? 'விருந்தினர் கருத்துகள்' : 'GUEST FEEDBACK' }}</p>
          <h2 id="lodge-reviews-title">{{ ta() ? 'மதிப்பீடுகள் மற்றும் விமர்சனங்கள்' : 'Ratings & reviews' }}</h2>
          @if (summary()?.review_count; as count) {
            <p class="rating-overview" aria-live="polite"><span class="rating-stars" aria-hidden="true">★</span><strong>{{ summary()?.average_rating | number:'1.1-1' }}</strong><span>{{ count }} {{ ta() ? 'மதிப்பீடுகள்' : (count === 1 ? 'review' : 'reviews') }}</span></p>
          } @else if (!summaryLoading() && !summaryError()) {
            <p class="rating-overview empty-rating">{{ ta() ? 'புதிய பட்டியல் – மதிப்பீடுகள் இல்லை' : 'New Listing – No Reviews Yet' }}</p>
          }
        </div>
        @if (auth.user()) {
          @if (activeMyReview()) {
            <button type="button" class="review-action" (click)="startReview()"><i class="bi bi-pencil" aria-hidden="true"></i>{{ ta() ? 'உங்கள் மதிப்பீட்டைத் திருத்து' : 'Edit your review' }}</button>
          } @else {
            <button type="button" class="review-action" (click)="startReview()"><i class="bi bi-star" aria-hidden="true"></i>{{ ta() ? 'மதிப்பீடு எழுதுங்கள்' : 'Write a review' }}</button>
          }
        } @else {
          <a class="review-action" routerLink="/auth/sign-in" [queryParams]="{ returnUrl: signInReturnUrl() }">{{ ta() ? 'மதிப்பீடு எழுத உள்நுழையவும்' : 'Sign in to review' }}</a>
        }
      </header>

      @if (summaryLoading()) { <div class="review-skeleton" role="status" [attr.aria-label]="ta() ? 'மதிப்பீடுகள் ஏற்றப்படுகின்றன' : 'Loading rating summary'"><span></span><span></span></div> }
      @if (summaryError()) { <p class="review-error" role="status">{{ ta() ? 'மதிப்பீடுகளை இப்போது ஏற்ற முடியவில்லை.' : 'Rating summary is temporarily unavailable.' }}</p> }
      @if (myReview()?.status === 'pending_review') { <p class="review-pending" role="status">{{ ta() ? 'உங்கள் மதிப்பீடு மதிப்பாய்வில் உள்ளது.' : 'Your review is awaiting moderation before it appears publicly.' }}</p> }
      @if (myReview()?.status === 'hidden') { <p class="review-pending" role="status">{{ ta() ? 'உங்கள் மதிப்பீடு மறைக்கப்பட்டுள்ளது.' : 'Your review is currently hidden by moderation.' }}</p> }

      @if (formOpen()) {
        <form class="review-form" [formGroup]="form" (ngSubmit)="submitReview()" novalidate>
          <h3>{{ activeMyReview() ? (ta() ? 'உங்கள் மதிப்பீட்டைத் திருத்து' : 'Edit your review') : (ta() ? 'தங்கிய அனுபவத்தைப் பகிருங்கள்' : 'Share your stay experience') }}</h3>
          <fieldset class="rating-fieldset">
            <legend>{{ ta() ? 'மதிப்பீடு' : 'Your rating' }} <span aria-hidden="true">*</span></legend>
            <div class="star-picker" role="radiogroup" [attr.aria-label]="ta() ? '1 முதல் 5 நட்சத்திரங்கள்' : 'Choose 1 to 5 stars'">
              @for (star of stars; track star) {
                <label [attr.aria-label]="star + (ta() ? ' நட்சத்திரங்கள்' : (star === 1 ? ' star' : ' stars'))">
                  <input type="radio" name="lodge-rating" [value]="star" [checked]="rating() === star" (change)="rating.set(star)" />
                  <span aria-hidden="true">{{ rating() >= star ? '★' : '☆' }}</span>
                </label>
              }
            </div>
          </fieldset>
          <label class="review-label">{{ ta() ? 'தலைப்பு (விருப்பம்)' : 'Title (optional)' }}<input type="text" formControlName="title" maxlength="120" /></label>
          <label class="review-label">{{ ta() ? 'உங்கள் விமர்சனம்' : 'Your review' }}<textarea formControlName="review_text" rows="4" maxlength="3000" [attr.aria-invalid]="form.controls.review_text.touched && form.controls.review_text.invalid ? 'true' : null"></textarea></label>
          @if (form.controls.review_text.touched && form.controls.review_text.invalid) { <p class="review-error" role="alert">{{ ta() ? 'குறைந்தது 10 எழுத்துகள் கொண்ட விமர்சனத்தை உள்ளிடவும்.' : 'Enter a review between 10 and 3000 characters.' }}</p> }
          @if (formError(); as message) { <p class="review-error" role="alert">{{ message }}</p> }
          <div class="review-form-actions"><button type="submit" class="review-action review-submit" [disabled]="saving() || rating() === 0 || form.invalid">{{ saving() ? (ta() ? 'சேமிக்கிறது…' : 'Submitting…') : (ta() ? 'மதிப்பீட்டைச் சமர்ப்பி' : 'Submit review') }}</button><button type="button" class="review-cancel" (click)="formOpen.set(false)">{{ ta() ? 'ரத்து செய்' : 'Cancel' }}</button></div>
          <small class="review-moderation-note">{{ ta() ? 'வெளியிடுவதற்கு முன் மதிப்பீடுகள் மதிப்பாய்வு செய்யப்படும்.' : 'Reviews are moderated before they are published.' }}</small>
        </form>
      }
      @if (formMessage(); as message) { <p class="review-pending" role="status">{{ message }}</p> }

      <div class="reviews-toolbar">
        <h3>{{ ta() ? 'விருந்தினர் விமர்சனங்கள்' : 'Guest reviews' }}</h3>
        <label>{{ ta() ? 'வரிசைப்படுத்து' : 'Sort' }}
          <select [value]="sort()" (change)="changeSort($event)">
            <option value="newest">{{ ta() ? 'புதியவை' : 'Newest' }}</option>
            <option value="highest">{{ ta() ? 'அதிக மதிப்பீடு' : 'Highest rated' }}</option>
            <option value="lowest">{{ ta() ? 'குறைந்த மதிப்பீடு' : 'Lowest rated' }}</option>
          </select>
        </label>
      </div>
      @if (loading()) { <div class="reviews-skeleton" role="status" [attr.aria-label]="ta() ? 'விமர்சனங்கள் ஏற்றப்படுகின்றன' : 'Loading reviews'">@for (item of [1,2,3]; track item) { <div><span></span><span></span></div> }</div> }
      @else if (loadError()) { <p class="review-error" role="alert">{{ ta() ? 'விமர்சனங்களை ஏற்ற முடியவில்லை.' : 'Unable to load reviews.' }} <button type="button" class="review-cancel" (click)="reload()">{{ ta() ? 'மீண்டும் முயற்சி' : 'Try again' }}</button></p> }
      @else if (reviews().length) {
        <div class="review-list">
          @for (review of reviews(); track review.id) {
            <article class="review-card">
              <header class="review-card-header"><div><span class="review-stars" [attr.aria-label]="review.rating + (ta() ? ' நட்சத்திர மதிப்பீடு' : (review.rating === 1 ? ' star' : ' stars'))">{{ starsLabel(review.rating) }}</span><time [dateTime]="review.created_at">{{ review.created_at | date:'mediumDate' }}</time></div>@if (auth.user()) { <button type="button" class="report-link" (click)="toggleReport(review.id)"><i class="bi bi-flag" aria-hidden="true"></i>{{ ta() ? 'அறிக்கை' : 'Report' }}</button> }</header>
              @if (review.title) { <h4>{{ review.title }}</h4> }
              <p class="review-body">{{ review.review_text }}</p>
              @if (ownerResponse(review); as response) { <div class="owner-response"><strong>{{ ta() ? 'விடுதியின் பதில்' : 'Lodge response' }}</strong><p>{{ response }}</p></div> }
              @if (ownsListing()) { <form class="owner-response-form" (submit)="saveResponse($event, review.id, ownerResponseInput.value)"><label [for]="'owner-response-' + review.id">{{ ta() ? 'விடுதி பதில்' : 'Lodge response' }}</label><textarea #ownerResponseInput [id]="'owner-response-' + review.id" rows="2" maxlength="2000" [value]="ownerResponse(review) ?? ''"></textarea><button type="submit" class="review-cancel">{{ ownerResponse(review) ? (ta() ? 'பதிலைப் புதுப்பி' : 'Update response') : (ta() ? 'பதில் அளி' : 'Reply as lodge owner') }}</button>@if (responseError()) { <p class="review-error" role="alert">{{ responseError() }}</p> }@if (responseMessage()) { <p class="review-pending" role="status">{{ responseMessage() }}</p> }</form> }
              @if (reportingReviewId() === review.id) {
                <form class="report-form" (submit)="submitReport($event, review.id)"><label>{{ ta() ? 'காரணம்' : 'Reason' }}<select [value]="reportReason()" (change)="setReportReason($event)"><option value="other">{{ ta() ? 'மற்றவை' : 'Other' }}</option><option value="spam">Spam</option><option value="abuse">{{ ta() ? 'தகாத உள்ளடக்கம்' : 'Abusive content' }}</option><option value="fake_or_misleading">{{ ta() ? 'தவறான தகவல்' : 'Fake or misleading' }}</option></select></label><textarea rows="2" maxlength="1000" [value]="reportDetails()" (input)="setReportDetails($event)" [placeholder]="ta() ? 'கூடுதல் விவரம் (விருப்பம்)' : 'Additional details (optional)'"></textarea><button type="submit" class="review-cancel" [disabled]="reportSending() || !!reportMessage()">{{ ta() ? 'அறிக்கை அனுப்பு' : 'Submit report' }}</button>@if(reportError()){<p class="review-error" role="alert">{{ reportError() }}</p>}@if(reportMessage()){<p class="review-pending" role="status">{{ reportMessage() }}</p>}</form>
              }
            </article>
          }
        </div>
        @if (totalPages() > 1) { <nav class="review-pagination" aria-label="Review pages"><button type="button" class="review-cancel" [disabled]="page() === 0" (click)="changePage(-1)">{{ ta() ? 'முந்தையது' : 'Previous' }}</button><span>{{ ta() ? 'பக்கம்' : 'Page' }} {{ page() + 1 }} / {{ totalPages() }}</span><button type="button" class="review-cancel" [disabled]="page() + 1 >= totalPages()" (click)="changePage(1)">{{ ta() ? 'அடுத்தது' : 'Next' }}</button></nav> }
      } @else { <p class="review-state" role="status">{{ ta() ? 'இன்னும் விருந்தினர் விமர்சனங்கள் இல்லை.' : 'No published reviews yet. Be the first to share a stay.' }}</p> }
    </section>
  `,
  styles: `
    :host { display:block; min-width:0; }
    .lodge-reviews { display:grid; gap:1rem; margin-top:1.5rem; padding:clamp(1rem,3vw,1.5rem); border:1px solid var(--cdm-border); border-radius:16px; background:#fff; }
    .reviews-header,.reviews-toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
    .eyebrow { margin:0 0 .3rem; color:#92702a; font-size:.68rem; font-weight:850; letter-spacing:.12em; }
    h2,h3,h4 { margin:0; color:var(--cdm-navy); }
    .reviews-header h2 { font-size:clamp(1.2rem,2.4vw,1.6rem); }
    .rating-overview { display:flex; align-items:center; gap:.4rem; margin:.35rem 0 0; color:#52657b; font-size:.82rem; }
    .rating-stars,.review-stars { color:#a87509; letter-spacing:.08em; }
    .empty-rating { display:block; }
    .review-action,.review-cancel { display:inline-flex; align-items:center; justify-content:center; gap:.4rem; min-height:42px; padding:.55rem .8rem; border:1px solid #cbd6df; border-radius:9px; color:#123654; background:#fff; font:inherit; font-size:.82rem; font-weight:750; text-decoration:none; cursor:pointer; }
    .review-action { border-color:#087f69; color:#fff; background:#087f69; }
    .review-action:hover:not(:disabled) { background:#066653; }
    .review-action:disabled,.review-cancel:disabled { cursor:not-allowed; opacity:.55; }
    .review-form { display:grid; gap:.7rem; padding:1rem; border:1px solid #dbe3e9; border-radius:12px; background:#f8fafb; }
    .review-form h3 { font-size:1rem; }
    .rating-fieldset { min-width:0; margin:0; padding:0; border:0; }
    .rating-fieldset legend { float:none; width:auto; margin-bottom:.4rem; color:var(--cdm-navy); font-size:.83rem; font-weight:750; }
    .star-picker { display:flex; gap:.25rem; }
    .star-picker label { position:relative; display:grid; place-items:center; width:44px; height:44px; margin:0; border:1px solid #d6dee5; border-radius:8px; background:#fff; cursor:pointer; }
    .star-picker input { position:absolute; width:1px; height:1px; opacity:0; }
    .star-picker span[aria-hidden] { color:#9ba6b1; font-size:1.45rem; line-height:1; }
    .star-picker input:checked + span[aria-hidden],.star-picker label:has(input:checked) span[aria-hidden] { color:#a87509; }
    .star-picker label:focus-within { outline:3px solid #0b806d70; outline-offset:2px; }
    .review-label,.report-form label { display:grid; gap:.35rem; color:var(--cdm-navy); font-size:.82rem; font-weight:700; }
    .review-label input,.review-label textarea,.report-form textarea,.report-form select,.owner-response-form textarea { width:100%; min-width:0; box-sizing:border-box; min-height:42px; padding:.6rem .7rem; border:1px solid #bfccd8; border-radius:8px; color:#18324e; background:#fff; font:inherit; font-size:.88rem; }
    .review-label textarea,.report-form textarea,.owner-response-form textarea { resize:vertical; }
    .review-form-actions,.review-pagination { display:flex; align-items:center; flex-wrap:wrap; gap:.55rem; }
    .review-submit { border-color:#087f69; }
    .review-moderation-note,.review-card time { color:#6a788a; font-size:.75rem; }
    .review-state,.review-pending,.review-error { margin:0; padding:.8rem; border-radius:9px; color:#52657b; background:#f4f7f8; font-size:.84rem; line-height:1.55; }
    .review-skeleton,.reviews-skeleton { display:grid; gap:.55rem; }.review-skeleton { grid-template-columns:110px 1fr; }.review-skeleton span,.reviews-skeleton span { display:block; height:14px; border-radius:999px; background:linear-gradient(90deg,#edf0f2 25%,#f8f9fa 45%,#edf0f2 65%); background-size:220% 100%; animation:review-shimmer 1.2s ease-in-out infinite; }.reviews-skeleton>div { display:grid; gap:.5rem; padding:.85rem; border:1px solid #e0e6eb; border-radius:10px; }.reviews-skeleton>div span:first-child { width:35%; }.reviews-skeleton>div span:last-child { width:80%; }
    @keyframes review-shimmer { to { background-position-x:-220%; } }
    .review-pending { color:#765500; background:#fff8e6; }
    .review-error { color:#8b1e1e; background:#fff1ef; }
    .reviews-toolbar h3 { font-size:1rem; }
    .reviews-toolbar label { display:flex; align-items:center; gap:.45rem; color:#52657b; font-size:.78rem; }
    .reviews-toolbar select,.report-form select { min-height:40px; }
    .review-list { display:grid; gap:.65rem; }
    .review-card { display:grid; gap:.45rem; padding:.9rem; border:1px solid #e0e6eb; border-radius:11px; background:#fff; }
    .review-card-header { display:flex; align-items:center; justify-content:space-between; gap:.8rem; }
    .review-card-header>div { display:flex; align-items:center; flex-wrap:wrap; gap:.6rem; }
    .review-stars { font-size:.98rem; }
    .review-card h4 { font-size:.9rem; }
    .review-body,.owner-response p { margin:0; color:#52657b; font-size:.84rem; line-height:1.65; white-space:pre-line; }
    .report-link { min-height:38px; padding:.35rem .5rem; border:0; color:#52657b; background:transparent; font:inherit; font-size:.75rem; cursor:pointer; }
    .owner-response { display:grid; gap:.25rem; padding:.7rem; border-left:3px solid #0b806d; border-radius:0 8px 8px 0; background:#f0f8f6; }
    .owner-response strong { color:#12634f; font-size:.78rem; }
    .owner-response-form,.report-form { display:grid; gap:.45rem; padding-top:.55rem; border-top:1px solid #e3e8ed; }
    .review-pagination { justify-content:center; color:#52657b; font-size:.8rem; }
    :is(button,a,select,input,textarea):focus-visible { outline:3px solid #0b806d70; outline-offset:2px; }
    @media(prefers-reduced-motion:reduce) { .review-skeleton span,.reviews-skeleton span { animation:none; } }
    @media(max-width:600px) { .reviews-header { align-items:flex-start; flex-direction:column; }.review-action { width:100%; }.reviews-toolbar { align-items:flex-start; flex-direction:column; }.reviews-toolbar label { width:100%; justify-content:space-between; }.reviews-toolbar select { flex:1; }.review-form-actions>* { flex:1; } }
  `,
})
export class LodgeReviewsComponent {
  readonly listingId = input.required<string>();
  readonly signInReturnUrl = input('/account');
  readonly startWriting = input(false);

  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly reviewsService = inject(LodgeReviewsService);
  protected readonly stars = [1, 2, 3, 4, 5] as const;
  protected readonly form = this.fb.group({ title: ['', Validators.maxLength(120)], review_text: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(3000)]] });
  protected readonly rating = signal(0);
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly loading = signal(true);
  protected readonly summaryLoading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly summaryError = signal(false);
  protected readonly summary = signal<{ average_rating: number; review_count: number } | null>(null);
  protected readonly reviews = signal<readonly LodgeReview[]>([]);
  protected readonly myReview = signal<LodgeReview | null>(null);
  protected readonly ownsListing = signal(false);
  protected readonly sort = signal<LodgeReviewSort>('newest');
  protected readonly page = signal(0);
  protected readonly total = signal(0);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / 5)));
  protected readonly activeMyReview = computed(() => {
    const review = this.myReview();
    return review && review.status !== 'hidden' ? review : null;
  });
  protected readonly formError = signal<string | null>(null);
  protected readonly formMessage = signal<string | null>(null);
  protected readonly reportingReviewId = signal<string | null>(null);
  protected readonly reportReason = signal('other');
  protected readonly reportDetails = signal('');
  protected readonly reportSending = signal(false);
  protected readonly reportError = signal<string | null>(null);
  protected readonly reportMessage = signal<string | null>(null);
  protected readonly responseError = signal<string | null>(null);
  protected readonly responseMessage = signal<string | null>(null);
  private readonly reloadCount = signal(0);
  protected readonly ta = computed(() => this.i18n.language() === 'ta');

  constructor() {
    effect(onCleanup => {
      const id = this.listingId();
      this.reloadCount();
      let active = true;
      this.loadError.set(false);
      this.summaryError.set(false);
      this.loading.set(true);
      this.summaryLoading.set(true);
      void Promise.all([
        this.reviewsService.summary(id),
        this.reviewsService.reviews(id, this.sort(), this.page()),
        this.auth.user() ? this.reviewsService.myReview(id) : Promise.resolve(null),
        this.auth.user() ? this.reviewsService.ownsListing(id).catch(() => false) : Promise.resolve(false),
      ]).then(([summary, page, myReview, ownsListing]) => {
        if (!active) return;
        this.summary.set(summary);
        this.reviews.set(page.reviews);
        this.total.set(page.total);
        this.myReview.set(myReview);
        this.ownsListing.set(ownsListing);
      }).catch(() => {
        if (!active) return;
        this.loadError.set(true);
        this.summaryError.set(true);
      }).finally(() => {
        if (active) { this.loading.set(false); this.summaryLoading.set(false); }
      });
      onCleanup(() => { active = false; });
    });
    effect(() => {
      if (this.startWriting() && this.auth.user()) this.startReview();
    });
  }

  protected startReview(): void {
    const existing = this.activeMyReview();
    this.form.reset({ title: existing?.title ?? '', review_text: existing?.review_text ?? '' });
    this.rating.set(existing?.rating ?? 0);
    this.formError.set(null);
    this.formMessage.set(null);
    this.formOpen.set(true);
  }

  protected async submitReview(): Promise<void> {
    this.form.markAllAsTouched();
    if (!this.auth.user() || this.form.invalid || this.rating() === 0 || this.saving()) return;
    this.saving.set(true); this.formError.set(null); this.formMessage.set(null);
    try {
      const result = await this.reviewsService.saveReview(this.listingId(), this.rating(), this.form.controls.title.value, this.form.controls.review_text.value, this.activeMyReview()?.id ?? null);
      this.myReview.set(result); this.formOpen.set(false);
      this.formMessage.set(result.status === 'published' ? (this.ta() ? 'மதிப்பீடு புதுப்பிக்கப்பட்டது.' : 'Your review was saved.') : (this.ta() ? 'உங்கள் மதிப்பீடு வெளியிடுவதற்கு முன் மதிப்பாய்வு செய்யப்படும்.' : 'Your review is awaiting moderation before publication.'));
      this.reloadCount.update(count => count + 1);
    } catch (error) {
      this.formError.set(error instanceof Error ? error.message : 'Unable to save your review.');
    } finally { this.saving.set(false); }
  }

  protected changeSort(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (!['newest', 'highest', 'lowest'].includes(value)) return;
    this.sort.set(value as LodgeReviewSort); this.page.set(0); this.reloadCount.update(count => count + 1);
  }
  protected changePage(delta: number): void { this.page.update(value => Math.max(0, Math.min(this.totalPages() - 1, value + delta))); this.reloadCount.update(count => count + 1); }
  protected starsLabel(rating: number): string { return '★'.repeat(rating) + '☆'.repeat(5 - rating); }
  protected ownerResponse(review: LodgeReview): string | null {
    const response = review.lodge_review_owner_responses;
    if (!response) return null;
    if (Array.isArray(response)) return response[0]?.response_text ?? null;
    return (response as { response_text: string; updated_at: string }).response_text;
  }
  protected toggleReport(reviewId: string): void {
    this.reportingReviewId.set(this.reportingReviewId() === reviewId ? null : reviewId);
    this.reportError.set(null);
    this.reportMessage.set(null);
  }
  protected setReportReason(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (['spam', 'abuse', 'fake_or_misleading', 'other'].includes(value)) this.reportReason.set(value);
  }
  protected setReportDetails(event: Event): void { this.reportDetails.set((event.target as HTMLTextAreaElement).value); }
  protected async submitReport(event: Event, reviewId: string): Promise<void> {
    event.preventDefault(); this.reportSending.set(true); this.reportError.set(null); this.reportMessage.set(null);
    try {
      await this.reviewsService.report(reviewId, this.reportReason(), this.reportDetails());
      this.reportDetails.set('');
      this.reportMessage.set(this.ta() ? 'அறிக்கை அனுப்பப்பட்டது.' : 'Report sent to the moderation team.');
    } catch (error) { this.reportError.set(error instanceof Error ? error.message : 'Unable to send this report.'); }
    finally { this.reportSending.set(false); }
  }
  protected async saveResponse(event: Event, reviewId: string, text: string): Promise<void> {
    event.preventDefault(); this.responseError.set(null); this.responseMessage.set(null);
    try { await this.reviewsService.respond(reviewId, text); this.responseMessage.set(this.ta() ? 'விடுதி பதில் சேமிக்கப்பட்டது.' : 'Lodge response saved.'); this.reloadCount.update(count => count + 1); }
    catch (error) { this.responseError.set(error instanceof Error ? error.message : 'Unable to save the response.'); }
  }
  protected reload(): void { this.reloadCount.update(count => count + 1); }
}
