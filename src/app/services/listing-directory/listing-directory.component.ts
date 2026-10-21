import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ServiceCategory } from '../../core/models/service-category';
import { DirectoryLocation, DirectoryPage, locationOptions } from '../../core/models/service-listing';
import { LanguageService } from '../../core/services/language.service';
import { ServiceDirectoryService } from '../../core/services/service-directory.service';
import { ListingSummaryComponent } from '../listing-summary/listing-summary.component';

@Component({
  selector: 'app-listing-directory',
  imports: [ReactiveFormsModule, ListingSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="directory-title" [attr.aria-busy]="loading()">
      <h2 id="directory-title">{{ i18n.language() === 'ta' ? 'உள்ளூர் சேவை வழங்குநர்கள்' : 'Local service providers' }}</h2>
      <form [formGroup]="form" (ngSubmit)="apply()">
        <label>{{ i18n.language() === 'ta' ? 'தேடல்' : 'Keyword' }}
          <input type="search" formControlName="q" maxlength="200" [placeholder]="i18n.language() === 'ta' ? 'பெயர் அல்லது சேவை' : 'Business name or service'">
        </label>
        <label>{{ i18n.language() === 'ta' ? 'இடம்' : 'Location' }}
          <select formControlName="location">
            <option value="">{{ i18n.language() === 'ta' ? 'அனைத்து இடங்கள்' : 'All locations' }}</option>
            @for (place of places(); track place.id) { <option [value]="place.id">{{ place.label }}</option> }
          </select>
        </label>
        <button type="submit">{{ i18n.language() === 'ta' ? 'தேடுக' : 'Search' }}</button>
        <button class="secondary" type="button" (click)="clear()">{{ i18n.language() === 'ta' ? 'வடிகட்டிகளை நீக்கு' : 'Clear filters' }}</button>
      </form>
      @if (loading()) {
        <p class="state" role="status">{{ i18n.language() === 'ta' ? 'சேவைகள் ஏற்றப்படுகின்றன…' : 'Loading services…' }}</p>
      } @else if (error()) {
        <div class="state"><p role="alert">{{ i18n.language() === 'ta' ? 'சேவைகளை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to load services. Please try again.' }}</p>
          <button type="button" (click)="retry()">{{ i18n.text().retry }}</button></div>
      } @else if (!result().listings.length) {
        <p class="state" role="status">{{ i18n.language() === 'ta' ? 'பொருத்தமான வெளியிடப்பட்ட சேவைகள் இல்லை. வேறு தேடல் அல்லது இடத்தை முயற்சிக்கவும்.' : 'No matching published services. Try another keyword or location.' }}</p>
      } @else {
        <p role="status">{{ i18n.language() === 'ta' ? 'இந்தப் பக்கத்தில்' : 'Showing' }} {{ result().listings.length }} {{ i18n.language() === 'ta' ? 'சேவைகள் • பக்கம்' : 'services on page' }} {{ page() + 1 }}</p>
        <div class="listings">
          @for (listing of result().listings; track listing.id) { <app-listing-summary [listing]="listing" /> }
        </div>
      }
      @if (!loading() && !error() && (page() > 0 || result().hasMore)) {
        <nav class="pagination" [attr.aria-label]="i18n.language() === 'ta' ? 'சேவை பக்கங்கள்' : 'Listing pages'">
          <button type="button" [disabled]="page() === 0" (click)="goToPage(page() - 1)">{{ i18n.language() === 'ta' ? 'முந்தைய' : 'Previous' }}</button>
          <button type="button" [disabled]="!result().hasMore" (click)="goToPage(page() + 1)">{{ i18n.language() === 'ta' ? 'அடுத்த' : 'Next' }}</button>
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
  protected readonly page = computed(() => {
    const page = Number(this.params().get('page') ?? 1);
    return Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page - 1 : 0;
  });

  constructor() {
    effect(onCleanup => {
      const categoryId = this.category().id;
      const keyword = (this.params().get('q') ?? '').slice(0, 200);
      const location = this.params().get('location') ?? '';
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
        if (location && !locationOptions(places, 'en').some(place => place.id === location)) {
          throw new Error('Invalid location');
        }
        const result = await this.directory.search(categoryId, location || null, keyword, page);
        if (current) this.result.set(result);
      }).catch(() => { if (current) this.error.set(true); })
        .finally(() => { if (current) this.loading.set(false); });
    });
  }

  protected retry(): void { this.attempts.update(value => value + 1); }
  protected apply(): void {
    const { q, location } = this.form.getRawValue();
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: q.trim() || null, location: location || null, page: null } });
  }
  protected clear(): void { this.form.setValue({ q: '', location: '' }); this.apply(); }
  protected goToPage(page: number): void {
    void this.router.navigate([], { relativeTo: this.route, queryParamsHandling: 'merge', queryParams: { page: page + 1 } });
  }
}
