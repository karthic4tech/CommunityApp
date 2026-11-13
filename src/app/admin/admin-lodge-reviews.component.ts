import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LodgeReviewAdminRow, LodgeReviewReportRow, LodgeReviewsService } from '../core/services/lodge-reviews.service';

@Component({
  selector: 'app-admin-lodge-reviews',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="lodge-review-admin" aria-labelledby="admin-lodge-reviews-title" [attr.aria-busy]="loading() || savingId() !== null">
      <header class="admin-header"><div><a routerLink="/admin" class="back-link"><i class="bi bi-arrow-left" aria-hidden="true"></i> Admin dashboard</a><p class="eyebrow">TOURISM · MODERATION</p><h1 id="admin-lodge-reviews-title">Lodge reviews</h1><p>Review guest feedback and reported content. Negative ratings are not grounds to hide a review.</p></div><button type="button" class="refresh-button" (click)="load()" [disabled]="loading()">Refresh</button></header>
      @if (loading()) { <p class="state" role="status">Loading lodge reviews…</p> }
      @else if (error(); as message) { <div class="state is-error"><p role="alert">{{ message }}</p><button type="button" class="refresh-button" (click)="load()">Try again</button></div> }
      @else {
        @if (notice(); as message) { <p class="notice" role="status">{{ message }}</p> }
        <nav class="admin-tabs" aria-label="Lodge review moderation"><button type="button" [class.active]="tab() === 'pending'" (click)="tab.set('pending')">Pending <span>{{ pending().length }}</span></button><button type="button" [class.active]="tab() === 'reported'" (click)="tab.set('reported')">Reported <span>{{ reports().length }}</span></button></nav>
        @if (tab() === 'pending') {
          @if (!pending().length) { <p class="state">No lodge reviews are awaiting moderation.</p> }
          <div class="moderation-list">@for (review of pending(); track review.id) {
            <article class="moderation-card"><div class="review-head"><div><p class="provider">{{ review.service_listings.service_providers.display_name }} · {{ review.service_listings.title }}</p><span class="stars" [attr.aria-label]="review.rating + ' stars'">{{ stars(review.rating) }}</span><time>{{ review.created_at | date:'mediumDate' }}</time></div><span class="pending-badge">Pending review</span></div>@if (review.title) { <h2>{{ review.title }}</h2> }<p class="review-text">{{ review.review_text }}</p><label class="moderation-note">Moderation note (required when hiding)<textarea #note rows="2" maxlength="1000"></textarea></label><div class="actions"><button type="button" class="approve" [disabled]="savingId() === review.id" (click)="moderate(review.id,'approve',note.value)">Approve &amp; publish</button><button type="button" class="hide" [disabled]="savingId() === review.id || !note.value.trim()" (click)="moderate(review.id,'hide',note.value)">Hide review</button></div></article>
          }</div>
        } @else {
          @if (!reports().length) { <p class="state">No open lodge review reports.</p> }
          <div class="moderation-list">@for (report of reports(); track report.id) { @let review = report.lodge_reviews;
            <article class="moderation-card"><div class="review-head"><div><p class="provider">{{ review.service_listings.service_providers.display_name }} · {{ review.service_listings.title }}</p><span class="stars" [attr.aria-label]="review.rating + ' stars'">{{ stars(review.rating) }}</span><time>{{ review.created_at | date:'mediumDate' }}</time></div><span class="reported-badge">Reported · {{ report.reason.replace('_',' ') }}</span></div>@if (review.title) { <h2>{{ review.title }}</h2> }<p class="review-text">{{ review.review_text }}</p>@if (report.details) { <p class="report-details"><strong>Report details:</strong> {{ report.details }}</p> }<label class="moderation-note">Decision note (required when hiding)<textarea #note rows="2" maxlength="1000"></textarea></label><div class="actions"><button type="button" class="approve" [disabled]="savingId() === review.id" (click)="moderate(review.id,'approve',note.value,report.id)">Keep &amp; publish</button><button type="button" class="hide" [disabled]="savingId() === review.id || !note.value.trim()" (click)="moderate(review.id,'hide',note.value,report.id)">Hide review</button><button type="button" class="dismiss" [disabled]="savingId() === review.id" (click)="moderate(review.id,'dismiss',note.value,report.id)">Dismiss report</button></div></article>
          }</div>
        }
      }
    </main>
  `,
  styles: `
    :host { display:block; width:min(var(--cdm-content-width),calc(100% - 2 * var(--cdm-page-gutter))); margin:0 auto; padding-block:1.5rem 3rem; color:var(--cdm-navy); }
    .admin-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1rem; padding:clamp(1rem,3vw,1.5rem); border:1px solid var(--cdm-border); border-radius:16px; background:#fff; }
    .back-link { display:inline-flex; align-items:center; gap:.4rem; min-height:40px; color:var(--cdm-royal-blue); text-decoration:none; font-size:.82rem; font-weight:700; }
    .eyebrow { margin:.6rem 0 .25rem; color:var(--cdm-muted); font-size:.68rem; font-weight:850; letter-spacing:.12em; }
    h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.6rem,4vw,2.3rem); }
    .admin-header p:last-child { margin:.45rem 0 0; color:var(--cdm-muted); font-size:.85rem; line-height:1.6; }
    .refresh-button,.actions button { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:.55rem .8rem; border:1px solid var(--cdm-border); border-radius:8px; color:var(--cdm-navy); background:#fff; font:inherit; font-size:.82rem; font-weight:750; cursor:pointer; }
    .admin-tabs { display:flex; gap:.4rem; margin:1rem 0; padding:.3rem; border:1px solid var(--cdm-border); border-radius:11px; background:#f7f9fb; }
    .admin-tabs button { display:flex; align-items:center; gap:.5rem; min-height:42px; padding:.55rem .75rem; border:0; border-radius:8px; color:#52657b; background:transparent; font:inherit; font-size:.82rem; font-weight:750; cursor:pointer; }
    .admin-tabs button.active { color:#0755a2; background:#fff; box-shadow:0 1px 5px #00205018; }
    .admin-tabs span { display:inline-grid; place-items:center; min-width:1.35rem; height:1.35rem; padding-inline:.2rem; border-radius:999px; background:#eaf2fd; color:#0755a2; font-size:.72rem; }
    .moderation-list { display:grid; gap:.75rem; }
    .moderation-card { display:grid; gap:.65rem; padding:1rem; border:1px solid var(--cdm-border); border-radius:13px; background:#fff; }
    .review-head { display:flex; align-items:flex-start; justify-content:space-between; gap:.75rem; }
    .provider { margin:0 0 .25rem; color:#52657b; font-size:.8rem; font-weight:700; }
    .stars { color:#a87509; letter-spacing:.08em; }
    time { margin-left:.55rem; color:#6a788a; font-size:.75rem; }
    .pending-badge,.reported-badge { display:inline-flex; padding:.3rem .55rem; border-radius:999px; color:#715300; background:#fff6dc; font-size:.7rem; font-weight:750; text-transform:capitalize; }
    .reported-badge { color:#8a3528; background:#fff0ed; }
    .moderation-card h2 { margin:0; color:var(--cdm-navy); font-size:1rem; }
    .review-text,.report-details { margin:0; color:#40566c; font-size:.86rem; line-height:1.65; white-space:pre-line; }
    .moderation-note { display:grid; gap:.3rem; color:#52657b; font-size:.76rem; font-weight:700; }
    .moderation-note textarea { width:100%; min-height:60px; padding:.6rem; border:1px solid var(--cdm-border); border-radius:8px; font:inherit; resize:vertical; }
    .actions { display:flex; flex-wrap:wrap; gap:.5rem; }
    .actions .approve { border-color:#087f69; color:#fff; background:#087f69; }
    .actions .hide { border-color:#a84438; color:#fff; background:#a84438; }
    .actions .dismiss { color:#52657b; }
    .actions button:disabled,.refresh-button:disabled { cursor:not-allowed; opacity:.55; }
    .state,.notice { margin:.8rem 0; padding:1rem; border:1px solid var(--cdm-border); border-radius:10px; color:#52657b; background:#fff; }
    .state.is-error { border-color:#e2a8a0; color:#8a3528; }
    .notice { border-color:#b9ddcf; color:#155b49; background:#f0faf6; }
    :is(button,textarea,a):focus-visible { outline:3px solid #0b806d70; outline-offset:2px; }
    @media(max-width:560px) { .admin-header { flex-direction:column; }.refresh-button { align-self:stretch; }.admin-tabs button { flex:1; justify-content:center; }.review-head { flex-direction:column; }.actions button { flex:1; } }
  `,
})
export class AdminLodgeReviewsComponent implements OnInit {
  private readonly service = inject(LodgeReviewsService);
  protected readonly loading = signal(true);
  protected readonly savingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly tab = signal<'pending' | 'reported'>('pending');
  protected readonly pending = signal<LodgeReviewAdminRow[]>([]);
  protected readonly reports = signal<LodgeReviewReportRow[]>([]);

  ngOnInit(): void { void this.load(); }
  protected stars(rating: number): string { return '★'.repeat(rating) + '☆'.repeat(5 - rating); }
  protected async load(): Promise<void> {
    this.loading.set(true); this.error.set(null);
    try {
      const [pending, reports] = await Promise.all([this.service.pendingReviews(), this.service.openReports()]);
      this.pending.set(pending); this.reports.set(reports);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load lodge reviews.');
    } finally { this.loading.set(false); }
  }
  protected async moderate(reviewId: string, decision: 'approve' | 'hide' | 'dismiss', notes: string, reportId: string | null = null): Promise<void> {
    this.savingId.set(reviewId); this.error.set(null); this.notice.set(null);
    try {
      await this.service.moderate(reviewId, decision, notes, reportId);
      this.notice.set(decision === 'approve' ? 'Review approved and published.' : decision === 'hide' ? 'Review hidden; moderation note recorded.' : 'Report dismissed. Review remains unchanged.');
      await this.load();
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to moderate this review.'); }
    finally { this.savingId.set(null); }
  }
}
