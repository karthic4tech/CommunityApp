import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { DirectoryLocation, DirectoryPage, locationOptions } from '../core/models/service-listing';
import { ServiceCategory } from '../core/models/service-category';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { CategoryCardComponent } from '../home/category-card.component';
import { ListingSummaryComponent } from './listing-summary/listing-summary.component';

@Component({
  selector: 'app-services',
  imports: [CategoryCardComponent, ListingSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="categories-title" [attr.aria-busy]="service.loading() || listingsLoading()">
      <div class="section-heading"><div>
        <p class="section-kicker">{{ i18n.language() === 'ta' ? 'உங்களுக்காகத் தேர்ந்தெடுக்கப்பட்டது' : 'MADE FOR YOUR COMMUNITY' }}</p>
        <h1 id="categories-title">{{ i18n.text().categories }}</h1>
      </div><span class="category-count" aria-live="polite">{{ filteredCategories().length }} {{ i18n.language() === 'ta' ? 'வகைகள்' : 'categories' }}</span></div>

      <form class="service-search" (submit)="applyFilters($event, query.value, category.value, location.value)">
        <label class="keyword-field" for="service-query">
          {{ i18n.language() === 'ta' ? 'சேவைப் பட்டியல் பெயர்' : 'Service listing name' }}
          <div class="keyword-control">
            <input #query id="service-query" type="search" maxlength="200" [value]="searchTerm()" [placeholder]="i18n.language() === 'ta' ? 'சேவைப் பட்டியல் பெயரைத் தேடுங்கள்' : 'Search by service listing name'">
            <button type="submit">{{ i18n.language() === 'ta' ? 'தேடுக' : 'Search listings' }}</button>
          </div>
        </label>

        <div class="advanced-filters" aria-labelledby="filters-title">
          <h2 id="filters-title">{{ i18n.language() === 'ta' ? 'மேம்பட்ட வடிகட்டிகள்' : 'Advanced filters' }}</h2>
          <div class="filter-controls">
            <label for="service-category-filter">
              {{ i18n.language() === 'ta' ? 'சேவை வகை' : 'Service category' }}
              <select #category id="service-category-filter" [value]="categoryFilter()">
                <option value="">{{ i18n.language() === 'ta' ? 'அனைத்து வகைகளும்' : 'All categories' }}</option>
                @for (option of categoryOptions(); track option.id) { <option [value]="option.id" [selected]="categoryFilter() === option.id">{{ option.label }}</option> }
              </select>
            </label>
            <label for="service-location-filter">
              {{ i18n.language() === 'ta' ? 'இடம்' : 'Location' }}
              <select #location id="service-location-filter" [value]="locationFilter()" [disabled]="locationsLoading() || locationsError()">
                <option value="">{{ i18n.language() === 'ta' ? 'அனைத்து இடங்களும்' : 'All locations' }}</option>
                @for (place of places(); track place.id) { <option [value]="place.id" [selected]="locationFilter() === place.id">{{ place.label }}</option> }
              </select>
              @if (locationsError()) { <span class="field-note" role="status">{{ i18n.language() === 'ta' ? 'இடங்களை ஏற்ற முடியவில்லை.' : 'Locations could not be loaded.' }}</span> }
            </label>
            <button class="clear-button" type="button" (click)="clearFilters()">{{ i18n.language() === 'ta' ? 'அனைத்தையும் நீக்கு' : 'Clear filters' }}</button>
          </div>
        </div>
      </form>

      @if (hasDirectoryFilters()) {
        <section class="listing-results" aria-labelledby="listing-results-title" [attr.aria-busy]="listingsLoading()">
          <div class="results-heading"><h2 id="listing-results-title">{{ i18n.language() === 'ta' ? 'பொருந்தும் சேவைகள்' : 'Matching service listings' }}</h2>
            @if (!listingsLoading() && !listingsError()) { <span>{{ listingResults().listings.length }} {{ i18n.language() === 'ta' ? 'சேவைகள்' : 'results' }}</span> }
          </div>
          @if (listingsLoading()) {
            <p class="state" role="status">{{ i18n.language() === 'ta' ? 'சேவைகள் தேடப்படுகின்றன…' : 'Searching published services…' }}</p>
          } @else if (listingsError()) {
            <div class="state"><p role="alert">{{ i18n.language() === 'ta' ? 'சேவைகளைத் தேட முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to search services. Please try again.' }}</p><button type="button" (click)="retrySearch()">{{ i18n.text().retry }}</button></div>
          } @else if (!listingResults().listings.length) {
            <div class="state"><p role="status">{{ i18n.language() === 'ta' ? 'பொருந்தும் சேவைகள் கிடைக்கவில்லை. வேறு பெயர் அல்லது இடத்தை முயற்சிக்கவும்.' : 'No matching service listings. Try another name, category or location.' }}</p></div>
          } @else {
            <div class="listings">
              @for (listing of listingResults().listings; track listing.id) { <app-listing-summary [listing]="listing" /> }
            </div>
            @if (listingPage() > 0 || listingResults().hasMore) {
              <nav class="pagination" [attr.aria-label]="i18n.language() === 'ta' ? 'சேவை பக்கங்கள்' : 'Service listing pages'">
                <button type="button" [disabled]="listingPage() === 0 || listingsLoading()" (click)="changePage(listingPage() - 1)">{{ i18n.language() === 'ta' ? 'முந்தைய' : 'Previous' }}</button>
                <span>{{ i18n.language() === 'ta' ? 'பக்கம்' : 'Page' }} {{ listingPage() + 1 }}</span>
                <button type="button" [disabled]="!listingResults().hasMore || listingsLoading()" (click)="changePage(listingPage() + 1)">{{ i18n.language() === 'ta' ? 'அடுத்த' : 'Next' }}</button>
              </nav>
            }
          }
        </section>
      }

      <section class="category-results" aria-labelledby="category-results-title">
        <div class="results-heading"><h2 id="category-results-title">{{ i18n.language() === 'ta' ? 'வகைகள் மூலம் உலாவுக' : 'Browse by category' }}</h2></div>
        @if (service.loading()) {
          <div class="state"><p role="status">{{ i18n.text().loading }}</p></div>
        } @else if (service.error()) {
          <div class="state"><p role="alert">{{ i18n.text().error }}</p><button type="button" (click)="service.refresh()">{{ i18n.text().retry }}</button></div>
        } @else if (filteredCategories().length) {
          <div class="categories">
            @for (categoryItem of filteredCategories(); track categoryItem.id) { <app-category-card [category]="categoryItem" /> }
          </div>
        } @else if (!searchTerm().trim() || (!listingsLoading() && !listingResults().listings.length)) {
          <div class="state"><p role="status">{{ searchTerm().trim() ? (i18n.language() === 'ta' ? 'பொருத்தமான சேவைகள் கிடைக்கவில்லை. வேறு சொல்லை முயற்சிக்கவும்.' : 'No matching services or categories. Try another search.') : i18n.text().empty }}</p>
            @if (searchTerm().trim() || categoryFilter() || locationFilter()) { <button type="button" (click)="clearFilters()">{{ i18n.language() === 'ta' ? 'வடிகட்டிகளை நீக்கு' : 'Clear filters' }}</button> }
            @else { <button type="button" (click)="service.refresh()">{{ i18n.text().refresh }}</button> }
          </div>
        }
      </section>
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }
    .section-heading,.results-heading { display:flex; align-items:end; justify-content:space-between; gap:1rem; }
    .section-heading { margin-bottom:1.1rem; }
    .section-kicker { color:#52665b; font-size:.7rem; font-weight:800; letter-spacing:.12em; margin:0 0 .25rem; }
    h1 { color:#173f32; font-size:clamp(1.5rem,2.5vw,2rem); margin:0; }
    h2 { color:#173f32; font-size:1.15rem; margin:0; }
    .category-count,.results-heading span { color:#52665b; font-size:.85rem; }
    .service-search { display:grid; gap:1rem; margin-bottom:1.75rem; padding:1.1rem; border:1px solid #dfe7e2; border-radius:16px; background:#fff; }
    label { display:grid; gap:.45rem; color:#294c3d; font-weight:650; }
    .keyword-control { display:flex; gap:.6rem; }
    input,select { box-sizing:border-box; width:100%; min-width:0; min-height:48px; border:1px solid #b8c9bf; border-radius:10px; padding:.7rem .85rem; background:white; color:#173f32; font:inherit; }
    input::placeholder { color:#66786f; }
    button { min-height:44px; border:1px solid #075541; border-radius:9px; background:#075541; color:white; padding:.7rem 1rem; font:inherit; font-weight:700; cursor:pointer; }
    button:disabled { opacity:.58; cursor:not-allowed; }
    .advanced-filters { padding-top:.9rem; border-top:1px solid #e8eee9; }
    .advanced-filters h2 { margin-bottom:.75rem; font-size:1rem; }
    .filter-controls { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)) auto; align-items:end; gap:.75rem; }
    .clear-button { color:#14563d; border-color:#b8c9bf; background:#fff; }
    .field-note { color:#a13c2d; font-size:.85rem; font-weight:500; }
    .listing-results,.category-results { margin-top:1.5rem; }
    .results-heading { margin-bottom:.9rem; }
    .listings,.categories { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; align-items:stretch; }
    .state { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; padding:1.25rem; border:1px solid #dfe7e2; border-radius:16px; background:white; color:#536b60; line-height:1.8; }
    .pagination { display:flex; align-items:center; justify-content:center; gap:1rem; margin-top:1.25rem; }
    .pagination span { color:#52665b; }
    :is(input,select,button):focus-visible { outline:3px solid #176044; outline-offset:3px; }
    @media (max-width:1000px) { .listings,.categories { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:650px) {
      .listings,.categories { grid-template-columns:1fr; gap:.75rem; }
      .section-heading { align-items:start; }
      .keyword-control { align-items:stretch; flex-direction:column; }
      .filter-controls { grid-template-columns:1fr; }
      .filter-controls button { justify-self:start; }
    }
  `,
})
export class ServicesComponent implements OnInit {
  protected readonly service = inject(ServiceCategoryService);
  protected readonly i18n = inject(LanguageService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly searchAttempt = signal(0);
  private readonly locationRows = signal<DirectoryLocation[]>([]);
  private locationRequest?: Promise<DirectoryLocation[]>;
  protected readonly locationsLoading = signal(true);
  protected readonly locationsError = signal(false);
  protected readonly searchTerm = computed(() => this.queryParams().get('q') ?? '');
  protected readonly categoryFilter = computed(() => this.queryParams().get('category') ?? '');
  protected readonly locationFilter = computed(() => this.queryParams().get('location') ?? '');
  protected readonly listingPage = computed(() => {
    const page = Number(this.queryParams().get('page') ?? 1);
    return Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page - 1 : 0;
  });
  protected readonly hasDirectoryFilters = computed(() => Boolean(this.searchTerm().trim() || this.categoryFilter() || this.locationFilter()));
  protected readonly filteredCategories = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    return term ? this.service.categories().filter(categoryItem => this.matchesCategory(categoryItem, term)) : this.service.categories();
  });
  protected readonly categoryOptions = computed(() => {
    const options: { id: string; label: string }[] = [];
    const language = this.i18n.language();
    const visit = (items: readonly ServiceCategory[], prefix = ''): void => {
      for (const item of items) {
        const name = language === 'ta' ? item.nameTamil : item.nameEnglish;
        options.push({ id: item.id, label: prefix ? `${prefix} / ${name}` : name });
        visit(item.subcategories, prefix ? `${prefix} / ${name}` : name);
      }
    };
    visit(this.service.categories());
    return options;
  });
  protected readonly places = computed(() => locationOptions(this.locationRows(), this.i18n.language()));
  protected readonly listingResults = signal<DirectoryPage>({ listings: [], hasMore: false });
  protected readonly listingsLoading = signal(false);
  protected readonly listingsError = signal(false);

  constructor() {
    effect(onCleanup => {
      const keyword = this.searchTerm().trim().slice(0, 200);
      const categoryId = this.categoryFilter();
      const locationId = this.locationFilter();
      const page = this.listingPage();
      this.searchAttempt();
      let current = true;
      onCleanup(() => { current = false; });

      if (!keyword && !categoryId && !locationId) {
        this.listingResults.set({ listings: [], hasMore: false });
        this.listingsLoading.set(false);
        this.listingsError.set(false);
        return;
      }

      this.listingsLoading.set(true);
      this.listingsError.set(false);
      this.listingResults.set({ listings: [], hasMore: false });
      void this.ensureLocations().then(locations => {
        if (locationId && !locations.some(place => place.id === locationId)) throw new Error('Invalid location filter.');
        return this.directory.search(categoryId || null, locationId || null, keyword, page);
      }).then(result => { if (current) this.listingResults.set(result); })
        .catch(() => { if (current) this.listingsError.set(true); })
        .finally(() => { if (current) this.listingsLoading.set(false); });
    });
  }

  ngOnInit(): void {
    void this.service.load();
    void this.ensureLocations().catch(() => this.locationsError.set(true));
  }

  protected applyFilters(event: Event, keyword: string, categoryId: string, locationId: string): void {
    event.preventDefault();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: keyword.trim().slice(0, 200) || null, category: categoryId || null, location: locationId || null, page: null },
    });
  }

  protected clearFilters(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: null, category: null, location: null, page: null } });
  }

  protected retrySearch(): void { this.searchAttempt.update(value => value + 1); }

  protected changePage(page: number): void {
    void this.router.navigate([], { relativeTo: this.route, queryParamsHandling: 'merge', queryParams: { page: page > 0 ? page + 1 : null } });
  }

  private ensureLocations(): Promise<DirectoryLocation[]> {
    if (!this.locationRequest) {
      this.locationsLoading.set(true);
      this.locationsError.set(false);
      this.locationRequest = this.directory.locations().then(locations => {
        this.locationRows.set(locations);
        return locations;
      }).catch(error => {
        this.locationRequest = undefined;
        this.locationsError.set(true);
        throw error;
      }).finally(() => this.locationsLoading.set(false));
    }
    return this.locationRequest;
  }

  private matchesCategory(categoryItem: ServiceCategory, term: string): boolean {
    return `${categoryItem.nameTamil} ${categoryItem.nameEnglish} ${categoryItem.description ?? ''} ${categoryItem.slug}`.toLocaleLowerCase().includes(term)
      || categoryItem.subcategories.some(child => this.matchesCategory(child, term));
  }
}
