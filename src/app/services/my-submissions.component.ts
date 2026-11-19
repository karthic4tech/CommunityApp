import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
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
         @if (hasLodgingListings()) { <a formPageActions class="secondary-action" routerLink="/my-lodging-inquiries"><i class="bi bi-inbox" aria-hidden="true"></i> Hotel enquiries</a> }
      </app-form-page-header>
      <div class="submission-content">
        @if (loading()) { <p class="state" role="status"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Loading your submissions…</p> }
        @else if (errorMessage(); as message) { <div class="state is-error"><p role="alert">{{ message }}</p><button type="button" (click)="load()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Try again</button></div> }
        @else if (!submissions().length) { <div class="state empty-state"><span class="empty-icon bi bi-inbox" aria-hidden="true"></span><h2>No submissions yet</h2><p>Your service listings and their review progress will appear here.</p><a class="primary-action" routerLink="/services/submit"><i class="bi bi-plus-lg" aria-hidden="true"></i> Create your first submission</a></div> }
        @else {
          <div class="submission-summary"><span class="summary-icon bi bi-card-checklist" aria-hidden="true"></span><span><strong>{{ submissions().length }} {{ submissions().length === 1 ? 'submission' : 'submissions' }}</strong><small>Manage your community service listings</small></span><a routerLink="/services/submit">Add another <i class="bi bi-arrow-right" aria-hidden="true"></i></a></div>
          <div class="submission-toolbar">
            <label for="submission-name-filter">Listing name
              <input id="submission-name-filter" type="search" [value]="nameFilter()" (input)="updateNameFilter($event)" placeholder="Search listing name" />
            </label>
            <label for="submission-category-filter">Category
              <select id="submission-category-filter" [value]="categoryFilter()" (change)="updateCategoryFilter($event)">
                <option value="all">All categories</option>
                @for (category of categories(); track category.id) { <option [value]="category.id">{{ category.name_en }}</option> }
              </select>
            </label>
            <label for="submission-status-filter">Status
            <select id="submission-status-filter" [value]="statusFilter()" (change)="updateStatusFilter($event)">
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_review">Pending review</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Unpublished</option>
            </select>
            </label>
            <p class="results-count" aria-live="polite">Showing {{ showingStart() }}–{{ showingEnd() }} of {{ filteredSubmissions().length }} submissions</p>
          </div>
          @if (visibleSubmissions().length) {
          <div class="submission-grid">@for (submission of visibleSubmissions(); track submission.id) {
            <article class="submission-card">
              <div class="card-heading"><div><p class="provider"><i class="bi bi-building" aria-hidden="true"></i> {{ submission.service_providers.display_name }}</p><h2>{{ submission.title }}</h2></div><span class="status" [class]="statusClass(submission.status)"><span aria-hidden="true"></span>{{ statusLabel(submission.status) }}</span></div>
              <p class="category"><i class="bi bi-grid" aria-hidden="true"></i> {{ submission.service_categories?.name_en ?? 'Category unavailable' }} <span aria-hidden="true">·</span> <span lang="ta">{{ submission.service_categories?.name_ta ?? '—' }}</span></p>
              <p class="date"><i class="bi bi-clock" aria-hidden="true"></i> Updated {{ submission.updated_at | date:'mediumDate' }}</p>
              @if (pendingRevision(submission); as revision) { <div class="feedback pending-feedback"><strong><i class="bi bi-hourglass-split" aria-hidden="true"></i> Update pending review</strong><p>Version {{ revision.version_number }} is waiting for administrator approval.</p></div> }
               @if (latestFeedback(submission); as feedback) { <div class="feedback"><strong><i class="bi bi-chat-left-text" aria-hidden="true"></i> Review feedback</strong><p>{{ feedback.notes || feedback.decision }}</p></div> }
                @if (historyExpanded().has(submission.id)) { <section class="history" [attr.aria-label]="'Version history for ' + submission.title"><h3>Version history</h3>@if (submission.service_listing_revisions?.length) { @for (revision of revisionHistory(submission); track revision.id) { <article class="history-entry"><div class="history-heading"><strong>Version {{ revision.version_number }}</strong><span class="history-status">{{ revision.status.replaceAll('_', ' ') }}</span><time [attr.datetime]="revision.submitted_at ?? revision.updated_at">{{ (revision.submitted_at ?? revision.updated_at) | date:'mediumDate' }}</time></div>@if (revision.snapshot) { <ul class="history-changes">@for (summary of revisionChangeSummaries(submission, revision); track summary) { <li>{{ summary }}</li> }</ul> }@if (revision.review_notes) { <p class="history-notes"><strong>Review notes:</strong> {{ revision.review_notes }}</p> }</article> } } @else { <p class="history-notes">No update history yet. Approved and submitted changes will appear here.</p> }</section> }
              <div class="actions"><button type="button" class="secondary-action history-toggle" [attr.aria-expanded]="historyExpanded().has(submission.id)" (click)="toggleHistory(submission.id)"><i class="bi bi-clock-history" aria-hidden="true"></i> {{ historyExpanded().has(submission.id) ? 'Hide history' : 'View history' }}</button>
                @if (canEdit(submission.status)) { <a [routerLink]="['/services/submit', submission.id]"><i class="bi bi-pencil" aria-hidden="true"></i> Edit submission</a> }
                @if (submission.status === 'published' && !pendingRevision(submission)) { <a [routerLink]="['/services/submit', submission.id]"><i class="bi bi-arrow-repeat" aria-hidden="true"></i> Submit update</a> }
                @if (submission.status === 'published') { <a class="secondary-action" [routerLink]="['/providers', submission.id]">Preview listing <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a> }
              </div>
            </article>
          }</div>
          } @else { <p class="state filtered-empty" role="status">No submissions match these filters.</p> }
          @if (totalPages() > 1) {
            <nav class="pagination" aria-label="Submission pages">
              <button type="button" class="pagination-button text-button" [disabled]="currentPage() === 1" (click)="setPage(currentPage() - 1)">Previous</button>
              <div class="pagination-pages" role="group" aria-label="Choose page">
                @for (page of pageNumbers(); track page) {
                  <button type="button" class="pagination-button pagination-number text-button" [class.is-current]="currentPage() === page" [attr.aria-current]="currentPage() === page ? 'page' : null" [attr.aria-label]="'Go to page ' + page" (click)="setPage(page)">{{ page }}</button>
                }
              </div>
              <button type="button" class="pagination-button text-button" [disabled]="currentPage() === totalPages()" (click)="setPage(currentPage() + 1)">Next</button>
            </nav>
          }
        }
      </div>
    </main>
  `,
  styles: `
    .submission-toolbar { display:grid; grid-template-columns:minmax(180px,1.4fr) repeat(2,minmax(150px,1fr)); align-items:end; gap:.75rem; padding:.9rem 1rem; border:1px solid var(--cdm-border); border-radius:12px; background:#fff; }
    .history { display:grid; gap:.65rem; padding:.85rem; border:1px solid #d7e2ef; border-radius:12px; background:#f7faff; min-width:0; }.history h3 { margin:0; color:var(--cdm-navy); font-size:1rem; }.history-entry { display:grid; gap:.55rem; min-width:0; padding:.75rem; border:1px solid var(--cdm-border); border-radius:9px; background:#fff; }.history-heading { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; color:var(--cdm-navy); }.history-heading time { margin-left:auto; color:var(--cdm-muted); font-size:.8rem; }.history-status { padding:.2rem .45rem; border-radius:99px; color:#0755b8; background:#eaf2fd; font-size:.75rem; text-transform:capitalize; }.history-changes { display:grid; gap:.35rem; margin:0; padding-left:1.15rem; color:var(--cdm-navy); font-size:.88rem; line-height:1.5; overflow-wrap:anywhere; }.history-changes li::marker { color:#087f69; }.history-notes { margin:0; color:var(--cdm-muted); font-size:.84rem; overflow-wrap:anywhere; }.secondary-action { display:inline-flex; align-items:center; gap:.4rem; min-height:44px; padding:.65rem .85rem; border:1px solid var(--cdm-border); border-radius:9px; color:var(--cdm-royal-blue); background:#fff; font-weight:700; text-decoration:none; }
    .submission-toolbar label { display:grid; gap:.4rem; color:var(--cdm-navy); font-size:.84rem; font-weight:700; }
    .submission-toolbar select,.submission-toolbar input { box-sizing:border-box; width:100%; min-height:46px; padding:.55rem .7rem; border:1px solid var(--cdm-border); border-radius:8px; color:var(--cdm-navy); background:#fff; font:inherit; font-size:.9rem; }
    .results-count { grid-column:1/-1; margin:0; color:var(--cdm-muted); font-size:.8rem; }
    .filtered-empty { padding:1.5rem; border:1px dashed var(--cdm-border); border-radius:12px; text-align:center; }
    .pagination { display:flex; align-items:center; justify-content:center; gap:.45rem; }
    .pagination-pages { display:flex; align-items:center; gap:.35rem; }
    .pagination-button { display:inline-flex; align-items:center; justify-content:center; min-width:42px; min-height:42px; padding:.5rem .75rem; border:1px solid var(--cdm-border); border-radius:8px; color:var(--cdm-navy); background:#fff; font:inherit; font-size:.84rem; font-weight:700; cursor:pointer; }
    .pagination-number { min-width:42px; padding-inline:.5rem; }
    .pagination-button:hover:not(:disabled), .pagination-number.is-current { border-color:var(--cdm-btn-primary); color:var(--cdm-royal-blue); background:var(--cdm-btn-primary-light); }
    .pagination-button:disabled { cursor:not-allowed; opacity:.5; }
    @media (max-width: 600px) { .submission-toolbar { grid-template-columns:1fr 1fr; }.submission-toolbar label:first-child { grid-column:1/-1; }.results-count { grid-column:1/-1; justify-self:start; }.submission-grid { grid-template-columns:1fr; }.pagination { flex-wrap:wrap; gap:.3rem; }.pagination-button { padding-inline:.55rem; } }
    :host { display:block; padding-block:1.5rem 2.5rem; }.submissions-page { display:grid; gap:1.25rem; }.page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:clamp(1.5rem,4vw,2.5rem); border-radius:20px; background:linear-gradient(120deg,var(--cdm-btn-primary-light),var(--cdm-page)); border:1px solid var(--cdm-btn-primary-light); }.eyebrow { margin:0 0 .35rem; color:var(--cdm-muted); font-size:.72rem; font-weight:800; letter-spacing:.12em; } h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.7rem,4vw,2.5rem); }.intro,.date,.category { color:var(--cdm-muted); line-height:1.7; }.primary-action,.inline-link { display:inline-flex; align-items:center; min-height:44px; color:var(--cdm-royal-blue); }.primary-action { padding:.7rem 1rem; border-radius:9px; background:var(--cdm-btn-primary); color:var(--cdm-white); text-decoration:none; font-weight:700; white-space:nowrap; }.submission-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; }.submission-card { display:grid; gap:.75rem; padding:1.25rem; border:1px solid var(--cdm-border); border-radius:16px; background:white; }.card-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }.provider { margin:0 0 .25rem; color:var(--cdm-muted); font-weight:700; }.submission-card h2 { margin:0; color:var(--cdm-navy); font-size:1.2rem; }.status { display:inline-flex; flex:none; padding:.3rem .6rem; border-radius:99px; font-size:.78rem; font-weight:700; }.status-active { background:var(--cdm-btn-primary-light); color:var(--cdm-royal-blue); }.status-pending { background:var(--cdm-yellow-soft); color:var(--cdm-navy); }.status-draft { background:var(--cdm-page); color:var(--cdm-navy); }.status-rejected { background:var(--cdm-form-danger); color:#C92A2A; }.status-archived { background:var(--cdm-page); color:var(--cdm-navy); }.feedback { padding:.75rem; border-left:3px solid var(--cdm-yellow); background:var(--cdm-yellow-soft); color:var(--cdm-navy); line-height:1.6; }.feedback p { margin:.25rem 0 0; }.actions { display:flex; flex-wrap:wrap; gap:.75rem; }.actions a { display:inline-flex; align-items:center; min-height:42px; color:var(--cdm-royal-blue); }.actions .history-toggle { display:inline-flex; align-items:center; gap:.4rem; min-height:42px; padding:.45rem .7rem; border:1px solid var(--cdm-border); border-radius:8px; color:var(--cdm-royal-blue); background:#fff; font:inherit; font-weight:700; cursor:pointer; }.state { display:flex; align-items:center; flex-wrap:wrap; gap:1rem; padding:1.25rem; border:1px solid var(--cdm-border); border-radius:14px; background:white; color:var(--cdm-muted); }.state button { min-height:42px; border:1px solid var(--cdm-btn-primary); border-radius:8px; background:var(--cdm-btn-primary); color:var(--cdm-white); font:inherit; padding:.5rem .8rem; } :is(a,button):focus-visible { outline:3px solid var(--cdm-royal-blue); outline-offset:3px; } @media(max-width:700px) { .page-header { flex-direction:column; }.primary-action { width:100%; justify-content:center; }.submission-grid { grid-template-columns:1fr; }.card-heading { flex-direction:column; } }
  `,
})
export class MySubmissionsComponent implements OnInit {
  private readonly service = inject(ServiceSubmissionService);
  protected readonly auth = inject(AuthService);
  protected readonly submissions = signal<SubmissionRow[]>([]);
  protected readonly historyExpanded = signal<ReadonlySet<string>>(new Set());
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly pageSize = 5;
  protected readonly statusFilter = signal<'all' | SubmissionStatus>('all');
  protected readonly categoryFilter = signal('all');
  protected readonly nameFilter = signal('');
  protected readonly currentPage = signal(1);
  protected readonly categories = computed(() => {
    const uniqueCategories = new Map<string, { id: string; name_en: string }>();
    for (const submission of this.submissions()) {
      const category = submission.service_categories;
      if (category) uniqueCategories.set(category.id, { id: category.id, name_en: category.name_en });
    }
    return [...uniqueCategories.values()].sort((a, b) => a.name_en.localeCompare(b.name_en));
  });
  protected readonly hasLodgingListings = computed(() => this.submissions().some(item => ['hotels', 'lodge-stay'].includes(item.service_categories?.slug ?? '')));
  protected readonly filteredSubmissions = computed(() => {
    const status = this.statusFilter();
    const categoryId = this.categoryFilter();
    const name = this.nameFilter().trim().toLocaleLowerCase();
    return this.submissions().filter(submission =>
      (status === 'all' || submission.status === status)
      && (categoryId === 'all' || submission.category_id === categoryId)
      && (!name || submission.title.toLocaleLowerCase().includes(name)),
    );
  });
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredSubmissions().length / this.pageSize)));
  protected readonly pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));
  protected readonly visibleSubmissions = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredSubmissions().slice(start, start + this.pageSize);
  });
  protected readonly showingStart = computed(() => this.filteredSubmissions().length ? (this.currentPage() - 1) * this.pageSize + 1 : 0);
  protected readonly showingEnd = computed(() => Math.min(this.currentPage() * this.pageSize, this.filteredSubmissions().length));

  ngOnInit(): void { void this.load(); }
  protected async load(): Promise<void> { this.loading.set(true); this.errorMessage.set(null); try { this.submissions.set(await this.service.listMine()); this.currentPage.set(1); } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load your submissions.'); } finally { this.loading.set(false); } }
  protected updateStatusFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.statusFilter.set(value === 'all' || this.isSubmissionStatus(value) ? value : 'all');
    this.currentPage.set(1);
  }
  protected updateCategoryFilter(event: Event): void {
    this.categoryFilter.set((event.target as HTMLSelectElement).value || 'all');
    this.currentPage.set(1);
  }
  protected updateNameFilter(event: Event): void {
    this.nameFilter.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }
  protected setPage(page: number): void { this.currentPage.set(Math.max(1, Math.min(page, this.totalPages()))); }
  protected toggleHistory(id: string): void { this.historyExpanded.update(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  private isSubmissionStatus(value: string): value is SubmissionStatus {
    return ['draft', 'pending_review', 'published', 'rejected', 'suspended', 'archived'].includes(value);
  }
  protected canEdit(status: SubmissionStatus): boolean { return status === 'draft' || status === 'pending_review'; }
  protected statusLabel(status: SubmissionStatus): string { return ({ draft: 'Draft', pending_review: 'Pending review', published: 'Published', rejected: 'Rejected', suspended: 'Suspended', archived: 'Unpublished' })[status]; }
  protected statusClass(status: SubmissionStatus): string { return ({ draft: 'status-draft', pending_review: 'status-pending', published: 'status-active', rejected: 'status-rejected', suspended: 'status-rejected', archived: 'status-archived' })[status]; }
   protected latestFeedback(submission: SubmissionRow) { return submission.listing_verification_history?.[0] ?? null; }
   protected revisionHistory(submission: SubmissionRow): NonNullable<SubmissionRow['service_listing_revisions']> { return [...(submission.service_listing_revisions ?? [])].sort((left, right) => right.version_number - left.version_number); }
   protected revisionChangeSummaries(submission: SubmissionRow, revision: NonNullable<SubmissionRow['service_listing_revisions']>[number]): string[] {
     const versions = this.revisionHistory(submission);
     const previous = versions.find(item => item.version_number === revision.version_number - 1)?.snapshot;
     const next = revision.snapshot;
      const actor = revision.profiles?.full_name?.trim() || 'Service owner';
      if (!next) return [`${actor} submitted an update; revision details are unavailable.`];
      if (!previous) return this.initialRevisionSummaries(submission, revision, actor);
     const summaries: string[] = [];
     const describe = (label: string, before: unknown, after: unknown, brief = false): void => {
       const oldValue = before === null || before === undefined ? '' : String(before).trim();
       const newValue = after === null || after === undefined ? '' : String(after).trim();
       if (oldValue === newValue) return;
        if (brief) { summaries.push(`${actor} updated ${label}.`); return; }
        if (!oldValue) summaries.push(`${actor} added ${label}${newValue ? `: “${newValue}”` : ''}.`);
        else if (!newValue) summaries.push(`${actor} removed ${label} (previously “${oldValue}”).`);
        else summaries.push(`${actor} changed ${label} from “${oldValue}” to “${newValue}”.`);
     };
     const oldListing = previous.listing ?? {};
     const newListing = next.listing ?? {};
     const oldProvider = previous.provider ?? {};
     const newProvider = next.provider ?? {};
     describe('service name', oldListing.title, newListing.title);
     describe('category', oldListing.category_id, newListing.category_id);
     describe('service description', oldListing.description, newListing.description);
     describe('provider name', oldProvider.display_name, newProvider.display_name);
     describe('provider type', oldProvider.provider_type, newProvider.provider_type);
     describe('provider bio', oldProvider.description, newProvider.description, true);
     describe('address', oldProvider.address, newProvider.address);
     describe('postal code', oldProvider.postal_code, newProvider.postal_code);
     describe('email', oldProvider.public_email, newProvider.public_email);
     describe('website', oldProvider.website_url, newProvider.website_url);
     describe('Google Maps link', oldProvider.google_maps_url, newProvider.google_maps_url);
     describe('coordinates', `${oldProvider.latitude ?? ''},${oldProvider.longitude ?? ''}`, `${newProvider.latitude ?? ''},${newProvider.longitude ?? ''}`);
     describe('amenities', (oldListing.room_amenities ?? []).join(', '), (newListing.room_amenities ?? []).join(', '));
     describe('indicative room price', oldListing.indicative_room_price, newListing.indicative_room_price);
     const oldContacts = new Map((previous.contacts ?? []).map(contact => [contact.contact_type, contact.contact_value]));
     const newContacts = new Map((next.contacts ?? []).map(contact => [contact.contact_type, contact.contact_value]));
     for (const type of new Set([...oldContacts.keys(), ...newContacts.keys()])) {
       const label = type === 'phone' ? 'mobile number' : `${type} contact`;
       describe(label, oldContacts.get(type), newContacts.get(type));
     }
     const locationKey = (locations: NonNullable<typeof previous.locations>): string => locations.map(location => `${location.location_id}:${location.coverage_type}`).sort().join('|');
     describe('service areas', locationKey(previous.locations ?? []), locationKey(next.locations ?? []), true);
      return summaries.length ? summaries : [`No field changes were recorded for this version submitted by ${actor}.`];
    }
    private initialRevisionSummaries(submission: SubmissionRow, revision: NonNullable<SubmissionRow['service_listing_revisions']>[number], actor: string): string[] {
      const snapshot = revision.snapshot;
      if (!snapshot) return [`${actor} submitted the initial version for review; its details are unavailable.`];
      const details = [`${actor} submitted the initial listing with these details:`];
      const add = (label: string, value: string | number | null | undefined): void => {
        if (value === null || value === undefined || String(value).trim() === '') return;
        details.push(`${label}: ${value}`);
      };
      add('Service name', snapshot.listing?.title);
      const categoryId = snapshot.listing?.category_id;
      add('Category', categoryId === submission.category_id && submission.service_categories
        ? `${submission.service_categories.name_en} / ${submission.service_categories.name_ta}`
        : categoryId);
      add('Service description', snapshot.listing?.description);
      add('Provider name', snapshot.provider?.display_name);
      add('Provider type', snapshot.provider?.provider_type);
      add('Provider bio', snapshot.provider?.description);
      add('Address', snapshot.provider?.address);
      add('Postal code', snapshot.provider?.postal_code);
      add('Email', snapshot.provider?.public_email);
      add('Website', snapshot.provider?.website_url);
      add('Google Maps link', snapshot.provider?.google_maps_url);
      if (snapshot.provider?.latitude != null || snapshot.provider?.longitude != null) {
        add('Coordinates', `${snapshot.provider.latitude ?? '—'}, ${snapshot.provider.longitude ?? '—'}`);
      }
      if (snapshot.contacts?.length) {
        for (const contact of snapshot.contacts) add(contact.contact_type === 'phone' ? 'Mobile number' : `${contact.contact_type} contact`, `${contact.contact_value}${contact.is_public === false ? ' (private)' : ''}`);
      }
      if (snapshot.locations?.length) {
        for (const location of snapshot.locations) {
          const placeName = submission.listing_locations?.find(item => item.locations?.id === location.location_id)?.locations?.name_en
            ?? submission.listing_locations?.find(item => item.locations?.id === location.location_id)?.locations?.name_ta
            ?? location.location_id;
          add(location.coverage_type === 'based_here' ? 'Based at' : 'Serves', placeName);
        }
      }
      add('Amenities', snapshot.listing?.room_amenities?.join(', '));
      if (snapshot.listing?.indicative_room_price != null) add('Indicative room price', `₹${snapshot.listing.indicative_room_price} / night`);
      return details;
    }
  protected pendingRevision(submission: SubmissionRow) { return submission.service_listing_revisions?.find(revision => revision.status === 'pending_review') ?? null; }
}
