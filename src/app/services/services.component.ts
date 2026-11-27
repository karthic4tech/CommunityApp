import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DirectoryLocation, DirectoryPage, locationOptions, locationSearchOptions, ServiceListing } from '../core/models/service-listing';
import { NON_ESSENTIAL_CATEGORY_SLUGS, ServiceCategory } from '../core/models/service-category';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { CategoryCardComponent } from '../home/category-card.component';
import { ListingSummaryComponent } from './listing-summary/listing-summary.component';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../shared/components/searchable-select/searchable-select.models';
import { SeoService } from '../core/services/seo.service';
import { SEO_DIRECTORY_LINKS } from '../core/services/seo-directory-links.generated';

interface FeaturedServiceGroup {
  readonly categoryId: string;
  readonly slug: string;
  readonly titleEnglish: string;
  readonly titleTamil: string;
  readonly listings: readonly ServiceListing[];
}

@Component({
  selector: 'app-all-services',
  imports: [CategoryCardComponent, ListingSummaryComponent, RouterLink, FormsModule, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class AllServicesComponent implements OnInit {
  protected readonly service = inject(ServiceCategoryService);
  protected readonly seoDirectoryLinks = SEO_DIRECTORY_LINKS;
  protected readonly i18n = inject(LanguageService);
  private readonly seo = inject(SeoService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly searchAttempt = signal(0);
  private readonly locationRows = signal<DirectoryLocation[]>([]);
  private readonly defaultLocationId = signal('');
  private locationRequest?: Promise<DirectoryLocation[]>;

  protected readonly locationsLoading = signal(true);
  protected readonly locationsError = signal(false);
  protected readonly searchTerm = computed(() => this.queryParams().get('q') ?? '');
  protected readonly categoryFilter = computed(() => this.queryParams().get('category') ?? '');
  protected readonly locationParam = computed(() => this.queryParams().get('location'));
  protected readonly locationFilter = computed(() => this.locationParam() ?? this.defaultLocationId());
  protected readonly locationSelection = computed(() => this.locationFilter());
  protected readonly listingPage = computed(() => {
    const page = Number(this.queryParams().get('page') ?? 1);
    return Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page - 1 : 0;
  });
  protected readonly hasDirectoryFilters = computed(() => Boolean(this.searchTerm().trim() || this.categoryFilter() || this.locationParam()));
  protected readonly activeFilterCount = computed(() =>
    Number(Boolean(this.searchTerm().trim())) + Number(Boolean(this.categoryFilter())) + Number(Boolean(this.locationParam())),
  );
  protected readonly filteredCategories = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    return term ? this.service.categories().filter((item) => this.matchesCategory(item, term)) : this.service.categories();
  });
  protected readonly categoryOptions = computed(() => {
    const options: { id: string; label: string }[] = [];
    const language = this.i18n.language();
    const visit = (items: readonly ServiceCategory[], prefix = ''): void => {
      for (const item of items) {
        const name = language === 'ta' ? item.nameTamil : item.nameEnglish;
        const label = prefix ? `${prefix} / ${name}` : name;
        options.push({ id: item.id, label });
        visit(item.subcategories, label);
      }
    };
    visit(this.service.categories());
    return options;
  });
  protected readonly searchableCategoryOptions = computed<readonly SearchableSelectOption[]>(() => {
    const options: SearchableSelectOption[] = [];
    const visit = (items: readonly ServiceCategory[], parentLabel = ''): void => {
      for (const item of items) {
        const label = `${item.nameEnglish} — ${item.nameTamil}`;
        options.push({ value: item.id, label: parentLabel ? `${parentLabel} / ${label}` : label, searchText: `${item.nameEnglish} ${item.nameTamil} ${item.slug} ${parentLabel}` });
        visit(item.subcategories, label);
      }
    };
    visit(this.service.categories());
    return options;
  });
  protected readonly categoryCount = computed(() => this.categoryOptions().length);
  protected readonly places = computed(() => locationOptions(this.locationRows(), this.i18n.language()));
  protected readonly searchablePlaces = computed(() => locationSearchOptions(this.locationRows(), this.i18n.language()));
  protected readonly selectedCategoryLabel = computed(() => this.categoryOptions().find((option) => option.id === this.categoryFilter())?.label ?? '');
  protected readonly selectedLocationLabel = computed(() => this.places().find((place) => place.id === this.locationFilter())?.label ?? '');
  protected readonly listingResults = signal<DirectoryPage>({ listings: [], hasMore: false });
  protected readonly listingsLoading = signal(false);
  protected readonly listingsError = signal(false);
  protected readonly isServiceDiscoveryExpanded = signal(false);
  protected readonly isFilterPanelExpanded = signal(false);
  protected readonly featuredServiceGroups = signal<readonly FeaturedServiceGroup[]>([]);
  protected readonly featuredServicesLoading = signal(false);

  private readonly featuredCategories = computed(() => {
    const matches: ServiceCategory[] = [];
    const visit = (categories: readonly ServiceCategory[]): void => {
      for (const category of categories) {
        if (NON_ESSENTIAL_CATEGORY_SLUGS.has(category.slug)) matches.push(category);
        visit(category.subcategories);
      }
    };
    visit(this.service.categories());
    return matches;
  });

  constructor() {
    effect(() => {
      const filtered = this.hasDirectoryFilters();
      const language = this.i18n.language();
      this.seo.update({
        title: filtered
          ? 'Search Local Services in Chidambaram | CDM 360'
          : 'Local Services in Chidambaram | CDM 360',
        description: filtered
          ? 'Search published local services and providers in Chidambaram. Contact providers directly to confirm current details.'
          : 'Browse published local services and verified providers in Chidambaram, Tamil Nadu.',
        path: '/services',
        robots: filtered ? 'noindex,follow' : 'index,follow',
        language,
      });
    });
    effect(() => {
      if (this.hasDirectoryFilters()) this.isServiceDiscoveryExpanded.set(false);
    });
    effect((onCleanup) => {
      const keyword = this.searchTerm().trim().slice(0, 200);
      const categoryId = this.categoryFilter();
      const locationParam = this.locationParam();
      const locationId = this.locationFilter();
      const page = this.listingPage();
      this.searchAttempt();
      let current = true;
      onCleanup(() => { current = false; });

      if (!keyword && !categoryId && !locationParam) {
        this.listingResults.set({ listings: [], hasMore: false });
        this.listingsLoading.set(false);
        this.listingsError.set(false);
        return;
      }

      this.listingsLoading.set(true);
      this.listingsError.set(false);
      this.listingResults.set({ listings: [], hasMore: false });
      void this.ensureLocations().then((locations) => {
        if (locationId && !locations.some((place) => place.id === locationId)) throw new Error('Invalid location filter.');
        return this.directory.search(categoryId || null, locationId || null, keyword, page);
      }).then((result) => { if (current) this.listingResults.set(result); })
        .catch(() => { if (current) this.listingsError.set(true); })
        .finally(() => { if (current) this.listingsLoading.set(false); });
    });
    effect((onCleanup) => {
      const categories = this.featuredCategories();
      const locationId = this.locationFilter();
      const isLoading = this.service.loading() || this.locationsLoading();
      if (this.hasDirectoryFilters() || isLoading || !categories.length) {
        this.featuredServiceGroups.set([]);
        this.featuredServicesLoading.set(false);
        return;
      }

      let current = true;
      onCleanup(() => { current = false; });
      this.featuredServicesLoading.set(true);
      void Promise.all(categories.map(async (category) => {
        const result = await this.directory.search(category.id, locationId || null, '', 0);
        return {
          categoryId: category.id,
          slug: category.slug,
          titleEnglish: category.nameEnglish,
          titleTamil: category.nameTamil,
          listings: result.listings.slice(0, 3),
        } satisfies FeaturedServiceGroup;
      })).then((groups) => {
        if (current) this.featuredServiceGroups.set(groups.filter(group => group.listings.length > 0));
      }).catch(() => {
        if (current) this.featuredServiceGroups.set([]);
      }).finally(() => {
        if (current) this.featuredServicesLoading.set(false);
      });
    });
  }

  ngOnInit(): void {
    void this.service.load();
    void this.ensureLocations().catch(() => this.locationsError.set(true));
  }

  protected toggleServiceDiscovery(): void { this.isServiceDiscoveryExpanded.update((expanded) => !expanded); }
  protected toggleFilterPanel(): void { this.isFilterPanelExpanded.update((expanded) => !expanded); }

  protected applyFilters(event: Event, keyword: string, categoryId: string, locationId: string): void {
    event.preventDefault();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: keyword.trim().slice(0, 200) || null,
        category: categoryId || null,
        location: locationId,
        page: null,
      },
    });
  }

  protected selectCategory(categoryId: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParamsHandling: 'merge', queryParams: { category: categoryId || null, page: null } });
  }

  protected clearFilters(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: null, category: null, location: '', page: null } });
  }

  protected removeFilter(key: 'q' | 'category' | 'location'): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { [key]: key === 'location' ? '' : null, page: null },
    });
  }

  protected retrySearch(): void { this.searchAttempt.update((value) => value + 1); }

  protected changePage(page: number): void {
    void this.router.navigate([], { relativeTo: this.route, queryParamsHandling: 'merge', queryParams: { page: page > 0 ? page + 1 : null } });
  }

  protected retryCategories(): void { void this.service.refresh(); }

  private ensureLocations(): Promise<DirectoryLocation[]> {
    if (!this.locationRequest) {
      this.locationsLoading.set(true);
      this.locationsError.set(false);
      this.locationRequest = this.directory.locations().then((locations) => {
        this.locationRows.set(locations);
        const matchesChidambaram = (place: DirectoryLocation): boolean =>
          place.name_en?.trim().toLocaleLowerCase() === 'chidambaram' || place.name_ta.trim() === 'சிதம்பரம்';
        const defaultTown = locations.find((place) => place.location_type === 'town' && matchesChidambaram(place))
          ?? locations.find(matchesChidambaram);
        this.defaultLocationId.set(defaultTown?.id ?? '');
        return locations;
      }).catch((error: unknown) => {
        this.locationRequest = undefined;
        this.locationsError.set(true);
        throw error;
      }).finally(() => this.locationsLoading.set(false));
    }
    return this.locationRequest;
  }

  private matchesCategory(category: ServiceCategory, term: string): boolean {
    return `${category.nameTamil} ${category.nameEnglish} ${category.description ?? ''} ${category.slug}`.toLocaleLowerCase().includes(term)
      || category.subcategories.some((child) => this.matchesCategory(child, term));
  }
}

// Keep the previous symbol available to existing tests and integrations.
export { AllServicesComponent as ServicesComponent };
