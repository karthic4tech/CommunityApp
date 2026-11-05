import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MarketplaceListing, MarketplaceStatus } from './marketplace.models';
import { MarketplaceService } from './marketplace.service';

@Component({
  selector: 'app-my-marketplace-listings',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mp-page container-xl mp-dashboard" aria-labelledby="my-marketplace-title" [attr.aria-busy]="loading() || saving()">
      <header class="mp-dashboard-head"><div><p class="mp-eyebrow">SELLER DASHBOARD</p><h1 id="my-marketplace-title">My Advertisements</h1><p>Manage your products, check their review status and keep your listings up to date.</p></div><a routerLink="/marketplace/sell" class="mp-primary-link"><i class="bi bi-plus-lg" aria-hidden="true"></i> Sell an Item</a></header>
      @if (error()) { <p class="mp-state mp-error" role="alert">{{ error() }}</p> }
      @if (stats(); as summary) { <section class="mp-stats" aria-label="Listing summary"><article><span>Total Listings</span><strong>{{ summary.total }}</strong></article><article><span>Active</span><strong>{{ summary.active }}</strong></article><article><span>Pending Approval</span><strong>{{ summary.pending }}</strong></article><article><span>Sold Items</span><strong>{{ summary.sold }}</strong></article><article><span>Drafts</span><strong>{{ summary.drafts }}</strong></article><article><span>Expired</span><strong>{{ summary.expired }}</strong></article></section> }
      <nav class="mp-status-tabs" aria-label="Filter my listings">
        @for (tab of tabs; track tab.value) { <button type="button" [class.active]="activeStatus() === tab.value" (click)="selectStatus(tab.value)">{{ tab.label }}</button> }
      </nav>
      @if (loading()) { <p class="mp-state" role="status">Loading your advertisements…</p> }
      @else if (items().length) {
        <section class="mp-seller-list" aria-label="Your marketplace listings">
          @for (item of items(); track item.id) {
            <article class="mp-seller-row">
              <a class="mp-seller-thumb" [routerLink]="['/marketplace/item',item.id,item.slug]">@if (primaryImage(item); as image) { <img [src]="image" [alt]="item.title" loading="lazy"> } @else { <i class="bi bi-image" aria-hidden="true"></i> }</a>
              <div class="mp-seller-info"><a [routerLink]="['/marketplace/item',item.id,item.slug]"><h2>{{ item.title }}</h2></a><strong>{{ item.price | currency:'INR':'symbol':'1.0-0' }}</strong><small>{{ item.category?.name }} · {{ item.created_at | date:'mediumDate' }}</small>@if (item.status === 'rejected' && item.rejection_reason) { <p class="mp-rejection">Review note: {{ item.rejection_reason }}</p> }</div>
              <span class="mp-listing-status" [class]="'mp-listing-status status-' + item.status">{{ statusLabel(item) }}</span>
              <div class="mp-seller-actions">
                @if (item.status === 'draft' || item.status === 'rejected') { <a [routerLink]="['/marketplace/edit',item.id]">Edit</a> }
                @if (item.status === 'published' && !isExpired(item)) { <a [routerLink]="['/marketplace/item',item.id,item.slug]">Preview</a><a routerLink="/marketplace/my-enquiries">View Enquiries</a><button type="button" (click)="markSold(item)" [disabled]="saving()">Mark Sold</button> }
                @if (isExpired(item)) { <button type="button" (click)="renew(item)" [disabled]="saving()">Renew</button> }
                @if (item.status === 'draft' || item.status === 'rejected' || item.status === 'sold' || isExpired(item)) { <button type="button" class="text-action" (click)="archive(item)" [disabled]="saving()">Archive</button> }
              </div>
            </article>
          }
        </section>
      } @else { <div class="mp-empty"><i class="bi bi-bag" aria-hidden="true"></i><h2>No listings in this tab</h2><p>Your advertisements will appear here as you create them.</p><a routerLink="/marketplace/sell" class="mp-primary-link">Sell an Item</a></div> }
      @if (items().length) { <nav class="mp-pagination" aria-label="My listing pages"><button type="button" [disabled]="page() <= 1" (click)="changePage(page()-1)">Previous</button><span>Page {{ page() }}</span><button type="button" [disabled]="page() * pageSize >= total()" (click)="changePage(page()+1)">Next</button></nav> }
    </main>
  `,
})
export class MyMarketplaceListingsComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly document = inject(DOCUMENT);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<MarketplaceListing[]>([]);
  protected readonly total = signal(0);
  protected readonly stats = signal<{ total: number; active: number; pending: number; sold: number; drafts: number; rejected: number; expired: number } | null>(null);
  protected readonly activeStatus = signal<'all' | 'active' | MarketplaceStatus>('all');
  protected readonly page = signal(1);
  protected readonly pageSize = 12;
  protected readonly tabs: { value: 'all' | 'active' | MarketplaceStatus; label: string }[] = [
    { value:'all',label:'All' },{ value:'active',label:'Active' },{ value:'pending_approval',label:'Pending' },
    { value:'draft',label:'Drafts' },{ value:'sold',label:'Sold' },{ value:'expired',label:'Expired' },{ value:'rejected',label:'Rejected' },
  ];
  ngOnInit(): void { void this.load(); }
  protected async load(): Promise<void> {
    this.loading.set(true); this.error.set(null);
    try {
      const selectedStatus = this.activeStatus();
      const status: MarketplaceStatus | null = selectedStatus === 'all' ? null : selectedStatus === 'active' ? 'published' : selectedStatus;
      const [summary, page] = await Promise.all([
        this.marketplace.myListingStats(), this.marketplace.search({ includeMine:true, status, activeOnly:selectedStatus === 'active', page:this.page(), pageSize:this.pageSize, sort:'newest' }),
      ]);
      this.stats.set(summary); this.items.set(page.items); this.total.set(page.total);
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to load your advertisements.'); }
    finally { this.loading.set(false); }
  }
  protected selectStatus(status: 'all' | 'active' | MarketplaceStatus): void { this.activeStatus.set(status); this.page.set(1); void this.load(); }
  protected changePage(page: number): void { this.page.set(page); void this.load(); }
  protected async markSold(item: MarketplaceListing): Promise<void> {
    if (!(this.document.defaultView?.confirm(`Mark “${item.title}” as sold?`) ?? false)) return;
    this.saving.set(true); this.error.set(null);
    try { await this.marketplace.markSold(item.id); await this.load(); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to mark the listing sold.'); }
    finally { this.saving.set(false); }
  }
  protected async archive(item: MarketplaceListing): Promise<void> {
    if (!(this.document.defaultView?.confirm(`Archive “${item.title}”?`) ?? false)) return;
    this.saving.set(true); this.error.set(null);
    try { await this.marketplace.archive(item.id); await this.load(); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to archive the listing.'); }
    finally { this.saving.set(false); }
  }
  protected async renew(item: MarketplaceListing): Promise<void> {
    this.saving.set(true); this.error.set(null);
    try { await this.marketplace.renew(item.id); await this.load(); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to renew this listing.'); }
    finally { this.saving.set(false); }
  }
  protected primaryImage(item: MarketplaceListing): string | null { const rows = item.images ?? []; return rows.find(row=>row.is_primary)?.url ?? rows[0]?.url ?? null; }
  protected isExpired(item: MarketplaceListing): boolean { return item.status === 'expired' || (item.status === 'published' && Boolean(item.expires_at && Date.parse(item.expires_at) <= Date.now())); }
  protected statusLabel(item: MarketplaceListing): string { if (this.isExpired(item)) return 'Expired'; return ({ draft:'Draft',pending_approval:'Pending approval',published:'Active',rejected:'Rejected',sold:'Sold',expired:'Expired',suspended:'Suspended',archived:'Archived' } as const)[item.status]; }
}
