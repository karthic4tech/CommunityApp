import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { SubmissionRow, SubmissionStatus } from '../core/models/service-submission';
import { ServiceSubmissionService } from '../core/services/service-submission.service';

@Component({
  selector: 'app-my-submissions',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="submissions-page" aria-labelledby="submissions-title" [attr.aria-busy]="loading()">
      <header class="page-header"><div><p class="eyebrow">COMMUNITY SERVICES</p><h1 id="submissions-title">My submissions</h1><p class="intro">Track drafts, review feedback and published services.</p></div><a class="primary-action" routerLink="/services/submit"><i class="bi bi-plus-lg" aria-hidden="true"></i> Add your service</a></header>
      @if (loading()) { <p class="state" role="status">Loading your submissions…</p> } @else if (errorMessage(); as message) { <div class="state"><p role="alert">{{ message }}</p><button type="button" (click)="load()">Try again</button></div> } @else if (!submissions().length) { <div class="state"><p role="status">You have not submitted a service yet.</p><a class="inline-link" routerLink="/services/submit">Create your first submission</a></div> } @else {
        <div class="submission-grid">@for (submission of submissions(); track submission.id) { <article class="submission-card"><div class="card-heading"><div><p class="provider">{{ submission.service_providers.display_name }}</p><h2>{{ submission.title }}</h2></div><span class="status" [class]="statusClass(submission.status)">{{ statusLabel(submission.status) }}</span></div><p class="category">{{ submission.service_categories?.name_en ?? 'Category unavailable' }} · {{ submission.service_categories?.name_ta ?? '—' }}</p><p class="date">Updated {{ submission.updated_at | date:'mediumDate' }}</p>@if (pendingRevision(submission); as revision) { <div class="feedback"><strong>Update pending review</strong><p>Version {{ revision.version_number }} is waiting for administrator approval.</p></div> } @if (latestFeedback(submission); as feedback) { <div class="feedback"><strong>Review feedback</strong><p>{{ feedback.notes || feedback.decision }}</p></div> }<div class="actions">@if (canEdit(submission.status)) { <a [routerLink]="['/services/submit', submission.id]">Edit</a> } @if (submission.status === 'published' && !pendingRevision(submission)) { <a [routerLink]="['/services/submit', submission.id]">Submit update</a> } @if (submission.status === 'published') { <a [routerLink]="['/providers', submission.id]">Preview public listing</a> }</div></article> }</div>
      }
    </section>
  `,
  styles: `
    :host { display:block; padding-block:1.5rem 2.5rem; }.submissions-page { display:grid; gap:1.25rem; }.page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:clamp(1.5rem,4vw,2.5rem); border-radius:20px; background:linear-gradient(120deg,#eff7ee,#f8f8ed); border:1px solid #dfeade; }.eyebrow { margin:0 0 .35rem; color:#52665b; font-size:.72rem; font-weight:800; letter-spacing:.12em; } h1 { margin:0; color:#173f32; font-size:clamp(1.7rem,4vw,2.5rem); }.intro,.date,.category { color:#52665b; line-height:1.7; }.primary-action,.inline-link { display:inline-flex; align-items:center; min-height:44px; color:#075541; }.primary-action { padding:.7rem 1rem; border-radius:9px; background:#075541; color:white; text-decoration:none; font-weight:700; white-space:nowrap; }.submission-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; }.submission-card { display:grid; gap:.75rem; padding:1.25rem; border:1px solid #dfe7e2; border-radius:16px; background:white; }.card-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }.provider { margin:0 0 .25rem; color:#52665b; font-weight:700; }.submission-card h2 { margin:0; color:#173f32; font-size:1.2rem; }.status { display:inline-flex; flex:none; padding:.3rem .6rem; border-radius:99px; font-size:.78rem; font-weight:700; }.status-active { background:#e2f3e8; color:#176044; }.status-pending { background:#fff3cf; color:#69541e; }.status-draft { background:#edf1f3; color:#4b5b62; }.status-rejected { background:#f9e5e2; color:#8a261f; }.status-archived { background:#f1eee8; color:#6b6251; }.feedback { padding:.75rem; border-left:3px solid #d8b25c; background:#fffaf0; color:#625329; line-height:1.6; }.feedback p { margin:.25rem 0 0; }.actions { display:flex; flex-wrap:wrap; gap:.75rem; }.actions a { display:inline-flex; align-items:center; min-height:42px; color:#075541; }.state { display:flex; align-items:center; flex-wrap:wrap; gap:1rem; padding:1.25rem; border:1px solid #dfe7e2; border-radius:14px; background:white; color:#52665b; }.state button { min-height:42px; border:1px solid #075541; border-radius:8px; background:#075541; color:white; font:inherit; padding:.5rem .8rem; } :is(a,button):focus-visible { outline:3px solid #17583f; outline-offset:3px; } @media(max-width:700px) { .page-header { flex-direction:column; }.primary-action { width:100%; justify-content:center; }.submission-grid { grid-template-columns:1fr; }.card-heading { flex-direction:column; } }
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
