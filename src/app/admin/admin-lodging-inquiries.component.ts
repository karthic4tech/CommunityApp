import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LodgingInquiry, LodgingInquiryStatus } from '../core/models/lodging-inquiry';
import { LodgingInquiryService } from '../core/services/lodging-inquiry.service';

@Component({
  selector: 'app-admin-lodging-inquiries',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="admin-inquiries container-xl" aria-labelledby="inquiries-title" [attr.aria-busy]="loading() || savingId() !== null">
      <header class="page-header"><div><a routerLink="/admin" class="back-link"><i class="bi bi-arrow-left" aria-hidden="true"></i> Admin dashboard</a><p class="eyebrow">TOURISM · GUEST SUPPORT</p><h1 id="inquiries-title">Hotel &amp; homestay enquiries</h1><p>Review guest availability and booking questions across lodging listings.</p></div><button class="refresh-button" type="button" [disabled]="loading()" (click)="load()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Refresh</button></header>
      @if (errorMessage(); as message) { <div class="error-panel" role="alert"><p>{{ message }}</p><button type="button" (click)="load()">Try again</button></div> }
      @if (successMessage(); as message) { <p class="success-message" role="status">{{ message }}</p> }
      <nav class="filters" aria-label="Filter lodging enquiries">
        @for (filter of filters; track filter.value) { <button type="button" [class.active]="activeFilter() === filter.value" [attr.aria-pressed]="activeFilter() === filter.value" (click)="activeFilter.set(filter.value)">{{ filter.label }} <span>{{ countFor(filter.value) }}</span></button> }
      </nav>
      @if (loading()) { <p class="empty-state" role="status">Loading lodging enquiries…</p> }
      @else if (!filtered().length) { <section class="empty-state"><i class="bi bi-inbox" aria-hidden="true"></i><h2>{{ inquiries().length ? 'No enquiries in this filter' : 'No lodging enquiries yet' }}</h2><p>{{ inquiries().length ? 'Choose another status filter to see other enquiries.' : 'Guest enquiries for hotels and homestays will appear here.' }}</p></section> }
      @else { <section class="inquiry-list" aria-label="Lodging enquiries">@for (item of filtered(); track item.id) {
        <article class="inquiry-card">
          <header class="card-header"><div><p class="property-name"><i class="bi bi-building" aria-hidden="true"></i> {{ item.service_listings.title }} <span>· {{ item.service_listings.service_providers.display_name }}</span></p><h2>{{ questionLabel(item.question_type) }}</h2></div><span class="status" [class]="'status status--' + item.status">{{ statusLabel(item.status) }}</span></header>
          <div class="details"><div><span>Guest</span><strong>{{ item.guest_name || 'Name not provided' }}</strong></div><div><span>Received</span><time [attr.datetime]="item.created_at">{{ item.created_at | date:'medium' }}</time></div>@if (item.check_in && item.check_out) { <div><span>Stay dates</span><strong>{{ item.check_in | date:'mediumDate' }} – {{ item.check_out | date:'mediumDate' }}</strong></div> }@if (item.guest_count) { <div><span>Guests</span><strong>{{ item.guest_count }}</strong></div> }</div>
          @if (item.message) { <p class="guest-message">{{ item.message }}</p> }
          <div class="contact-actions"><a [href]="'tel:' + phoneHref(item.guest_phone)"><i class="bi bi-telephone" aria-hidden="true"></i> {{ item.guest_phone }}</a>@if (item.guest_email) { <a [href]="'mailto:' + item.guest_email"><i class="bi bi-envelope" aria-hidden="true"></i> {{ item.guest_email }}</a> }</div>
          <div class="status-actions" [attr.aria-label]="'Update enquiry status for ' + (item.guest_name || 'guest')"><span>Update status</span><button type="button" [class.current]="item.status === 'new'" [disabled]="savingId() === item.id || item.status === 'new'" (click)="updateStatus(item,'new')">New</button><button type="button" [class.current]="item.status === 'contacted'" [disabled]="savingId() === item.id || item.status === 'contacted'" (click)="updateStatus(item,'contacted')">Contacted</button><button type="button" [class.current]="item.status === 'closed'" [disabled]="savingId() === item.id || item.status === 'closed'" (click)="updateStatus(item,'closed')">Closed</button></div>
        </article>
      }</section> }
    </main>
  `,
  styles: `
    :host { display:block; padding-block:1.5rem 3rem; color:var(--cdm-navy); }
    .admin-inquiries { display:grid; gap:1rem; }.page-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:clamp(1.25rem,4vw,2rem); border:1px solid #d7e9e4; border-radius:18px; background:linear-gradient(120deg,#effaf6,#f5f8fc); }.back-link { display:inline-flex; align-items:center; gap:.4rem; min-height:40px; color:#0755b8; font-weight:700; text-decoration:none; }.eyebrow { margin:.45rem 0 .35rem; color:#087f69; font-size:.72rem; font-weight:800; letter-spacing:.12em; }.page-header h1 { margin:0; font-size:clamp(1.6rem,4vw,2.3rem); }.page-header p:not(.eyebrow) { margin:.5rem 0 0; color:#52657b; }.refresh-button { display:inline-flex; align-items:center; gap:.4rem; min-height:44px; padding:.5rem .8rem; border:1px solid #d5dee8; border-radius:9px; color:#0755b8; background:#fff; font:inherit; font-weight:700; cursor:pointer; }.refresh-button:disabled { opacity:.6; cursor:wait; }
    .filters { display:flex; gap:.35rem; overflow-x:auto; padding:.3rem; border:1px solid #dce4ed; border-radius:12px; background:#f6f8fb; }.filters button { display:inline-flex; flex:none; align-items:center; gap:.5rem; min-height:44px; padding:.5rem .75rem; border:0; border-radius:9px; color:#52657b; background:transparent; font:inherit; font-weight:700; cursor:pointer; }.filters button.active { color:#002050; background:#fff; box-shadow:0 1px 5px rgb(0 32 80 / .12); }.filters button span { min-width:1.35rem; padding:.05rem .35rem; border-radius:99px; color:#0755b8; background:#eaf2fd; font-size:.78rem; text-align:center; }
    .inquiry-list { display:grid; gap:.85rem; }.inquiry-card { display:grid; gap:.85rem; min-width:0; padding:clamp(1rem,3vw,1.25rem); border:1px solid #dce4ed; border-radius:15px; background:#fff; box-shadow:0 3px 12px rgb(0 32 80 / .04); }.card-header { display:flex; align-items:flex-start; justify-content:space-between; gap:.8rem; }.property-name { margin:0 0 .25rem; color:#52657b; font-size:.82rem; font-weight:700; }.property-name span { color:#718197; font-weight:500; }.card-header h2 { margin:0; font-size:1.1rem; line-height:1.35; }.status { flex:none; padding:.3rem .6rem; border-radius:999px; font-size:.76rem; font-weight:800; }.status--new { color:#744a00; background:#fff2d1; }.status--contacted { color:#0755b8; background:#eaf2fd; }.status--closed { color:#475569; background:#edf0f3; }
    .details { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,175px),1fr)); gap:.75rem; padding:.8rem; border-radius:10px; background:#f7faff; }.details > div { display:grid; gap:.2rem; min-width:0; }.details span { color:#64778c; font-size:.74rem; font-weight:750; }.details strong,.details time { color:#17324f; font-size:.88rem; overflow-wrap:anywhere; }.guest-message { margin:0; padding:.75rem; border-left:3px solid #0b8068; border-radius:0 8px 8px 0; color:#29425c; background:#effaf6; line-height:1.55; white-space:pre-wrap; overflow-wrap:anywhere; }.contact-actions,.status-actions { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; }.contact-actions a { display:inline-flex; align-items:center; gap:.4rem; min-height:40px; padding:.45rem .65rem; border:1px solid #dce4ed; border-radius:8px; color:#0755b8; background:#fff; font-size:.84rem; font-weight:700; text-decoration:none; }.status-actions { padding-top:.65rem; border-top:1px solid #e7edf3; }.status-actions > span { margin-right:auto; color:#64778c; font-size:.8rem; font-weight:700; }.status-actions button { min-height:38px; padding:.4rem .65rem; border:1px solid #d5dee8; border-radius:8px; color:#29425c; background:#fff; font:inherit; font-size:.8rem; font-weight:700; cursor:pointer; }.status-actions button.current { border-color:#087f69; color:#075947; background:#e8f7f1; }.status-actions button:disabled { cursor:default; }
    .empty-state { display:grid; justify-items:center; gap:.45rem; padding:2rem 1rem; border:1px dashed #cbd7e2; border-radius:14px; background:#fff; text-align:center; }.empty-state > i { color:#087f69; font-size:1.7rem; }.empty-state h2 { margin:0; font-size:1.1rem; }.empty-state p { margin:0; color:#64778c; }.error-panel,.success-message { padding:.8rem 1rem; border-radius:10px; }.error-panel { display:flex; align-items:center; justify-content:space-between; gap:1rem; border:1px solid #efc2be; color:#922b21; background:#fff5f3; }.error-panel p { margin:0; }.error-panel button { min-height:40px; padding:.4rem .7rem; border:1px solid #bd4339; border-radius:8px; color:#922b21; background:#fff; font:inherit; font-weight:700; }.success-message { margin:0; color:#075947; background:#e8f7f1; }
    :is(a,button):focus-visible { outline:3px solid rgb(7 85 184 / .28); outline-offset:2px; }
    @media(max-width:560px) { .page-header { align-items:flex-start; flex-direction:column; }.card-header h2 { font-size:1rem; }.status-actions > span { flex-basis:100%; } }
  `,
})
export class AdminLodgingInquiriesComponent implements OnInit {
  private readonly service = inject(LodgingInquiryService);
  protected readonly inquiries = signal<LodgingInquiry[]>([]);
  protected readonly loading = signal(true);
  protected readonly savingId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly activeFilter = signal<'all' | LodgingInquiryStatus>('all');
  protected readonly filters = [{ value: 'all', label: 'All' }, { value: 'new', label: 'New' }, { value: 'contacted', label: 'Contacted' }, { value: 'closed', label: 'Closed' }] as const;
  protected readonly filtered = computed(() => this.activeFilter() === 'all' ? this.inquiries() : this.inquiries().filter(item => item.status === this.activeFilter()));

  ngOnInit(): void { void this.load(); }
  protected async load(): Promise<void> {
    this.loading.set(true); this.errorMessage.set(null);
    try { this.inquiries.set(await this.service.listForAdmin()); }
    catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load lodging enquiries.'); }
    finally { this.loading.set(false); }
  }
  protected countFor(status: 'all' | LodgingInquiryStatus): number { return status === 'all' ? this.inquiries().length : this.inquiries().filter(item => item.status === status).length; }
  protected questionLabel(type: LodgingInquiry['question_type']): string { return ({ availability: 'Room availability', assisted_booking: 'Help with booking', booking_instructions: 'How to book', other: 'Other question' })[type]; }
  protected statusLabel(status: LodgingInquiryStatus): string { return ({ new: 'New', contacted: 'Contacted', closed: 'Closed' })[status]; }
  protected phoneHref(phone: string): string { return phone.replace(/[^+\d]/g, ''); }
  protected async updateStatus(item: LodgingInquiry, status: LodgingInquiryStatus): Promise<void> {
    if (this.savingId()) return;
    this.savingId.set(item.id); this.errorMessage.set(null); this.successMessage.set(null);
    try {
      await this.service.updateStatus(item.id, status);
      this.inquiries.update(rows => rows.map(row => row.id === item.id ? { ...row, status } : row));
      this.successMessage.set(`Enquiry from ${item.guest_name || 'guest'} marked ${status}.`);
    } catch (error) { this.errorMessage.set(error instanceof Error ? error.message : 'Unable to update this enquiry.'); }
    finally { this.savingId.set(null); }
  }
}
