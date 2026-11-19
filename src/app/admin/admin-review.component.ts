import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminReviewService, ReviewListingRow, ReviewRevisionRow } from '../core/services/admin-review.service';
import { MediaGalleryItem } from '../core/models/media.models';
import { MediaService } from '../core/services/media.service';

interface RevisionFieldChange { field: string; previous: string; current: string }

@Component({
  selector: 'app-admin-review',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="review-page cdm-form" [class.pending-tab]="activeTab() === 'pending'" [class.published-tab]="activeTab() === 'published'" aria-labelledby="review-title" [attr.aria-busy]="loading() || saving()">
       <header class="page-header"><div><a class="back-link" routerLink="/admin"><i class="bi bi-arrow-left" aria-hidden="true"></i> Admin dashboard</a><p class="eyebrow">MODERATION</p><h1 id="review-title">Listing review</h1><p class="intro">Review submissions before they become public.</p>@if (pendingReviewCount() > 0) { <p class="review-alert" role="status"><i class="bi bi-bell-fill" aria-hidden="true"></i> {{ pendingReviewCount() }} {{ pendingReviewCount() === 1 ? 'listing' : 'listings' }} awaiting review</p> }</div><div class="header-actions"><a class="secondary" routerLink="/admin/services/import"><i class="bi bi-file-earmark-spreadsheet" aria-hidden="true"></i> Import Services</a><button type="button" class="secondary" (click)="load()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Refresh</button></div></header>
      @if (loading()) { <p class="state" role="status">Loading review queue…</p> } @else if (errorMessage(); as message) { <div class="state"><p role="alert">{{ message }}</p><button type="button" (click)="load()">Try again</button></div> } @else {
         <nav class="review-tabs" role="tablist" aria-label="Listing review sections"><button type="button" role="tab" [class.active]="activeTab() === 'pending'" [attr.aria-selected]="activeTab() === 'pending'" (click)="setTab('pending')">Pending <span>{{ filteredPending().length }}</span></button><button type="button" role="tab" [class.active]="activeTab() === 'published'" [attr.aria-selected]="activeTab() === 'published'" (click)="setTab('published')">Published <span>{{ filteredPublished().length }}</span></button></nav>
         <section class="filters" aria-labelledby="filter-title">
          <div><h2 id="filter-title">Review queue</h2><p>Find and review listings quickly.</p></div>
          <label>Search listings<input class="filter-input" type="search" [value]="filter()" (input)="setFilter($event)" placeholder="Title, provider or category" /></label>
          <label>Items per page<select class="filter-input" [value]="pageSize()" (change)="setPageSize($event)"><option value="6">6</option><option value="12">12</option><option value="24">24</option></select></label>
        </section>
          @if (revisions().length) { <section class="published pending-updates"><h2>Pending listing updates ({{ revisions().length }})</h2><p class="section-caption">Review every proposed change before it replaces the public listing.</p><div class="published-list">@for (revision of revisions(); track revision.id) { <article class="revision"><div class="revision-title"><strong>{{ revision.snapshot.listing.title }}</strong><span>{{ revision.snapshot.provider.display_name }} · Version {{ revision.version_number }}</span></div><div class="revision-diff" aria-label="Previous and proposed values">@for (change of revisionChanges(revision); track change.field) { <section class="revision-change"><h3>{{ change.field }}</h3><div class="revision-values"><div class="previous-value"><span>Previous</span><p>{{ change.previous }}</p></div><div class="proposed-value"><span>Proposed</span><p>{{ change.current }}</p></div></div></section> }@if (!revisionChanges(revision).length) { <p class="no-changes">No field differences were found against the current published version.</p> }</div><textarea #revisionNotes rows="2" placeholder="Review feedback"></textarea><label class="check"><input #revisionVerify type="checkbox" /> Verify provider during approval</label><div class="actions"><button type="button" class="approve" [disabled]="saving()" (click)="decideRevision(revision,'approve',revisionNotes.value,revisionVerify.checked)">Approve update</button><button type="button" [disabled]="saving()" (click)="decideRevision(revision,'request_changes',revisionNotes.value,false)">Request changes</button><button type="button" class="danger" [disabled]="saving()" (click)="decideRevision(revision,'reject',revisionNotes.value,false)">Reject</button></div></article> }</div></section> }
          <section class="review-table-section"><div class="section-heading"><div><h2>Pending review ({{ filteredPending().length }})</h2><p class="section-caption">Review submissions before they become public.</p></div><span>{{ pendingPageCount() }} page{{ pendingPageCount() === 1 ? '' : 's' }}</span></div>
             <div class="bulk-toolbar"><label><input type="checkbox" [checked]="allVisiblePendingSelected()" [disabled]="!pagedPending().length || saving()" (change)="toggleVisiblePending($event)" /> Select this page</label><span>{{ selectedPendingIds().size }} selected</span><label class="bulk-verify"><input type="checkbox" [checked]="verifyProvidersInBulk()" [disabled]="saving()" (change)="setBulkVerifyProviders($event)" /> Verify selected providers during approval</label><button type="button" class="approve" [disabled]="!selectedPendingIds().size || saving()" (click)="approveSelected()">{{ saving() ? 'Approving…' : 'Approve selected' }}</button></div>
             @if (bulkMessage(); as message) { <p class="bulk-message" [class.bulk-error]="bulkHadErrors()" role="status">{{ message }}</p> }
            @if (!filteredPending().length) { <p class="state">{{ pending().length ? 'No submissions match your filter.' : 'No pending submissions.' }}</p> } @else { <div class="data-table"><div class="data-table-head pending-table-head"><span>Select</span><span>Listing</span><span>Provider</span><span>Category</span><span>Status</span><span>Action</span></div>@for (item of pagedPending(); track item.id) { <div class="data-row pending-data-row" [class.selected]="selected()?.id === item.id"><input type="checkbox" [checked]="selectedPendingIds().has(item.id)" [attr.aria-label]="'Select ' + item.title" [disabled]="saving()" (change)="togglePending(item.id,$event)" /><strong>{{ item.title }}</strong><span>{{ item.service_providers.display_name }}</span><span>{{ item.service_categories.name_en }}</span><span class="status-pill">Pending</span><button type="button" class="row-action" (click)="select(item)">Review <i class="bi bi-arrow-right" aria-hidden="true"></i></button></div> }</div><nav class="pagination" aria-label="Pending review pages"><button type="button" [disabled]="pendingPage() === 1" (click)="changePendingPage(-1)"><i class="bi bi-chevron-left" aria-hidden="true"></i><span class="visually-hidden">Previous page</span></button><span>Page {{ pendingPage() }} of {{ pendingPageCount() }}</span><button type="button" [disabled]="pendingPage() === pendingPageCount()" (click)="changePendingPage(1)"><i class="bi bi-chevron-right" aria-hidden="true"></i><span class="visually-hidden">Next page</span></button></nav> }</section>
          @if (selected(); as item) { <article class="detail"><h2>{{ item.title }}</h2><p class="provider">{{ item.service_providers.display_name }} · {{ item.service_categories.name_en }}</p><p>{{ item.description }}</p><p><strong>Provider status:</strong> {{ item.service_providers.verification_status }}</p>@if (item.service_providers.address) { <p><strong>Address:</strong> {{ item.service_providers.address }}</p> }@if (item.service_providers.postal_code) { <p><strong>Postal code:</strong> {{ item.service_providers.postal_code }}</p> }<h3>Service locations</h3>@if (item.listing_locations.length) { <ul>@for (location of item.listing_locations; track $index) { @let place = location.locations; <li><strong>{{ location.coverage_type === 'based_here' ? 'Based here' : 'Serves' }}:</strong> {{ place?.name_en ?? place?.name_ta ?? 'Location unavailable' }}@if (place; as details) { @if (details.name_en && details.name_ta && details.name_en !== details.name_ta) { <span> · {{ details.name_ta }}</span> } }</li> }</ul> } @else { <p>No locality or service areas were provided.</p> }<h3>Contacts</h3><ul>@for (contact of item.listing_contacts; track $index) { <li>{{ contact.contact_type }}: {{ contact.contact_value }} ({{ contact.is_public ? 'public' : 'private' }})</li> }</ul><h3>Review decision</h3><textarea #notes rows="4" placeholder="Reason or feedback for the provider"></textarea><label class="check"><input #verify type="checkbox" /> Verify provider during approval</label><div class="actions"><button type="button" class="approve" [disabled]="saving()" (click)="decide(item,'approve',notes.value,verify.checked)">Approve and publish</button><button type="button" [disabled]="saving()" (click)="decide(item,'request_changes',notes.value,false)">Request changes</button><button type="button" class="danger" [disabled]="saving()" (click)="decide(item,'reject',notes.value,false)">Reject</button></div></article> } @else { <p class="state">Select a submission to review.</p> }
         @if (selectedImagesLoading()) { <p class="state" role="status">Loading service images…</p> } @else if (selectedImages().length) { <section class="detail review-image-panel" aria-labelledby="service-images-title"><h2 id="service-images-title">Service images</h2><div class="review-images">@for (image of selectedImages(); track image.asset.id) { <img [src]="image.url" [alt]="image.alt" width="180" height="120" loading="lazy" /> }</div></section> }
         <section class="published"><div class="section-heading"><div><h2>Published listings ({{ filteredPublished().length }})</h2><p class="section-caption">Manage listings currently visible in the directory.</p></div><span>{{ publishedPageCount() }} page{{ publishedPageCount() === 1 ? '' : 's' }}</span></div>@if (!filteredPublished().length) { <p class="state">{{ published().length ? 'No published listings match your filter.' : 'No published listings.' }}</p> } @else { <div class="data-table"><div class="data-table-head"><span>Listing</span><span>Provider</span><span>Category</span><span>Status</span><span>Action</span></div>@for (item of pagedPublished(); track item.id) { <div class="data-row"><strong>{{ item.title }}</strong><span>{{ item.service_providers.display_name }}</span><span>{{ item.service_categories.name_en }}</span><span class="status-pill published-status">Published</span><span><button type="button" class="danger row-button" [disabled]="saving()" (click)="unpublish(item)">Unpublish</button></span></div> }</div><nav class="pagination" aria-label="Published listing pages"><button type="button" [disabled]="publishedPage() === 1" (click)="changePublishedPage(-1)"><i class="bi bi-chevron-left" aria-hidden="true"></i><span class="visually-hidden">Previous page</span></button><span>Page {{ publishedPage() }} of {{ publishedPageCount() }}</span><button type="button" [disabled]="publishedPage() === publishedPageCount()" (click)="changePublishedPage(1)"><i class="bi bi-chevron-right" aria-hidden="true"></i><span class="visually-hidden">Next page</span></button></nav> }</section>
        }
        <dialog #bulkApprovalDialog class="bulk-confirm-dialog" aria-labelledby="bulk-confirm-title" aria-describedby="bulk-confirm-description" (click)="closeBulkApprovalFromBackdrop($event)" (cancel)="onBulkApprovalCancel()">
          <section class="bulk-confirm-card">
            <div class="bulk-confirm-icon" aria-hidden="true"><i class="bi bi-shield-check"></i></div>
            <p class="eyebrow">REVIEW ACTION</p>
            <h2 id="bulk-confirm-title">Approve selected listings?</h2>
            <p id="bulk-confirm-description">You’re about to publish <strong>{{ bulkApprovalCount() }} selected listing{{ bulkApprovalCount() === 1 ? '' : 's' }}</strong>. Published listings become visible in the directory.</p>
            @if (verifyProvidersInBulk()) { <div class="verify-notice"><i class="bi bi-info-circle" aria-hidden="true"></i><span>Unverified providers in this selection will also be marked verified.</span></div> } @else { <div class="verify-notice"><i class="bi bi-info-circle" aria-hidden="true"></i><span>Listings whose providers are not verified will remain unpublished.</span></div> }
            <div class="bulk-confirm-actions"><button type="button" class="cancel-action" (click)="closeBulkApproval()">Cancel</button><button type="button" class="confirm-action" [disabled]="saving()" (click)="confirmBulkApproval()">{{ saving() ? 'Approving…' : 'Approve and publish' }}</button></div>
          </section>
        </dialog>
      </section>
   `,
   styles: `
     .filters { display:grid; grid-template-columns:minmax(0,1fr) minmax(220px,1.3fr) 150px; align-items:end; gap:1rem; padding:1rem 1.25rem; border:1px solid var(--cdm-border); border-radius:16px; background:#fff; }.header-actions { display:flex; flex-wrap:wrap; gap:.5rem; }.header-actions a { display:inline-flex; align-items:center; gap:.4rem; text-decoration:none; }.filters h2 { margin:0; color:var(--cdm-navy); }.filters p,.section-caption { margin:.3rem 0 0; color:var(--cdm-muted); font-size:.85rem; }.filters label { display:grid; gap:.35rem; color:var(--cdm-muted); font-size:.78rem; font-weight:700; }.filter-input { width:100%; min-height:44px; border:1px solid var(--cdm-border); border-radius:9px; padding:.55rem .7rem; background:#fff; color:var(--cdm-navy); font:inherit; }.section-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }.section-heading > span { flex:none; color:var(--cdm-muted); font-size:.8rem; }.card-grid,.published-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.7rem; }.card-title { display:flex; justify-content:space-between; gap:.5rem; }.card-title i { color:var(--cdm-teal); }.queue-item { min-height:125px; transition:border-color .15s ease,transform .15s ease,box-shadow .15s ease; }.queue-item:hover { border-color:var(--cdm-royal-blue); transform:translateY(-2px); box-shadow:0 6px 18px #00205014; }.published-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }.published-card { display:flex!important; align-items:flex-start; justify-content:space-between!important; gap:.75rem; min-height:110px; padding:.85rem; }.published-card div { display:grid; gap:.25rem; min-width:0; }.published-card strong { overflow-wrap:anywhere; }.published-card span,.published-card small { color:var(--cdm-muted); line-height:1.45; }.pagination { display:flex; align-items:center; justify-content:center; gap:.8rem; margin-top:.8rem; color:var(--cdm-muted); font-size:.82rem; }.pagination button { display:grid; place-items:center; min-width:40px; min-height:40px; padding:.4rem; }.pagination button:disabled { cursor:not-allowed; opacity:.45; }
    @media(max-width:1000px) { .published-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media(max-width:800px) { .filters { grid-template-columns:1fr 1fr; }.filters > div { grid-column:1/-1; } }
     @media(max-width:600px) { .filters,.card-grid,.published-grid { grid-template-columns:1fr; }.filters > div { grid-column:auto; }.published-card { min-height:0; } }
      .review-table-section { padding:1.25rem; border:1px solid var(--cdm-border); border-radius:16px; background:#fff; }.bulk-toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:.75rem; margin-top:1rem; padding:.7rem .8rem; border:1px solid var(--cdm-border); border-radius:10px; background:#f8fafc; }.bulk-toolbar label { display:flex; align-items:center; gap:.45rem; color:var(--cdm-navy); font-size:.82rem; font-weight:700; }.bulk-toolbar>span { color:var(--cdm-muted); font-size:.8rem; }.bulk-toolbar button { margin-left:auto; }.bulk-toolbar .approve { border-color:#087f6b; color:#fff; background:#087f6b; }.bulk-message { margin:.7rem 0 0; padding:.65rem .8rem; border-radius:9px; color:#087f5b; background:#e5f7f1; font-size:.84rem; }.bulk-message.bulk-error { color:#9f2d20; background:#fff1ee; }.data-table { overflow:hidden; margin-top:1rem; border:1px solid var(--cdm-border); border-radius:12px; }.data-table-head,.data-row { display:grid; grid-template-columns:1.35fr 1.1fr 1fr .8fr auto; align-items:center; gap:1rem; }.pending-table-head,.pending-data-row { grid-template-columns:48px 1.25fr 1fr .9fr .7fr auto; gap:.8rem; }.data-table-head { padding:.75rem .9rem; color:var(--cdm-muted); background:var(--cdm-btn-primary-light); font-size:.76rem; font-weight:800; }.data-row { min-height:72px; padding:.75rem .9rem; border:0; border-top:1px solid var(--cdm-border); color:var(--cdm-navy); }.data-row:first-of-type { border-top:0; }.data-row span { color:var(--cdm-muted); }.data-row:hover,.data-row.selected { background:var(--cdm-btn-primary-light); }.data-row>input { width:18px; height:18px; accent-color:var(--cdm-royal-blue); }.status-pill { width:max-content; padding:.25rem .5rem; border-radius:999px; color:var(--cdm-royal-blue)!important; background:#e7f0ff; font-size:.72rem; font-weight:700; }.published-status { color:#087f5b!important; background:#e5f7f1; }.row-action { min-height:38px; padding:.45rem .6rem; color:var(--cdm-royal-blue)!important; font-weight:700; white-space:nowrap; }.row-button { min-height:40px; padding:.45rem .65rem; }
      .review-tabs { display:none; }
      @media(max-width:800px) {
        .review-tabs { display:flex; gap:.35rem; padding:.25rem; border:1px solid var(--cdm-border); border-radius:12px; background:#f4f7fb; }
        .review-tabs button { flex:1; min-height:44px; padding:.55rem .65rem; border:0; border-radius:9px; background:transparent; color:var(--cdm-muted); font-size:.88rem; }
        .review-tabs button.active { background:#fff; color:var(--cdm-navy); box-shadow:0 1px 5px rgba(0,32,80,.12); }
        .review-tabs span { display:inline-flex; align-items:center; justify-content:center; min-width:1.35rem; margin-left:.2rem; padding:.1rem .3rem; border-radius:999px; background:var(--cdm-btn-primary-light); color:var(--cdm-royal-blue); font-size:.75rem; }
         .pending-tab > .published:not(.pending-updates) { display:none; }
        .published-tab > .review-table-section { display:none; }
        .published-tab > .detail { display:none; }
        .published-tab > .review-image-panel { display:none; }
        .review-page { min-width:0; }
        .page-header { padding:1rem; border-radius:14px; }
        .page-header > div { min-width:0; }
        .page-header .secondary { flex:none; padding:.55rem .65rem; font-size:.86rem; }
        .filters { grid-template-columns:1fr; padding:.85rem; }
        .filters > div { grid-column:auto; }
        .review-table-section,.published { padding:.85rem; min-width:0; }
        .data-table { overflow:visible; margin-top:.75rem; border:0; }
        .data-table-head { display:none; }
         .data-row { display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-start; width:100%; min-width:0; min-height:0; gap:.45rem; margin-bottom:.7rem; padding:1rem; border:1px solid var(--cdm-border); border-radius:14px; background:#fff; box-shadow:0 2px 8px rgba(0,32,80,.05); overflow-wrap:anywhere; }.pending-data-row { display:grid; grid-template-columns:24px minmax(0,1fr); align-items:center; gap:.45rem .65rem; }
         .data-row:last-child { margin-bottom:0; }
         .pending-data-row>input { grid-column:1; grid-row:1; }
         .pending-data-row strong { grid-column:2; max-width:100%; line-height:1.35; overflow-wrap:anywhere; }
         .pending-data-row span { grid-column:2; max-width:100%; line-height:1.4; overflow-wrap:anywhere; }
         .pending-data-row .row-action { grid-column:2; justify-self:start; }
        .data-row:hover,.data-row.selected { border-color:var(--cdm-royal-blue); background:var(--cdm-btn-primary-light); }
        .data-row .row-action { display:inline-flex; align-items:center; min-height:44px; padding:.55rem .75rem; border:1px solid var(--cdm-royal-blue); border-radius:9px; color:var(--cdm-royal-blue)!important; background:#fff; }
        .data-row .row-button { min-height:44px; }
        .section-heading { align-items:flex-start; }
        .section-heading > span { white-space:nowrap; }
        .detail,.review-image-panel { padding:.9rem; min-width:0; }
        .detail h2 { overflow-wrap:anywhere; }
        .detail textarea { box-sizing:border-box; max-width:100%; }
        .detail .actions { display:flex; flex-direction:column; gap:.6rem; }
        .detail .actions button { width:100%; min-height:48px; }
        .review-images { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.5rem; }
        .review-images img { width:100%; height:auto; aspect-ratio:3/2; object-fit:cover; }
         .published-list .revision { min-width:0; }
         .pending-updates h2 { overflow-wrap:anywhere; }.revision-values { grid-template-columns:1fr; }.revision .actions { display:flex; flex-wrap:wrap; }.revision .actions button { flex:1 1 140px; min-height:46px; }.revision textarea { box-sizing:border-box; width:100%; max-width:100%; }.revision-contact { display:block; overflow-wrap:anywhere; }
      }
      .revision-title { display:grid; gap:.25rem; min-width:0; }.revision-title strong { overflow-wrap:anywhere; color:var(--cdm-navy); font-size:1.05rem; }.revision-title span { overflow-wrap:anywhere; color:var(--cdm-muted); font-size:.84rem; }.revision-diff { display:grid; gap:.7rem; margin:.25rem 0; }.revision-change { min-width:0; padding:.8rem; border:1px solid #d8e2ef; border-radius:10px; background:#f7faff; }.revision-change h3 { margin:0 0 .55rem; color:var(--cdm-navy); font-size:.9rem; }.revision-values { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.65rem; }.previous-value,.proposed-value { min-width:0; padding:.65rem .75rem; border-radius:8px; }.previous-value { border-left:3px solid #64748b; background:#eef1f5; }.proposed-value { border-left:3px solid #0b8068; background:#e8f7f1; }.previous-value span,.proposed-value span { display:block; margin-bottom:.25rem; font-size:.72rem; font-weight:800; letter-spacing:.04em; text-transform:uppercase; }.previous-value span { color:#475569; }.proposed-value span { color:#08634f; }.previous-value p,.proposed-value p { margin:0; color:var(--cdm-navy); font-size:.86rem; line-height:1.55; white-space:pre-wrap; overflow-wrap:anywhere; }.no-changes { margin:0; padding:.8rem; border-radius:8px; color:#475569; background:#eef1f5; }
      .bulk-confirm-dialog { width:min(92vw, 480px); max-width:480px; padding:0; border:0; border-radius:20px; color:var(--cdm-navy); background:transparent; box-shadow:0 24px 70px rgba(0,24,60,.28); }
      .bulk-confirm-dialog::backdrop { background:rgba(9,24,48,.58); backdrop-filter:blur(3px); }
      .bulk-confirm-card { padding:clamp(1.25rem,4vw,2rem); border:1px solid rgba(255,255,255,.7); border-radius:20px; background:#fff; }
      .bulk-confirm-icon { display:grid; place-items:center; width:48px; height:48px; margin-bottom:1rem; border-radius:14px; color:#087f6b; background:#e5f7f1; font-size:1.35rem; }
      .bulk-confirm-card .eyebrow { margin:0 0 .35rem; color:#087f6b; font-size:.7rem; font-weight:800; letter-spacing:.12em; }
      .bulk-confirm-card h2 { margin:0; color:var(--cdm-navy); font-size:clamp(1.25rem,4vw,1.55rem); line-height:1.25; }
      .bulk-confirm-card>p:not(.eyebrow) { margin:.65rem 0 0; color:var(--cdm-muted); line-height:1.6; }
      .bulk-confirm-card>p strong { color:var(--cdm-navy); }
      .verify-notice { display:flex; align-items:flex-start; gap:.65rem; margin-top:1rem; padding:.8rem .9rem; border:1px solid #d9e8f7; border-radius:11px; color:#274b70; background:#f2f7fc; font-size:.87rem; line-height:1.5; }
      .verify-notice i { flex:none; margin-top:.1rem; color:#1769aa; }
      .bulk-confirm-actions { display:flex; justify-content:flex-end; gap:.65rem; margin-top:1.5rem; }
      .bulk-confirm-actions button { min-height:46px; padding:.65rem 1rem; }
      .bulk-confirm-actions .cancel-action { border-color:var(--cdm-border); color:var(--cdm-navy); background:#fff; }
      .bulk-confirm-actions .confirm-action { border-color:#087f6b; color:#fff; background:#087f6b; }
      .bulk-confirm-actions .confirm-action:hover:not(:disabled) { border-color:#066b5b; background:#066b5b; }
      .bulk-confirm-actions button:focus-visible { outline:3px solid #4a90e2; outline-offset:3px; }
      @media(max-width:430px) { .bulk-confirm-dialog { width:calc(100vw - 1.5rem); }.bulk-confirm-actions { flex-direction:column-reverse; }.bulk-confirm-actions button { width:100%; } }
      @media(max-width:430px) {
        :host { padding-block: .75rem 1.5rem; }
        .review-page { gap:.75rem; }
        .page-header { align-items:stretch; flex-direction:column; gap:.75rem; }
        .page-header .secondary { width:100%; }
        .data-row { padding:.85rem; }
        .review-images { grid-template-columns:1fr; }
      }
    :host { display:block; padding-block:1.5rem 2.5rem; }.review-page { display:grid; gap:1.25rem; }.page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:clamp(1.5rem,4vw,2.5rem); border-radius:20px; background:linear-gradient(120deg,var(--cdm-btn-primary-light),var(--cdm-page)); border:1px solid var(--cdm-btn-primary-light); }.back-link { display:inline-flex; align-items:center; min-height:44px; color:var(--cdm-royal-blue); }.eyebrow { margin:0 0 .35rem; color:var(--cdm-muted); font-size:.72rem; font-weight:800; letter-spacing:.12em; } h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.7rem,4vw,2.5rem); }.intro,.provider,.published-list span { color:var(--cdm-muted); line-height:1.7; } .review-alert { display:flex; align-items:center; gap:.5rem; margin:.65rem 0 0; color:#a33b20; font-weight:800; }.secondary,button { min-height:44px; border:1px solid var(--cdm-btn-primary); border-radius:9px; padding:.65rem .9rem; background:white; color:var(--cdm-royal-blue); font:inherit; font-weight:700; cursor:pointer; }.review-layout { display:grid; grid-template-columns:minmax(220px, .8fr) minmax(0,1.7fr); gap:1rem; }.queue,.detail,.published { padding:1.25rem; border:1px solid var(--cdm-border); border-radius:16px; background:white; }.queue h2,.detail h2,.published h2 { margin-top:0; color:var(--cdm-navy); }.queue { display:grid; align-content:start; gap:.5rem; }.queue-item { display:grid; gap:.2rem; min-height:70px; border:1px solid var(--cdm-border); border-radius:10px; padding:.75rem; background:white; text-align:left; color:var(--cdm-navy); }.queue-item span,.queue-item small { color:var(--cdm-muted); }.queue-item.selected { border-color:var(--cdm-royal-blue); background:var(--cdm-btn-primary-light); }.detail p { line-height:1.7; color:var(--cdm-muted); }.detail h3 { color:var(--cdm-navy); font-size:1rem; }.detail textarea { width:100%; border:1px solid var(--cdm-border); border-radius:9px; padding:.7rem; font:inherit; }.detail ul { color:var(--cdm-muted); line-height:1.7; }.check { display:flex; align-items:center; gap:.5rem; margin-block:1rem; color:var(--cdm-white); }.check input { width:1.1rem; height:1.1rem; }.actions { display:flex; flex-wrap:wrap; gap:.6rem; }.actions button { background:var(--cdm-btn-primary); color:var(--cdm-white); }.actions .approve { background:var(--cdm-btn-primary); }.actions .danger { background:#fff; color:#C92A2A; border-color:#C92A2A; }.state { padding:1.25rem; border:1px solid var(--cdm-border); border-radius:14px; background:white; color:var(--cdm-muted); line-height:1.7; }.state button { margin-top:.5rem; }.published-list { display:grid; gap:.5rem; }.published-list article { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; padding:.75rem; border-top:1px solid var(--cdm-border); }.published-list strong { margin-right:auto; color:var(--cdm-white); }.published-list button { color:#C92A2A; border-color:#C92A2A; } :is(a,button,textarea,input):focus-visible { outline:3px solid var(--cdm-royal-blue); outline-offset:3px; } @media(max-width:750px) { .page-header { flex-direction:column; }.review-layout { grid-template-columns:1fr; } }
  `,
})
export class AdminReviewComponent implements OnInit {
  private readonly service = inject(AdminReviewService);
  private readonly media = inject(MediaService);
   private readonly document = inject(DOCUMENT);
   private readonly bulkApprovalDialog = viewChild<ElementRef<HTMLDialogElement>>('bulkApprovalDialog');
  protected readonly pending = signal<ReviewListingRow[]>([]);
  protected readonly published = signal<ReviewListingRow[]>([]);
  protected readonly revisions = signal<ReviewRevisionRow[]>([]);
  protected readonly selected = signal<ReviewListingRow | null>(null);
  protected readonly selectedImages = signal<MediaGalleryItem[]>([]);
  protected readonly selectedImagesLoading = signal(false);
  protected readonly revisionImages = signal<ReadonlyMap<string, MediaGalleryItem[]>>(new Map());
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selectedPendingIds = signal<ReadonlySet<string>>(new Set());
  protected readonly bulkMessage = signal<string | null>(null);
   protected readonly bulkHadErrors = signal(false);
  protected readonly verifyProvidersInBulk = signal(false);
  protected readonly bulkApprovalCount = computed(() => this.pending().filter(item => this.selectedPendingIds().has(item.id)).length);
  protected readonly filter = signal('');
  protected readonly pageSize = signal(6);
  protected readonly pendingPage = signal(1);
  protected readonly publishedPage = signal(1);
  protected readonly filteredPending = computed(() => this.filterItems(this.pending()));
  protected readonly pendingReviewCount = computed(() => this.pending().length + this.revisions().length);
  protected readonly filteredPublished = computed(() => this.filterItems(this.published()));
  protected readonly pendingPageCount = computed(() => Math.max(1, Math.ceil(this.filteredPending().length / this.pageSize())));
  protected readonly publishedPageCount = computed(() => Math.max(1, Math.ceil(this.filteredPublished().length / this.pageSize())));
  protected readonly pagedPending = computed(() => this.pageItems(this.filteredPending(), this.pendingPage()));
  protected readonly allVisiblePendingSelected = computed(() => this.pagedPending().length > 0 && this.pagedPending().every(item => this.selectedPendingIds().has(item.id)));
  protected readonly pagedPublished = computed(() => this.pageItems(this.filteredPublished(), this.publishedPage()));
  protected readonly activeTab = signal<'pending' | 'published'>('pending');

  ngOnInit(): void { void this.load(); }
  protected async select(item: ReviewListingRow): Promise<void> { this.selected.set(item); this.selectedImages.set([]); this.selectedImagesLoading.set(true); try { this.selectedImages.set(await this.media.getMediaGallery('listing', item.id)); } catch { this.selectedImages.set([]); } finally { this.selectedImagesLoading.set(false); } }
   protected setTab(tab: 'pending' | 'published'): void { this.activeTab.set(tab); }
   protected categoryLabel(id: string): string { const match = [...this.pending(), ...this.published()].find(item => item.category_id === id); return match?.service_categories.name_en ?? 'Category updated'; }
   protected revisionChanges(revision: ReviewRevisionRow): RevisionFieldChange[] {
     const current = revision.service_listings;
     const proposed = revision.snapshot;
     const format = (value: unknown): string => value === null || value === undefined || value === '' ? 'Not set' : String(value);
     const contacts = (items: readonly { contact_type: string; contact_value: string; is_public: boolean; sort_order?: number }[]): string => items.length ? [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(item => `${item.contact_type}: ${item.contact_value}${item.is_public ? '' : ' (private)'}`).join('\n') : 'None';
     const areas = (items: readonly { coverage_type: string; locations?: { id: string; name_en: string | null; name_ta: string } | null }[]): string => items.length ? items.map(item => `${item.coverage_type}:${item.locations?.id ?? 'unknown'}`).sort().join(', ') : 'None';
     const proposedAreas = (items: readonly { location_id: string; coverage_type: string }[]): string => items.length ? items.map(item => `${item.coverage_type}:${item.location_id}`).sort().join(', ') : 'None';
     const oldAmenities = current.room_amenities?.length ? current.room_amenities.join(', ') : 'None';
     const newAmenities = proposed.listing.room_amenities?.length ? proposed.listing.room_amenities.join(', ') : 'None';
     const rows: RevisionFieldChange[] = [
       { field: 'Service name', previous: format(current.title), current: format(proposed.listing.title) },
       { field: 'Category', previous: `${current.service_categories.name_en} / ${current.service_categories.name_ta}`, current: proposed.listing.category_id === current.category_id ? `${current.service_categories.name_en} / ${current.service_categories.name_ta}` : this.categoryLabel(proposed.listing.category_id), },
       { field: 'Service description', previous: format(current.description), current: format(proposed.listing.description) },
       { field: 'Provider name', previous: format(current.service_providers.display_name), current: format(proposed.provider.display_name) },
       { field: 'Provider type', previous: format(current.service_providers.provider_type), current: format(proposed.provider.provider_type) },
       { field: 'Provider bio', previous: format(current.service_providers.description), current: format(proposed.provider.description) },
       { field: 'Address', previous: format(current.service_providers.address), current: format(proposed.provider.address) },
       { field: 'Postal code', previous: format(current.service_providers.postal_code), current: format(proposed.provider.postal_code) },
       { field: 'Email', previous: format(current.service_providers.public_email), current: format(proposed.provider.public_email) },
       { field: 'Website', previous: format(current.service_providers.website_url), current: format(proposed.provider.website_url) },
       { field: 'Google Maps link', previous: format(current.service_providers.google_maps_url), current: format(proposed.provider.google_maps_url) },
       { field: 'Coordinates', previous: `${format(current.service_providers.latitude)}, ${format(current.service_providers.longitude)}`, current: `${format(proposed.provider.latitude)}, ${format(proposed.provider.longitude)}` },
       { field: 'Contact details', previous: contacts(current.listing_contacts), current: contacts(proposed.contacts) },
       { field: 'Service areas', previous: areas(current.listing_locations), current: proposedAreas(proposed.locations) },
       { field: 'Amenities', previous: oldAmenities, current: newAmenities },
       { field: 'Indicative room price', previous: current.indicative_room_price == null ? 'Not set' : `₹${current.indicative_room_price} / night`, current: proposed.listing.indicative_room_price == null ? 'Not set' : `₹${proposed.listing.indicative_room_price} / night` },
     ];
     return rows.filter(row => row.previous !== row.current);
   }
  protected closeReview(): void { this.selected.set(null); this.selectedImages.set([]); }
  protected setFilter(event: Event): void { this.filter.set((event.target as HTMLInputElement).value); this.pendingPage.set(1); this.publishedPage.set(1); }
  protected togglePending(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedPendingIds.update(current => {
      const next = new Set(current);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
    this.bulkMessage.set(null);
  }
  protected toggleVisiblePending(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedPendingIds.update(current => {
      const next = new Set(current);
      for (const item of this.pagedPending()) {
        if (checked) next.add(item.id); else next.delete(item.id);
      }
      return next;
    });
    this.bulkMessage.set(null);
  }
  protected setBulkVerifyProviders(event: Event): void {
    this.verifyProvidersInBulk.set((event.target as HTMLInputElement).checked);
    this.bulkMessage.set(null);
  }
  protected async approveSelected(): Promise<void> {
    const selected = this.pending().filter(item => this.selectedPendingIds().has(item.id));
    if (!selected.length) return;
    this.bulkApprovalDialog()?.nativeElement.showModal();
  }
  protected closeBulkApproval(): void {
    const dialog = this.bulkApprovalDialog()?.nativeElement;
    if (dialog?.open) dialog.close();
  }
  protected closeBulkApprovalFromBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeBulkApproval();
  }
  protected onBulkApprovalCancel(): void {
    // Native dialog Escape handling already restores focus to its opener.
  }
  protected async confirmBulkApproval(): Promise<void> {
    this.closeBulkApproval();
    const selected = this.pending().filter(item => this.selectedPendingIds().has(item.id));
    if (!selected.length) return;
    this.saving.set(true);
    this.bulkMessage.set(null);
    const approved: string[] = [];
    const failed: { item: ReviewListingRow; reason: string }[] = [];
    try {
      for (const item of selected) {
        try {
          await this.service.review(item.id, 'approve', '', this.verifyProvidersInBulk());
          approved.push(item.id);
        } catch (error) {
          failed.push({ item, reason: error instanceof Error ? error.message.replace(/^Unable to complete this review decision\.\s*/, '') : 'Unknown review error.' });
        }
      }
      this.selectedPendingIds.set(new Set(failed.map(({ item }) => item.id)));
      await this.load();
      this.bulkHadErrors.set(failed.length > 0);
      this.bulkMessage.set(failed.length
        ? `Approved ${approved.length}. Could not approve: ${failed.map(({ item, reason }) => `${item.title} (${reason})`).join('; ')}.`
        : `Approved and published ${approved.length} listing${approved.length === 1 ? '' : 's'}.`);
    } finally {
      this.saving.set(false);
    }
  }
  protected setPageSize(event: Event): void { this.pageSize.set(Number((event.target as HTMLSelectElement).value)); this.pendingPage.set(1); this.publishedPage.set(1); }
  protected changePendingPage(delta: number): void { this.pendingPage.update((page) => Math.min(this.pendingPageCount(), Math.max(1, page + delta))); }
  protected changePublishedPage(delta: number): void { this.publishedPage.update((page) => Math.min(this.publishedPageCount(), Math.max(1, page + delta))); }
  protected async load(): Promise<void> { this.loading.set(true); this.errorMessage.set(null); try { const [pending, published, revisions] = await Promise.all([this.service.pending(), this.service.published(), this.service.pendingRevisions()]); this.pending.set(pending); this.selectedPendingIds.update(current => new Set([...current].filter(id => pending.some(item => item.id === id)))); this.published.set(published); this.revisions.set(revisions); const imageEntries = await Promise.all(revisions.map(async (revision): Promise<readonly [string, MediaGalleryItem[]]> => { try { return [revision.listing_id, await this.media.getMediaGallery('listing', revision.listing_id)]; } catch { return [revision.listing_id, [] as MediaGalleryItem[]]; } })); this.revisionImages.set(new Map(imageEntries)); if (this.selected() && !pending.some(item => item.id === this.selected()?.id)) { this.selected.set(null); this.selectedImages.set([]); } } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load the review queue.'); } finally { this.loading.set(false); } }
  protected async decide(item: ReviewListingRow, decision: 'approve' | 'request_changes' | 'reject', notes: string, verify: boolean): Promise<void> { if (!notes.trim() && decision !== 'approve') { this.errorMessage.set('Add a reason or feedback before continuing.'); return; } if (decision !== 'approve' && !this.confirm(decision === 'reject' ? 'Reject this submission?' : 'Request changes for this submission?')) return; await this.perform(item.id, decision, notes, verify); }
  protected async unpublish(item: ReviewListingRow): Promise<void> { if (!this.confirm('Unpublish this listing? It will disappear from the public directory.')) return; await this.perform(item.id, 'unpublish', 'Unpublished by administrator.', false); }
  protected async decideRevision(item: ReviewRevisionRow, decision: 'approve' | 'request_changes' | 'reject', notes: string, verify: boolean): Promise<void> { if (!notes.trim() && decision !== 'approve') { this.errorMessage.set('Add a reason or feedback before continuing.'); return; } if (decision !== 'approve' && !this.confirm(decision === 'reject' ? 'Reject this update?' : 'Request changes for this update?')) return; this.saving.set(true); this.errorMessage.set(null); try { await this.service.reviewRevision(item.id, decision, notes, verify); await this.load(); } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to review this update.'); } finally { this.saving.set(false); } }
  private async perform(id: string, decision: 'approve' | 'request_changes' | 'reject' | 'unpublish', notes: string, verify: boolean): Promise<void> { this.saving.set(true); this.errorMessage.set(null); try { await this.service.review(id, decision, notes, verify); await this.load(); } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to complete review.'); } finally { this.saving.set(false); } }
  private confirm(message: string): boolean { return this.document.defaultView?.confirm(message) ?? false; }
  private filterItems(items: ReviewListingRow[]): ReviewListingRow[] {
    const query = this.filter().trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => `${item.title} ${item.service_providers.display_name} ${item.service_categories.name_en}`.toLowerCase().includes(query));
  }
  private pageItems(items: ReviewListingRow[], page: number): ReviewListingRow[] { const start = (page - 1) * this.pageSize(); return items.slice(start, start + this.pageSize()); }
}
