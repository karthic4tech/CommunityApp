import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { SubmissionRow, SubmissionStatus } from '../core/models/service-submission';
import { ServiceSubmissionService } from '../core/services/service-submission.service';
import { FormPageHeaderComponent } from '../shared/forms/form-page-header.component';

@Component({
  selector: 'app-my-submissions',
  imports: [RouterLink, DatePipe, FormPageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="submissions-page container-xl" aria-labelledby="submissions-title" [attr.aria-busy]="loading()">
      <app-form-page-header title="My submissions" titleId="submissions-title" eyebrow="COMMUNITY SERVICES" description="Track drafts, review feedback and published services.">
        <a formPageActions class="primary-action" routerLink="/services/submit"><i class="bi bi-plus-lg" aria-hidden="true"></i> Add your service</a>
      </app-form-page-header>
      <div class="submission-content">
        @if (loading()) { <p class="state" role="status"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Loading your submissions…</p> }
        @else if (errorMessage(); as message) { <div class="state is-error"><p role="alert">{{ message }}</p><button type="button" (click)="load()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Try again</button></div> }
        @else if (!submissions().length) { <div class="state empty-state"><span class="empty-icon bi bi-inbox" aria-hidden="true"></span><h2>No submissions yet</h2><p>Your service listings and their review progress will appear here.</p><a class="primary-action" routerLink="/services/submit"><i class="bi bi-plus-lg" aria-hidden="true"></i> Create your first submission</a></div> }
        @else {
          <div class="submission-summary"><span class="summary-icon bi bi-card-checklist" aria-hidden="true"></span><span><strong>{{ submissions().length }} {{ submissions().length === 1 ? 'submission' : 'submissions' }}</strong><small>Manage your community service listings</small></span><a routerLink="/services/submit">Add another <i class="bi bi-arrow-right" aria-hidden="true"></i></a></div>
          <div class="submission-grid">@for (submission of submissions(); track submission.id) {
            <article class="submission-card">
              <div class="card-heading"><div><p class="provider"><i class="bi bi-building" aria-hidden="true"></i> {{ submission.service_providers.display_name }}</p><h2>{{ submission.title }}</h2></div><span class="status" [class]="statusClass(submission.status)"><span aria-hidden="true"></span>{{ statusLabel(submission.status) }}</span></div>
              <p class="category"><i class="bi bi-grid" aria-hidden="true"></i> {{ submission.service_categories?.name_en ?? 'Category unavailable' }} <span aria-hidden="true">·</span> <span lang="ta">{{ submission.service_categories?.name_ta ?? '—' }}</span></p>
              <p class="date"><i class="bi bi-clock" aria-hidden="true"></i> Updated {{ submission.updated_at | date:'mediumDate' }}</p>
              @if (pendingRevision(submission); as revision) { <div class="feedback pending-feedback"><strong><i class="bi bi-hourglass-split" aria-hidden="true"></i> Update pending review</strong><p>Version {{ revision.version_number }} is waiting for administrator approval.</p></div> }
              @if (latestFeedback(submission); as feedback) { <div class="feedback"><strong><i class="bi bi-chat-left-text" aria-hidden="true"></i> Review feedback</strong><p>{{ feedback.notes || feedback.decision }}</p></div> }
              <div class="actions">
                @if (canEdit(submission.status)) { <a [routerLink]="['/services/submit', submission.id]"><i class="bi bi-pencil" aria-hidden="true"></i> Edit submission</a> }
                @if (submission.status === 'published' && !pendingRevision(submission)) { <a [routerLink]="['/services/submit', submission.id]"><i class="bi bi-arrow-repeat" aria-hidden="true"></i> Submit update</a> }
                @if (submission.status === 'published') { <a class="secondary-action" [routerLink]="['/providers', submission.id]">Preview listing <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a> }
              </div>
            </article>
          }</div>
        }
      </div>
    </main>
  `,
  styles: `
    :host { display:block; padding-block:1.5rem 2.5rem; }.submissions-page { display:grid; gap:1.25rem; }.page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:clamp(1.5rem,4vw,2.5rem); border-radius:20px; background:linear-gradient(120deg,var(--cdm-btn-primary-light),var(--cdm-page)); border:1px solid var(--cdm-btn-primary-light); }.eyebrow { margin:0 0 .35rem; color:var(--cdm-muted); font-size:.72rem; font-weight:800; letter-spacing:.12em; } h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.7rem,4vw,2.5rem); }.intro,.date,.category { color:var(--cdm-muted); line-height:1.7; }.primary-action,.inline-link { display:inline-flex; align-items:center; min-height:44px; color:var(--cdm-royal-blue); }.primary-action { padding:.7rem 1rem; border-radius:9px; background:var(--cdm-btn-primary); color:var(--cdm-white); text-decoration:none; font-weight:700; white-space:nowrap; }.submission-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; }.submission-card { display:grid; gap:.75rem; padding:1.25rem; border:1px solid var(--cdm-border); border-radius:16px; background:white; }.card-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }.provider { margin:0 0 .25rem; color:var(--cdm-muted); font-weight:700; }.submission-card h2 { margin:0; color:var(--cdm-navy); font-size:1.2rem; }.status { display:inline-flex; flex:none; padding:.3rem .6rem; border-radius:99px; font-size:.78rem; font-weight:700; }.status-active { background:var(--cdm-btn-primary-light); color:var(--cdm-royal-blue); }.status-pending { background:var(--cdm-yellow-soft); color:var(--cdm-navy); }.status-draft { background:var(--cdm-page); color:var(--cdm-navy); }.status-rejected { background:var(--cdm-form-danger); color:#C92A2A; }.status-archived { background:var(--cdm-page); color:var(--cdm-navy); }.feedback { padding:.75rem; border-left:3px solid var(--cdm-yellow); background:var(--cdm-yellow-soft); color:var(--cdm-navy); line-height:1.6; }.feedback p { margin:.25rem 0 0; }.actions { display:flex; flex-wrap:wrap; gap:.75rem; }.actions a { display:inline-flex; align-items:center; min-height:42px; color:var(--cdm-royal-blue); }.state { display:flex; align-items:center; flex-wrap:wrap; gap:1rem; padding:1.25rem; border:1px solid var(--cdm-border); border-radius:14px; background:white; color:var(--cdm-muted); }.state button { min-height:42px; border:1px solid var(--cdm-btn-primary); border-radius:8px; background:var(--cdm-btn-primary); color:var(--cdm-white); font:inherit; padding:.5rem .8rem; } :is(a,button):focus-visible { outline:3px solid var(--cdm-royal-blue); outline-offset:3px; } @media(max-width:700px) { .page-header { flex-direction:column; }.primary-action { width:100%; justify-content:center; }.submission-grid { grid-template-columns:1fr; }.card-heading { flex-direction:column; } }
  `,
})
export class MySubmissionsComponent implements OnInit {
  private readonly service = inject(ServiceSubmissionService);
  protected readonly auth = inject(AuthService);
  protected readonly submissions = signal<SubmissionRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void { void this.load(); }
  protected async load(): Promise<void> { this.loading.set(true); this.errorMessage.set(null); try { this.submissions.set(await this.service.listMine()); } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load your submissions.'); } finally { this.loading.set(false); } }
  protected canEdit(status: SubmissionStatus): boolean { return status === 'draft' || status === 'pending_review'; }
  protected statusLabel(status: SubmissionStatus): string { return ({ draft: 'Draft', pending_review: 'Pending review', published: 'Published', rejected: 'Rejected', suspended: 'Suspended', archived: 'Unpublished' })[status]; }
  protected statusClass(status: SubmissionStatus): string { return ({ draft: 'status-draft', pending_review: 'status-pending', published: 'status-active', rejected: 'status-rejected', suspended: 'status-rejected', archived: 'status-archived' })[status]; }
  protected latestFeedback(submission: SubmissionRow) { return submission.listing_verification_history?.[0] ?? null; }
  protected pendingRevision(submission: SubmissionRow) { return submission.service_listing_revisions?.find(revision => revision.status === 'pending_review') ?? null; }
}
