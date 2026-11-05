import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketplaceListingCardComponent } from './marketplace-listing-card.component';
import { MarketplaceListing } from './marketplace.models';
import { MarketplaceService } from './marketplace.service';

@Component({
  selector: 'app-marketplace-favourites',
  imports: [RouterLink, MarketplaceListingCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mp-page container-xl mp-dashboard" aria-labelledby="favourites-title" [attr.aria-busy]="loading()">
      <header class="mp-dashboard-head"><div><p class="mp-eyebrow">YOUR SAVED FINDS</p><h1 id="favourites-title">My Favourites</h1><p>Keep the listings you’re interested in close by.</p></div><a routerLink="/marketplace" class="mp-secondary">Browse Marketplace</a></header>
      @if (error()) { <p class="mp-state mp-error" role="alert">{{ error() }}</p> }
      @if (loading()) { <p class="mp-state" role="status">Loading your favourites…</p> }
      @else if (items().length) { <div class="mp-product-grid">@for (item of items(); track item.id) { <app-marketplace-listing-card [listing]="item" [saved]="true" (favourite)="remove($event)" /> }</div> }
      @else { <div class="mp-empty"><i class="bi bi-heart" aria-hidden="true"></i><h2>No saved listings yet</h2><p>Tap the heart on a listing to save it here.</p><a routerLink="/marketplace" class="mp-primary-link">Explore Marketplace</a></div> }
      @if (total() > pageSize) { <nav class="mp-pagination" aria-label="Favourite pages"><button type="button" [disabled]="page() <= 1" (click)="changePage(page()-1)">Previous</button><span>Page {{ page() }}</span><button type="button" [disabled]="page() * pageSize >= total()" (click)="changePage(page()+1)">Next</button></nav> }
    </main>
  `,
})
export class MarketplaceFavouritesComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<MarketplaceListing[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = 12;
  ngOnInit(): void { void this.load(); }
  protected async load(): Promise<void> {
    this.loading.set(true); this.error.set(null);
    try { const result = await this.marketplace.favourites(this.page()); this.items.set(result.items); this.total.set(result.total); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to load favourites.'); }
    finally { this.loading.set(false); }
  }
  protected async remove(id: string): Promise<void> { try { await this.marketplace.toggleFavourite(id, true); await this.load(); } catch { this.error.set('Unable to remove this favourite.'); } }
  protected changePage(page: number): void { this.page.set(page); void this.load(); }
}
