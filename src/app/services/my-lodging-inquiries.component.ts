import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LodgingInquiry, LodgingInquiryStatus } from '../core/models/lodging-inquiry';
import { LodgingInquiryService } from '../core/services/lodging-inquiry.service';

@Component({
  selector: 'app-my-lodging-inquiries',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="inbox-page" aria-labelledby="inbox-title" [attr.aria-busy]="loading() || savingId() !== null">
      <header class="page-header"><div><p class="eyebrow">PROPERTY MANAGEMENT</p><h1 id="inbox-title">Hotel &amp; homestay enquiries</h1><p>Respond to room availability and booking questions from guests.</p></div><div class="header-actions"><span class="inbox-count"><i class="bi bi-inbox" aria-hidden="true"></i> {{ newCount() }} new</span><button type="button" class="refresh-button" [disabled]="loading()" (click)="load()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Refresh</button></div></header>
      @if (errorMessage(); as message) { <div class="error-panel" role="alert"><p>{{ message }}</p><button type="button" (click)="load()">Try again</button></div> }
      @if (successMessage(); as message) { <p class="success-message" role="status">{{ message }}</p> }
      <nav class="status-tabs" aria-label="Filter enquiries">
        @for (filter of filters; track filter.value) { <button type="button" [class.active]="activeFilter() === filter.value" [attr.aria-pressed]="activeFilter() === filter.value" (click)="activeFilter.set(filter.value)">{{ filter.label }} <span>{{ countFor(filter.value) }}</span></button> }
      </nav>
      @if (loading()) { <p class="empty-state" role="status">Loading guest enquiries…</p> }
      @else if (!filtered().length) { <section class="empty-state"><i class="bi bi-chat-square-text" aria-hidden="true"></i><h2>{{ inquiries().length ? 'No enquiries in this view' : 'No guest enquiries yet' }}</h2><p>{{ inquiries().length ? 'Choose another status filter to see more messages.' : 'New room and booking questions for your properties will appear here.' }}</p></section> }
      @else { <section class="inquiry-list" aria-label="Guest enquiries">@for (item of filtered(); track item.id) {
        <article class="inquiry-card"><header class="card-header"><div><p class="property-name"><i class="bi bi-building" aria-hidden="true"></i> {{ item.service_listings.title }}</p><h2>{{ questionLabel(item.question_type) }}</h2></div><span class="status" [class]="'status status--' + item.status">{{ statusLabel(item.status) }}</span></header>
          <div class="guest-details"><div><span class="detail-label">Guest</span><strong>{{ item.guest_name }}</strong></div><div><span class="detail-label">Received</span><time [attr.datetime]="item.created_at">{{ item.created_at | date:'medium' }}</time></div>@if (item.check_in && item.check_out) { <div><span class="detail-label">Stay dates</span><strong>{{ item.check_in | date:'mediumDate' }} – {{ item.check_out | date:'mediumDate' }}</strong></div> }@if (item.guest_count) { <div><span class="detail-label">Guests</span><strong>{{ item.guest_count }}</strong></div> }</div>
          @if (item.message) { <p class="guest-message">{{ item.message }}</p> }
          <div class="contact-actions"><a [href]="'tel:' + phoneHref(item.guest_phone)"><i class="bi bi-telephone" aria-hidden="true"></i> Call {{ item.guest_phone }}</a>@if (item.guest_email) { <a [href]="'mailto:' + item.guest_email"><i class="bi bi-envelope" aria-hidden="true"></i> Email guest</a> }</div>
          <div class="status-actions" [attr.aria-label]="'Update enquiry status for ' + item.guest_name"><span>Update status</span><button type="button" [class.current]="item.status === 'new'" [disabled]="savingId() === item.id || item.status === 'new'" (click)="updateStatus(item,'new')">New</button><button type="button" [class.current]="item.status === 'contacted'" [disabled]="savingId() === item.id || item.status === 'contacted'" (click)="updateStatus(item,'contacted')">Contacted</button><button type="button" [class.current]="item.status === 'closed'" [disabled]="savingId() === item.id || item.status === 'closed'" (click)="updateStatus(item,'closed')">Closed</button></div>
        </article>
      }</section> }
    </main>
  `,
  styles: `
    :host { display:block; width:min(var(--cdm-content-width),calc(100% - 2 * var(--cdm-page-gutter))); margin-inline:auto; padding-block:1.5rem 3rem; color:var(--cdm-navy); }
    .inbox-page { display:grid; gap:1rem; }.page-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:clamp(1.25rem,4vw,2rem); border:1px solid #d7e9e4; border-radius:18px; background:linear-gradient(120deg,#effaf6,#f5f8fc); }.eyebrow { margin:0 0 .35rem; color:#087f69; font-size:.72rem; font-weight:800; letter-spacing:.12em; }.page-header h1 { margin:0; font-size:clamp(1.6rem,4vw,2.3rem); }.page-header p:not(.eyebrow) { margin:.5rem 0 0; color:#52657b; }.header-actions { display:flex; align-items:center; flex-wrap:wrap; gap:.5rem; }.inbox-count { flex:none; display:inline-flex; align-items:center; gap:.45rem; padding:.5rem .75rem; border:1px solid #cce6dc; border-radius:999px; color:#075947; background:#e5f7f1; font-weight:750; }.refresh-button { display:inline-flex; align-items:center; gap:.4rem; min-height:42px; padding:.45rem .7rem; border:1px solid #d5dee8; border-radius:8px; color:#0755b8; background:#fff; font:inherit; font-size:.84rem; font-weight:700; cursor:pointer; }.refresh-button:disabled { cursor:wait; opacity:.65; }
    .status-tabs { display:flex; gap:.35rem; overflow-x:auto; padding:.3rem; border:1px solid #dce4ed; border-radius:12px; background:#f6f8fb; }.status-tabs button { display:inline-flex; flex:none; align-items:center; gap:.5rem; min-height:44px; padding:.5rem .75rem; border:0; border-radius:9px; color:#52657b; background:transparent; font:inherit; font-weight:700; cursor:pointer; }.status-tabs button.active { color:#002050; background:#fff; box-shadow:0 1px 5px rgb(0 32 80 / .12); }.status-tabs button span { min-width:1.35rem; padding:.05rem .35rem; border-radius:99px; color:#0755b8; background:#eaf2fd; font-size:.78rem; text-align:center; }
    .inquiry-list { display:grid; gap:.85rem; }.inquiry-card { display:grid; gap:.85rem; min-width:0; padding:clamp(1rem,3vw,1.25rem); border:1px solid #dce4ed; border-radius:15px; background:#fff; box-shadow:0 3px 12px rgb(0 32 80 / .04); }.card-header { display:flex; align-items:flex-start; justify-content:space-between; gap:.8rem; }.property-name { margin:0 0 .25rem; color:#52657b; font-size:.82rem; font-weight:700; }.card-header h2 { margin:0; font-size:1.1rem; line-height:1.35; }.status { flex:none; padding:.3rem .6rem; border-radius:999px; font-size:.76rem; font-weight:800; }.status--new { color:#744a00; background:#fff2d1; }.status--contacted { color:#0755b8; background:#eaf2fd; }.status--closed { color:#475569; background:#edf0f3; }
    .guest-details { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,175px),1fr)); gap:.75rem; padding:.8rem; border-radius:10px; background:#f7faff; }.guest-details > div { display:grid; gap:.2rem; min-width:0; }.detail-label { color:#64778c; font-size:.74rem; font-weight:750; }.guest-details strong,.guest-details time { color:#17324f; font-size:.88rem; overflow-wrap:anywhere; }.guest-message { margin:0; padding:.75rem; border-left:3px solid #0b8068; border-radius:0 8px 8px 0; color:#29425c; background:#effaf6; line-height:1.55; white-space:pre-wrap; overflow-wrap:anywhere; }
    .contact-actions,.status-actions { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; }.contact-actions a { display:inline-flex; align-items:center; gap:.4rem; min-height:40px; padding:.45rem .65rem; border:1px solid #dce4ed; border-radius:8px; color:#0755b8; background:#fff; font-size:.84rem; font-weight:700; text-decoration:none; }.status-actions { padding-top:.65rem; border-top:1px solid #e7edf3; }.status-actions > span { margin-right:auto; color:#64778c; font-size:.8rem; font-weight:700; }.status-actions button { min-height:38px; padding:.4rem .65rem; border:1px solid #d5dee8; border-radius:8px; color:#29425c; background:#fff; font:inherit; font-size:.8rem; font-weight:700; cursor:pointer; }.status-actions button.current { border-color:#087f69; color:#075947; background:#e8f7f1; }.status-actions button:disabled { cursor:default; }
    .empty-state { display:grid; justify-items:center; gap:.45rem; padding:2rem 1rem; border:1px dashed #cbd7e2; border-radius:14px; background:#fff; text-align:center; }.empty-state > i { color:#087f69; font-size:1.7rem; }.empty-state h2 { margin:0; font-size:1.1rem; }.empty-state p { margin:0; color:#64778c; }.error-panel,.success-message { padding:.8rem 1rem; border-radius:10px; }.error-panel { display:flex; align-items:center; justify-content:space-between; gap:1rem; border:1px solid #efc2be; color:#922b21; background:#fff5f3; }.error-panel p { margin:0; }.error-panel button { min-height:40px; padding:.4rem .7rem; border:1px solid #bd4339; border-radius:8px; color:#922b21; background:#fff; font:inherit; font-weight:700; }.success-message { margin:0; color:#075947; background:#e8f7f1; }
    :is(a,button):focus-visible { outline:3px solid rgb(7 85 184 / .28); outline-offset:2px; }
    @media(max-width:560px) { .page-header { align-items:flex-start; flex-direction:column; }.header-actions { width:100%; justify-content:space-between; }.status-actions > span { flex-basis:100%; }.card-header h2 { font-size:1rem; }.contact-actions a { flex:1 1 145px; justify-content:center; } }
  `,
})
export class MyLodgingInquiriesComponent implements OnInit {
  private readonly service = inject(LodgingInquiryService);
  protected readonly inquiries = signal<LodgingInquiry[]>([]);
  protected readonly loading = signal(true);
  protected readonly savingId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly activeFilter = signal<'all' | LodgingInquiryStatus>('all');
  protected readonly filters = [{ value: 'all', label: 'All' }, { value: 'new', label: 'New' }, { value: 'contacted', label: 'Contacted' }, { value: 'closed', label: 'Closed' }] as const;
  protected readonly newCount = computed(() => this.inquiries().filter(item => item.status === 'new').length);
  protected readonly filtered = computed(() => this.activeFilter() === 'all' ? this.inquiries() : this.inquiries().filter(item => item.status === this.activeFilter()));

  ngOnInit(): void { void this.load(); }
  protected async load(): Promise<void> { this.loading.set(true); this.errorMessage.set(null); try { this.inquiries.set(await this.service.listMine()); } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load hotel enquiries.'); } finally { this.loading.set(false); } }
  protected countFor(status: 'all' | LodgingInquiryStatus): number { return status === 'all' ? this.inquiries().length : this.inquiries().filter(item => item.status === status).length; }
  protected questionLabel(type: LodgingInquiry['question_type']): string { return ({ availability: 'Room availability', assisted_booking: 'Help with booking', booking_instructions: 'How to book', other: 'Other question' })[type]; }
  protected statusLabel(status: LodgingInquiryStatus): string { return ({ new: 'New', contacted: 'Contacted', closed: 'Closed' })[status]; }
  protected phoneHref(phone: string): string { return phone.replace(/[^+\d]/g, ''); }
  protected async updateStatus(item: LodgingInquiry, status: LodgingInquiryStatus): Promise<void> {
    if (this.savingId()) return;
    this.savingId.set(item.id); this.errorMessage.set(null); this.successMessage.set(null);
    try { await this.service.updateStatus(item.id, status); this.inquiries.update(rows => rows.map(row => row.id === item.id ? { ...row, status } : row)); this.successMessage.set(`Enquiry from ${item.guest_name} marked ${status}.`); }
    catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to update this enquiry.'); }
    finally { this.savingId.set(null); }
  }
}
