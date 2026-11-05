import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MarketplaceListingCardComponent } from './marketplace-listing-card.component';
import { MarketplaceCategory, MarketplaceListing, MarketplacePage } from './marketplace.models';
import { MarketplaceService } from './marketplace.service';
import { DirectoryLocation, locationSearchOptions as buildLocationSearchOptions } from '../core/models/service-listing';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../shared/components/searchable-select/searchable-select.models';

@Component({
  selector: 'app-marketplace-category',
  imports: [RouterLink, MarketplaceListingCardComponent, FormsModule, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mp-page container-xl" [attr.aria-busy]="loading() || resultsLoading()">
      <nav class="mp-breadcrumb" aria-label="Breadcrumb"><a routerLink="/marketplace">Marketplace</a><i class="bi bi-chevron-right" aria-hidden="true"></i><span>{{ category()?.name || 'Category' }}</span></nav>
      @if (loading()) { <section class="mp-category-hero"><p class="mp-eyebrow">MARKETPLACE CATEGORY</p><p class="mp-state" role="status">Loading category…</p></section> }
      @else if (error()) { <section class="mp-category-hero"><p class="mp-eyebrow">MARKETPLACE</p><h1>Category unavailable</h1><p role="alert">{{ error() }}</p><a routerLink="/marketplace" class="mp-primary-link">Back to Marketplace</a></section> }
      @else if (category(); as selected) {
        <header class="mp-category-hero"><div class="mp-category-icon"><i class="bi" [class]="selected.icon || 'bi bi-grid'" aria-hidden="true"></i></div><div><p class="mp-eyebrow">LOCAL MARKETPLACE</p><h1>{{ selected.name }}</h1><p>{{ selected.description || 'Discover local listings and deals in this category.' }}</p></div><span class="mp-category-count">{{ selected.subcategories.length }} subcategories</span></header>
        @if (selected.subcategories.length) { <nav class="mp-subcategory-nav" aria-label="Subcategories"><a [routerLink]="['/marketplace/category', selected.slug]" [class.active]="!selected.parent_id">All {{ selected.name }}</a>@for (child of selected.subcategories; track child.id) { <a [routerLink]="['/marketplace/category', child.slug]">{{ child.name }}</a> }</nav> }

        <form class="mp-filter-bar" (submit)="applyFilters($event, keyword.value, location.value, condition.value, sort.value, minPrice.value, maxPrice.value)">
          <label class="mp-filter-search" for="market-category-search"><span class="visually-hidden">Search within {{ selected.name }}</span><i class="bi bi-search" aria-hidden="true"></i><input #keyword id="market-category-search" type="search" [value]="query()" placeholder="Search this category"></label>
          <app-searchable-select #location="ngModel" name="marketplace-category-location" controlId="market-category-location" label="Location" [options]="locationSearchOptions()" [ngModel]="locationFilter()" [ngModelOptions]="{standalone:true}" [emptyValue]="''" [clearable]="true" placeholder="All locations" searchPlaceholder="Search localities in English or Tamil…" />
          <app-searchable-select #condition="ngModel" name="marketplace-condition" controlId="market-condition" label="Condition"
            [options]="conditionOptions" [ngModel]="conditionFilter()" [ngModelOptions]="{standalone:true}"
            [emptyValue]="''" [clearable]="true" placeholder="Any condition" searchPlaceholder="Search conditions…" />
          <label for="market-min-price"><span class="visually-hidden">Minimum price</span><input #minPrice id="market-min-price" type="number" min="0" [value]="minPriceFilter()" placeholder="Min ₹"></label>
          <label for="market-max-price"><span class="visually-hidden">Maximum price</span><input #maxPrice id="market-max-price" type="number" min="0" [value]="maxPriceFilter()" placeholder="Max ₹"></label>
          <label for="market-sort"><span class="visually-hidden">Sort listings</span><select #sort id="market-sort" [value]="sortFilter()"><option value="newest">Newest first</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option></select></label>
          <button type="submit" class="mp-search-button">Apply filters</button>
          <button type="button" class="mp-clear-button" (click)="clearFilters()">Clear</button>
        </form>

        <section class="mp-results" aria-labelledby="mp-category-results" [attr.aria-busy]="resultsLoading()">
          <header class="mp-section-head"><div><p class="mp-eyebrow">LOCAL LISTINGS</p><h2 id="mp-category-results">{{ selected.name }} for sale</h2></div><span>{{ results().total }} results</span></header>
          @if (resultsLoading()) { <p class="mp-state" role="status">Loading marketplace listings…</p> }
          @else if (resultsError()) { <div class="mp-state mp-error" role="alert">Could not load listings. <button type="button" class="mp-secondary" (click)="retry()">Try again</button></div> }
          @else if (results().items.length) {
            <div class="mp-product-grid">@for (item of results().items; track item.id) { <app-marketplace-listing-card [listing]="item" [saved]="savedIds().has(item.id)" (favourite)="toggleFavourite($event)" /> }</div>
            @if (results().total > pageSize) { <nav class="mp-pagination" aria-label="Marketplace pages"><button type="button" [disabled]="page() <= 1" (click)="changePage(page() - 1)">Previous</button><span>Page {{ page() }}</span><button type="button" [disabled]="page() * pageSize >= results().total" (click)="changePage(page() + 1)">Next</button></nav> }
          } @else { <div class="mp-empty"><i class="bi bi-search" aria-hidden="true"></i><h3>No matching listings yet</h3><p>Try a different search or check back later.</p><a routerLink="/marketplace/sell">Sell an item in this category</a></div> }
        </section>
      }
    </main>
  `,
})
export class MarketplaceCategoryComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly categories = signal<MarketplaceCategory[]>([]);
  protected readonly places = signal<DirectoryLocation[]>([]);
  protected readonly category = signal<MarketplaceCategory | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly results = signal<MarketplacePage>({ items: [], total: 0, page: 1, pageSize: 12 });
  protected readonly resultsLoading = signal(true);
  protected readonly resultsError = signal(false);
  protected readonly savedIds = signal<Set<string>>(new Set());
  protected readonly query = computed(() => this.queryParams().get('q') ?? '');
  protected readonly locationFilter = computed(() => this.queryParams().get('location') ?? '');
  protected readonly conditionFilter = computed(() => this.queryParams().get('condition') ?? '');
  protected readonly minPriceFilter = computed(() => this.queryParams().get('minPrice') ?? '');
  protected readonly maxPriceFilter = computed(() => this.queryParams().get('maxPrice') ?? '');
  protected readonly sortFilter = computed(() => this.queryParams().get('sort') ?? 'newest');
  protected readonly page = computed(() => Math.max(1, Number(this.queryParams().get('page') ?? 1) || 1));
  protected readonly locationSearchOptions = computed(() => buildLocationSearchOptions(this.places(), 'en'));
  protected readonly pageSize = 12;
  protected readonly conditions = [
    { value: 'brand_new', label: 'Brand New' }, { value: 'like_new', label: 'Like New' },
    { value: 'gently_used', label: 'Gently Used' }, { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' }, { value: 'for_parts', label: 'For Parts / Repair' },
  ] as const;
  protected readonly conditionOptions: readonly SearchableSelectOption[] = this.conditions.map(item => ({value:item.value,label:item.label,searchText:item.label}));
  private retryCount = signal(0);

  constructor() {
    effect(onCleanup => {
      const selected = this.category();
      const page = this.page(); const q = this.query(); const location = this.locationFilter();
      const condition = this.conditionFilter(); const sort = this.sortFilter(); this.retryCount();
      const minPrice = Number(this.minPriceFilter()); const maxPrice = Number(this.maxPriceFilter());
      let active = true; onCleanup(() => { active = false; });
      if (!selected || this.loading()) { this.resultsLoading.set(false); return; }
      this.resultsLoading.set(true); this.resultsError.set(false);
      const rootId = selected.parent_id ?? selected.id;
      void this.marketplace.search({
        query: q, categoryId: rootId, subcategoryId: selected.parent_id ? selected.id : null,
        locationId: location || null, condition: (condition || null) as MarketplaceListing['condition'] | null,
        minPrice: this.minPriceFilter() ? minPrice : null, maxPrice: this.maxPriceFilter() ? maxPrice : null,
        sort: sort as 'newest' | 'price_low' | 'price_high', page, pageSize: this.pageSize,
      }).then(result => { if (active) this.results.set(result); })
        .catch(() => { if (active) this.resultsError.set(true); })
        .finally(() => { if (active) this.resultsLoading.set(false); });
    });
  }

  ngOnInit(): void { void this.load(); }

  private async load(): Promise<void> {
    this.loading.set(true); this.error.set(null);
    try {
      const [tree, locations] = await Promise.all([this.marketplace.categories(), this.directory.locations()]);
      this.categories.set(tree); this.places.set(locations);
      const found = this.findCategory(tree, this.params().get('slug') ?? '');
      this.category.set(found ?? null);
      if (!found) this.error.set('This category is not available.');
    } catch { this.error.set('Unable to load marketplace categories.'); }
    finally { this.loading.set(false); }
    if (this.marketplace.currentUserId()) void this.marketplace.favoriteIds().then(ids => this.savedIds.set(ids)).catch(() => undefined);
  }

  protected applyFilters(event: Event, q: string, location: string, condition: string, sort: string, minPrice: string, maxPrice: string): void {
    event.preventDefault();
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: q.trim() || null, location: location || null, condition: condition || null, minPrice: minPrice || null, maxPrice: maxPrice || null, sort: sort || 'newest', page: null } });
  }
  protected clearFilters(): void { void this.router.navigate([], { relativeTo: this.route, queryParams: { q: null, location: null, condition: null, minPrice: null, maxPrice: null, sort: 'newest', page: null } }); }
  protected changePage(page: number): void { void this.router.navigate([], { relativeTo: this.route, queryParamsHandling: 'merge', queryParams: { page } }); }
  protected retry(): void { this.retryCount.update(n => n + 1); }
  protected async toggleFavourite(id: string): Promise<void> {
    if (!this.marketplace.currentUserId()) { void this.router.navigate(['/auth/sign-in'], { queryParams: { returnUrl: this.router.url } }); return; }
    const saved = this.savedIds().has(id);
    try { await this.marketplace.toggleFavourite(id, saved); this.savedIds.update(ids => { const next = new Set(ids); saved ? next.delete(id) : next.add(id); return next; }); }
    catch { /* Keep the page in place so the user can retry. */ }
  }
  private findCategory(items: readonly MarketplaceCategory[], slug: string): MarketplaceCategory | undefined {
    for (const item of items) { if (item.slug === slug) return item; const match = this.findCategory(item.subcategories, slug); if (match) return match; }
    return undefined;
  }
}
