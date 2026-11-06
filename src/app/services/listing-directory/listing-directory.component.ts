import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ServiceCategory } from '../../core/models/service-category';
import { DirectoryLocation, DirectoryPage, locationOptions, locationSearchOptions } from '../../core/models/service-listing';
import { LanguageService } from '../../core/services/language.service';
import { ServiceDirectoryService } from '../../core/services/service-directory.service';
import { ListingSummaryComponent } from '../listing-summary/listing-summary.component';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';

@Component({
  selector: 'app-listing-directory',
  imports: [ReactiveFormsModule, RouterLink, ListingSummaryComponent, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="listing-directory" aria-labelledby="directory-title" [attr.aria-busy]="loading()">
      <header class="directory-header">
        <div><p class="eyebrow">{{ i18n.language() === 'ta' ? 'உள்ளூர் அடைவு' : 'LOCAL DIRECTORY' }}</p><h2 id="directory-title">{{ i18n.language() === 'ta' ? 'உள்ளூர் சேவை வழங்குநர்கள்' : 'Local service providers' }}</h2></div>
        @if (!loading() && !error() && result().listings.length) { <span class="result-count" aria-live="polite">{{ result().listings.length }} {{ i18n.language() === 'ta' ? 'இந்தப் பக்கத்தில்' : 'on this page' }}</span> }
      </header>
      <form class="directory-search cdm-form" [formGroup]="form" (ngSubmit)="apply()">
        <label class="keyword-label">{{ i18n.language() === 'ta' ? 'பெயர் அல்லது சேவை' : 'Search services and providers' }}
          <span class="keyword-input"><i class="bi bi-search" aria-hidden="true"></i><input type="search" formControlName="q" maxlength="200" [placeholder]="i18n.language() === 'ta' ? 'சேவை அல்லது வணிகப் பெயர்' : 'Service or business name'"></span>
        </label>
        <app-searchable-select [label]="i18n.language() === 'ta' ? 'இடம்' : 'Location'" controlId="directory-location"
          formControlName="location" [options]="placeOptions()" [emptyValue]="''" [clearable]="true"
          [placeholder]="i18n.language() === 'ta' ? 'அனைத்து இடங்கள்' : 'All locations'"
          [searchPlaceholder]="i18n.language() === 'ta' ? 'இடங்களைத் தேடுங்கள்…' : 'Search locations…'" />
        <button type="submit" class="primary-action"><i class="bi bi-search" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'தேடுக' : 'Search' }}</button>
        <button class="secondary-action" type="button" (click)="clear()">{{ i18n.language() === 'ta' ? 'வடிகட்டிகளை நீக்கு' : 'Clear filters' }}</button>
       </form>
       <a class="ai-search-link" routerLink="/service-search">
         <i class="bi bi-stars" aria-hidden="true"></i>
         {{ i18n.language() === 'ta' ? 'தமிழ் / ஆங்கில AI தேடலைத் திறக்கவும்' : 'Try Tamil / English AI search' }}
       </a>
       @if (loading()) {
        <p class="state" role="status">{{ i18n.language() === 'ta' ? 'சேவைகள் ஏற்றப்படுகின்றன…' : 'Loading services…' }}</p>
      } @else if (error()) {
        <div class="state"><p role="alert">{{ i18n.language() === 'ta' ? 'சேவைகளை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to load services. Please try again.' }}</p>
          <button type="button" (click)="retry()">{{ i18n.text().retry }}</button></div>
      } @else if (!result().listings.length) {
        <div class="state"><p role="status">{{ i18n.language() === 'ta' ? 'பொருத்தமான வெளியிடப்பட்ட சேவைகள் இல்லை. வேறு தேடல் அல்லது இடத்தை முயற்சிக்கவும்.' : 'No matching published services. Try another keyword or location.' }}</p>
          <a class="browse-link" routerLink="/services">{{ i18n.language() === 'ta' ? 'வேறு வகையைப் பார்க்க' : 'Browse another category' }}</a>
        </div>
      } @else {
        <p class="page-status" aria-live="polite">{{ i18n.language() === 'ta' ? 'பக்கம்' : 'Page' }} {{ page() + 1 }} · {{ result().listings.length }} {{ i18n.language() === 'ta' ? 'வெளியிடப்பட்ட சேவைகள்' : 'published services' }}</p>
        <div class="listings">
          @for (listing of result().listings; track listing.id) { <app-listing-summary [listing]="listing" /> }
        </div>
      }
      @if (!loading() && !error() && (page() > 0 || result().hasMore)) {
        <nav class="pagination" [attr.aria-label]="i18n.language() === 'ta' ? 'சேவை பக்கங்கள்' : 'Listing pages'">
          <button class="secondary-action" type="button" [disabled]="page() === 0" (click)="goToPage(page() - 1)">{{ i18n.language() === 'ta' ? 'முந்தைய' : 'Previous' }}</button>
          <span>{{ i18n.language() === 'ta' ? 'பக்கம்' : 'Page' }} {{ page() + 1 }}</span>
          <button class="secondary-action" type="button" [disabled]="!result().hasMore" (click)="goToPage(page() + 1)">{{ i18n.language() === 'ta' ? 'அடுத்த' : 'Next' }}</button>
        </nav>
      }
    </section>
  `,
  styleUrl: '../directory.scss',
})
export class ListingDirectoryComponent {
  readonly category = input.required<ServiceCategory>();
  protected readonly i18n = inject(LanguageService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly attempts = signal(0);
  private readonly locations = signal<DirectoryLocation[]>([]);
  private locationRequest?: Promise<DirectoryLocation[]>;
  protected readonly form = inject(NonNullableFormBuilder).group({ q: '', location: '' });
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly result = signal<DirectoryPage>({ listings: [], hasMore: false });
  protected readonly places = computed(() => locationOptions(this.locations(), this.i18n.language()));
  protected readonly placeOptions = computed(() => locationSearchOptions(this.locations(), this.i18n.language()));
  protected readonly page = computed(() => {
    const page = Number(this.params().get('page') ?? 1);
    return Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page - 1 : 0;
  });

  constructor() {
    effect(onCleanup => {
      const categoryId = this.category().id;
      const keyword = (this.params().get('q') ?? '').slice(0, 200);
      const locationParam = this.params().get('location');
      const location = locationParam ?? '';
      const page = this.page();
      this.attempts();
      this.form.setValue({ q: keyword, location }, { emitEvent: false });
      this.loading.set(true);
      this.error.set(false);
      this.result.set({ listings: [], hasMore: false });
      let current = true;
      onCleanup(() => { current = false; });
      this.locationRequest ??= this.directory.locations().catch(error => { this.locationRequest = undefined; throw error; });
      void this.locationRequest.then(async places => {
        if (!current) return;
        this.locations.set(places);
        const selectedLocation = locationParam === null ? this.defaultChidambaramLocation(places) : location;
        if (locationParam === null && selectedLocation) this.form.controls.location.setValue(selectedLocation, { emitEvent: false });
        if (selectedLocation && !locationOptions(places, 'en').some(place => place.id === selectedLocation)) {
          throw new Error('Invalid location');
        }
        const result = await this.directory.search(categoryId, selectedLocation || null, keyword, page);
        if (current) this.result.set(result);
      }).catch(() => { if (current) this.error.set(true); })
        .finally(() => { if (current) this.loading.set(false); });
    });
  }

  protected retry(): void { this.attempts.update(value => value + 1); }
  protected apply(): void {
    const { q, location } = this.form.getRawValue();
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: q.trim() || null, location, page: null } });
  }
  protected clear(): void { this.form.setValue({ q: '', location: '' }); this.apply(); }
  protected goToPage(page: number): void {
    void this.router.navigate([], { relativeTo: this.route, queryParamsHandling: 'merge', queryParams: { page: page + 1 } });
  }

  private defaultChidambaramLocation(places: readonly DirectoryLocation[]): string {
    const matchesChidambaram = (place: DirectoryLocation): boolean =>
      place.name_en?.trim().toLocaleLowerCase() === 'chidambaram' || place.name_ta.trim() === 'சிதம்பரம்';
    return places.find((place) => place.location_type === 'town' && matchesChidambaram(place))?.id
      ?? places.find(matchesChidambaram)?.id
      ?? '';
  }
}
