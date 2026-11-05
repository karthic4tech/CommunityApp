import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MarketplaceListingCardComponent } from './marketplace-listing-card.component';
import { MarketplaceCategory, MarketplaceListing } from './marketplace.models';
import { MarketplaceService } from './marketplace.service';
import { DirectoryLocation, locationSearchOptions as buildLocationSearchOptions } from '../core/models/service-listing';
import { LanguageService } from '../core/services/language.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';

@Component({
  selector: 'app-marketplace-home',
  imports: [RouterLink, MarketplaceListingCardComponent, FormsModule, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mp-page container-xl" [attr.aria-busy]="categoriesLoading() || featuredLoading() || recentLoading()">
      <section class="mp-hero" aria-labelledby="mp-title">
        <div class="mp-hero-copy">
          <p class="mp-eyebrow"><i class="bi bi-shop-window" aria-hidden="true"></i> CDM 360 MARKETPLACE</p>
          <h1 id="mp-title">Buy & Sell Locally</h1>
          <p class="mp-tagline">Your Community. Your Marketplace.</p>
          <p class="mp-description">Discover products, explore local deals and connect directly with buyers and sellers in Chidambaram.</p>
          <a routerLink="/marketplace/sell" class="mp-sell-cta"><i class="bi bi-plus-lg" aria-hidden="true"></i> Sell an Item</a>
          <nav class="mp-account-links" aria-label="Your marketplace"><a routerLink="/marketplace/my-listings">My Advertisements</a><a routerLink="/marketplace/favourites">Favourites</a><a routerLink="/marketplace/my-enquiries">My Enquiries</a></nav>
        </div>
        <div class="mp-hero-art" aria-hidden="true"><span class="art-disc art-one"></span><span class="art-disc art-two"></span><i class="bi bi-bag-heart"></i><span class="art-label">LOCAL<br>FINDS</span></div>
        <form class="mp-search" (submit)="search($event, searchInput.value, locationSelect.value)">
          <label for="mp-query"><span>What are you looking for?</span><span class="mp-query-input"><i class="bi bi-search" aria-hidden="true"></i><input #searchInput id="mp-query" type="search" maxlength="100" [value]="query()" placeholder="Search phones, furniture, vehicles…"></span></label>
          <app-searchable-select #locationSelect="ngModel" name="marketplace-location" controlId="mp-location" label="Location"
            [options]="locationSearchOptions()" [ngModel]="selectedLocation()" [ngModelOptions]="{standalone:true}"
            [emptyValue]="''" [clearable]="true" placeholder="All locations" searchPlaceholder="Search localities in English or Tamil…" />
          <button type="submit" class="mp-search-button"><i class="bi bi-search" aria-hidden="true"></i> Search</button>
        </form>
      </section>

      <section class="mp-categories" aria-labelledby="mp-categories-title">
        <header class="mp-section-head"><div><p class="mp-eyebrow">BROWSE THE MARKET</p><h2 id="mp-categories-title">Shop by category</h2><p>Explore products from your community.</p></div><a routerLink="/marketplace" class="mp-view-link">All categories <i class="bi bi-arrow-right" aria-hidden="true"></i></a></header>
        @if (categoriesLoading()) { <p class="mp-state" role="status">Loading categories…</p> }
        @else if (error(); as message) { <div class="mp-state mp-error"><p role="alert">{{ message }}</p><button type="button" class="mp-secondary" (click)="load()">Try again</button></div> }
        @else if (categories().length) {
          <div class="mp-category-grid">
            @for (category of categories(); track category.id) {
              <a class="mp-category-tile" [routerLink]="['/marketplace/category', category.slug]"><span><i class="bi" [class]="category.icon || 'bi bi-grid'" aria-hidden="true"></i></span><strong>{{ category.name }}</strong><small>{{ category.subcategories.length }} subcategories</small></a>
            }
          </div>
        } @else { <p class="mp-state" role="status">No marketplace categories are available right now.</p> }
      </section>

      @if (searched()) {
        <section class="mp-results" aria-labelledby="mp-results-title" [attr.aria-busy]="searchLoading()">
          <header class="mp-section-head"><div><p class="mp-eyebrow">YOUR SEARCH</p><h2 id="mp-results-title">Marketplace results</h2><p>{{ resultCount() }} matching listings</p></div><button type="button" class="mp-text-button" (click)="clearSearch()">Clear search</button></header>
          @if (searchLoading()) { <p class="mp-state" role="status">Searching local listings…</p> }
          @else if (searchError()) { <p class="mp-state mp-error" role="alert">Unable to search listings. Please try again.</p> }
          @else if (searchResults().length) { <div class="mp-product-grid">@for (item of searchResults(); track item.id) { <app-marketplace-listing-card [listing]="item" [saved]="isSaved(item.id)" (favourite)="toggleFavourite($event)" /> }</div> }
          @else { <p class="mp-state" role="status">No published listings match your search. Try another product or location.</p> }
        </section>
      }

      <section class="mp-product-section" aria-labelledby="mp-featured-title" [attr.aria-busy]="featuredLoading()">
        <header class="mp-section-head"><div><p class="mp-eyebrow">HAND-PICKED FOR YOU</p><h2 id="mp-featured-title">Featured Deals</h2><p>Promoted listings from local sellers.</p></div></header>
        @if (featuredLoading()) { <p class="mp-state" role="status">Loading featured deals…</p> }
        @else if (featuredError()) { <p class="mp-state mp-error" role="alert">Featured deals could not be loaded.</p> }
        @else if (featured().length) { <div class="mp-product-grid">@for (item of featured(); track item.id) { <app-marketplace-listing-card [listing]="item" [saved]="isSaved(item.id)" (favourite)="toggleFavourite($event)" /> }</div> }
        @else { <p class="mp-state" role="status">No featured deals are available at the moment.</p> }
      </section>

      <section class="mp-product-section" aria-labelledby="mp-recent-title" [attr.aria-busy]="recentLoading()">
        <header class="mp-section-head"><div><p class="mp-eyebrow">FRESH FROM THE COMMUNITY</p><h2 id="mp-recent-title">Recently Listed</h2><p>New finds, listed by people around Chidambaram.</p></div></header>
        @if (recentLoading()) { <p class="mp-state" role="status">Loading recent listings…</p> }
        @else if (recentError()) { <p class="mp-state mp-error" role="alert">Recent listings could not be loaded.</p> }
        @else if (recent().length) { <div class="mp-product-grid">@for (item of recent(); track item.id) { <app-marketplace-listing-card [listing]="item" [saved]="isSaved(item.id)" (favourite)="toggleFavourite($event)" /> }</div> }
        @else { <p class="mp-state" role="status">No products have been published yet. Be the first to list an item.</p> }
      </section>

      @if (recentlyViewed().length) { <section class="mp-product-section" aria-labelledby="mp-viewed-title"><header class="mp-section-head"><div><p class="mp-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2 id="mp-viewed-title">Recently viewed</h2></div></header><div class="mp-product-grid">@for (item of recentlyViewed(); track item.id) { <app-marketplace-listing-card [listing]="item" [saved]="isSaved(item.id)" (favourite)="toggleFavourite($event)" /> }</div></section> }

      <section class="mp-local-panel" aria-labelledby="mp-local-title"><div><p class="mp-eyebrow">YOUR NEIGHBOURHOOD</p><h2 id="mp-local-title">Explore Local Deals</h2><p>Choose a locality to see listings nearby. We only use the location you select.</p></div><app-searchable-select controlId="local-deals-location" label="Choose a location for local deals" [options]="locationSearchOptions()" [value]="localLocation()" (valueChange)="setLocalLocation($event)" [emptyValue]="''" [clearable]="true" placeholder="Select a location" searchPlaceholder="Search localities…" />
        @if (localLocation()) { @if (localLoading()) { <p class="mp-state" role="status">Loading local deals…</p> } @else if (localListings().length) { <div class="mp-product-grid">@for (item of localListings(); track item.id) { <app-marketplace-listing-card [listing]="item" [saved]="isSaved(item.id)" (favourite)="toggleFavourite($event)" /> }</div> } @else { <p class="mp-state" role="status">No listings are published for this location yet.</p> } }
      </section>
      <p class="mp-disclaimer">CDM 360 helps buyers and sellers connect. Please verify items and sellers independently before payment or collection.</p>
    </div>
  `,
})
export class MarketplaceHomeComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly i18n = inject(LanguageService);
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly categories = signal<MarketplaceCategory[]>([]);
  protected readonly places = signal<DirectoryLocation[]>([]);
  protected readonly featured = signal<MarketplaceListing[]>([]);
  protected readonly recent = signal<MarketplaceListing[]>([]);
  protected readonly recentlyViewed = signal<MarketplaceListing[]>([]);
  protected readonly searchResults = signal<MarketplaceListing[]>([]);
  protected readonly localListings = signal<MarketplaceListing[]>([]);
  protected readonly favourites = signal<Set<string>>(new Set());
  protected readonly categoriesLoading = signal(true);
  protected readonly featuredLoading = signal(true);
  protected readonly recentLoading = signal(true);
  protected readonly searchLoading = signal(false);
  protected readonly localLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly featuredError = signal(false);
  protected readonly recentError = signal(false);
  protected readonly searchError = signal(false);
  protected readonly locationSearchOptions = computed(() => buildLocationSearchOptions(this.places(), this.i18n.language()));
  protected readonly query = computed(() => this.queryParams().get('q') ?? '');
  protected readonly selectedLocation = computed(() => this.queryParams().get('location') ?? '');
  protected readonly searched = computed(() => Boolean(this.query().trim() || this.selectedLocation()));
  protected readonly resultCount = computed(() => this.searchResults().length);
  protected readonly localLocation = signal('');

  constructor() {
    effect(() => {
      const q = this.query().trim(); const locationId = this.selectedLocation();
      if (!q && !locationId) { this.searchResults.set([]); this.searchLoading.set(false); return; }
      void this.runSearch(q, locationId);
    });
  }

  ngOnInit(): void { void this.load(); }

  protected async load(): Promise<void> {
    this.categoriesLoading.set(true); this.error.set(null);
    try { this.categories.set(await this.marketplace.categories()); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to load marketplace categories.'); }
    finally { this.categoriesLoading.set(false); }
    void this.directory.locations().then(rows => this.places.set(rows)).catch(() => this.places.set([]));
    void this.loadFeatured(); void this.loadRecent();
    void this.marketplace.recentlyViewed().then(items => this.recentlyViewed.set(items)).catch(() => this.recentlyViewed.set([]));
    if (this.marketplaceUser()) void this.marketplace.favoriteIds().then(ids => this.favourites.set(ids)).catch(() => undefined);
  }

  protected search(event: Event, q: string, locationId: string): void {
    event.preventDefault();
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: q.trim() || null, location: locationId || null } });
  }

  protected clearSearch(): void { void this.router.navigate([], { relativeTo: this.route, queryParams: { q: null, location: null } }); }
  protected setLocalLocation(value: string | null): void {
    const id = value ?? '';
    this.localLocation.set(id);
    if (id) void this.loadLocal(id); else this.localListings.set([]);
  }
  protected isSaved(id: string): boolean { return this.favourites().has(id); }

  protected async toggleFavourite(id: string): Promise<void> {
    if (!this.marketplaceUser()) { void this.router.navigate(['/auth/sign-in'], { queryParams: { returnUrl: '/marketplace' } }); return; }
    const saved = this.favourites().has(id);
    try {
      await this.marketplace.toggleFavourite(id, saved);
      this.favourites.update(current => { const next = new Set(current); saved ? next.delete(id) : next.add(id); return next; });
    } catch { /* The listing card remains usable; a later load can retry. */ }
  }

  private async loadFeatured(): Promise<void> {
    this.featuredLoading.set(true); this.featuredError.set(false);
    try { this.featured.set((await this.marketplace.search({ featuredOnly: true, sort: 'newest', pageSize: 8 })).items); }
    catch { this.featuredError.set(true); }
    finally { this.featuredLoading.set(false); }
  }
  private async loadRecent(): Promise<void> {
    this.recentLoading.set(true); this.recentError.set(false);
    try { this.recent.set((await this.marketplace.search({ sort: 'newest', pageSize: 8 })).items); }
    catch { this.recentError.set(true); }
    finally { this.recentLoading.set(false); }
  }
  private async runSearch(query: string, locationId: string): Promise<void> {
    this.searchLoading.set(true); this.searchError.set(false);
    try { this.searchResults.set((await this.marketplace.search({ query, locationId: locationId || null, sort: 'featured', pageSize: 12 })).items); }
    catch { this.searchError.set(true); }
    finally { this.searchLoading.set(false); }
  }
  private async loadLocal(locationId: string): Promise<void> {
    this.localLoading.set(true);
    try { this.localListings.set((await this.marketplace.search({ locationId, sort: 'newest', pageSize: 8 })).items); }
    catch { this.localListings.set([]); }
    finally { this.localLoading.set(false); }
  }
  private marketplaceUser(): boolean { return Boolean(this.marketplace.currentUserId()); }
}
