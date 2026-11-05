import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MarketplaceEnquiry } from './marketplace.models';
import { MarketplaceService } from './marketplace.service';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../shared/components/searchable-select/searchable-select.models';

@Component({
  selector: 'app-marketplace-enquiries',
  imports: [RouterLink, DatePipe, CurrencyPipe, FormsModule, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mp-page container-xl mp-dashboard" aria-labelledby="enquiries-title" [attr.aria-busy]="loading() || saving()">
      <header class="mp-dashboard-head"><div><p class="mp-eyebrow">BUYER & SELLER MESSAGES</p><h1 id="enquiries-title">My Enquiries</h1><p>Track buyer questions and messages you’ve sent to sellers.</p></div><a routerLink="/marketplace" class="mp-secondary">Marketplace</a></header>
      <nav class="mp-status-tabs" aria-label="Enquiry view"><button type="button" [class.active]="view() === 'buyer'" (click)="setView('buyer')">Sent enquiries</button><button type="button" [class.active]="view() === 'seller'" (click)="setView('seller')">Received enquiries</button></nav>
      @if (error()) { <p class="mp-state mp-error" role="alert">{{ error() }}</p> }
      @if (loading()) { <p class="mp-state" role="status">Loading enquiries…</p> }
      @else if (rows().length) {
        <section class="mp-enquiry-list">@for (item of rows(); track item.id) {
          <article class="mp-enquiry-card"><div class="mp-enquiry-head"><div><p class="mp-eyebrow">{{ view() === 'seller' ? 'BUYER ENQUIRY' : 'SENT ENQUIRY' }}</p><h2>{{ item.listing?.title || 'Marketplace item' }}</h2><p>{{ item.listing?.price | currency:'INR':'symbol':'1.0-0' }} · {{ item.created_at | date:'mediumDate' }}</p></div><span class="mp-listing-status" [class]="'mp-listing-status status-' + item.status">{{ item.status }}</span></div>
            <blockquote>{{ item.message }}</blockquote>
            @if (item.seller_response) { <div class="mp-seller-response"><strong>Seller response</strong><p>{{ item.seller_response }}</p></div> }
            @if (view() === 'seller' && item.status !== 'closed' && item.status !== 'spam') { <form class="mp-response-form" (submit)="respond($event,item.id,response.value,status.value)"><label [for]="'response-' + item.id">Reply to this enquiry</label><textarea #response [id]="'response-' + item.id" rows="2" maxlength="2000" placeholder="Write a short response…"></textarea><app-searchable-select #status="ngModel" [name]="'enquiry-status-' + item.id" [controlId]="'enquiry-status-' + item.id" label="Enquiry status" [options]="responseStatuses" [ngModel]="item.status === 'new' ? 'contacted' : item.status" [ngModelOptions]="{standalone:true}" [clearable]="false" searchPlaceholder="Search statuses…" /><button type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save response' }}</button></form> }
            @if (item.listing?.id) { <a class="mp-enquiry-link" [routerLink]="['/marketplace/item',item.listing?.id,item.listing?.slug]">View listing <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a> }
          </article>
        }</section>
      } @else { <div class="mp-empty"><i class="bi bi-chat-dots" aria-hidden="true"></i><h2>No enquiries yet</h2><p>{{ view() === 'seller' ? 'Buyer enquiries for your listings will appear here.' : 'When you message a seller, your enquiry will appear here.' }}</p><a routerLink="/marketplace" class="mp-primary-link">Browse listings</a></div> }
      @if (message()) { <p class="mp-success" role="status">{{ message() }}</p> }
    </main>
  `,
})
export class MarketplaceEnquiriesComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  protected readonly view = signal<'buyer'|'seller'>('buyer');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly rows = signal<MarketplaceEnquiry[]>([]);
  protected readonly responseStatuses: readonly SearchableSelectOption[] = [
    {value:'contacted',label:'Contacted'},{value:'negotiating',label:'Negotiating'},
    {value:'closed',label:'Close enquiry'},{value:'spam',label:'Mark as spam'},
  ];
  ngOnInit(): void { void this.load(); }
  protected setView(view: 'buyer'|'seller'): void { this.view.set(view); void this.load(); }
  private async load(): Promise<void> { this.loading.set(true); this.error.set(null); try { this.rows.set(await this.marketplace.enquiries(this.view() === 'seller')); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to load enquiries.'); } finally { this.loading.set(false); } }
  protected async respond(event: Event, id: string, response: string, status: string): Promise<void> {
    event.preventDefault(); this.saving.set(true); this.message.set(null); this.error.set(null);
    try { await this.marketplace.respondToEnquiry(id,response,status); this.message.set('Enquiry response saved.'); await this.load(); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to respond to this enquiry.'); }
    finally { this.saving.set(false); }
  }
}
