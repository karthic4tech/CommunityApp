import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AiServiceSearchResult } from '../../core/models/ai-service-search';
import { DirectoryLocation, locationOptions } from '../../core/models/service-listing';
import { AiServiceSearchService } from '../../core/services/ai-service-search.service';
import { LanguageService } from '../../core/services/language.service';
import { ServiceDirectoryService } from '../../core/services/service-directory.service';
import { ListingSummaryComponent } from '../listing-summary/listing-summary.component';

@Component({
  selector: 'app-ai-service-search',
  imports: [ReactiveFormsModule, RouterLink, ListingSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="ai-search-title" [attr.aria-busy]="loading()">
      <h1 id="ai-search-title">{{ i18n.language() === 'ta' ? 'உங்களுக்குத் தேவையான சேவையைச் சொல்லுங்கள்' : 'Describe the service you need' }}</h1>
      <p id="search-help">{{ i18n.language() === 'ta' ? 'தமிழ் அல்லது English-இல் தேடுங்கள். எ.கா: சிதம்பரத்தில் குழாய் பழுது பார்க்க ஆள் தேவை' : 'Search in Tamil or English. For example: I need a plumber in Chidambaram.' }}</p>
      <p id="search-privacy">{{ i18n.language() === 'ta' ? 'AI தேடலில் உங்கள் தேடல் உரை AI வழங்குநருக்கு அனுப்பப்படும். தனிப்பட்ட தகவல்களைச் சேர்க்க வேண்டாம். சாதாரண சொல் தேடலையும் பயன்படுத்தலாம்.' : 'AI search sends your query to an AI provider. Do not include personal details. Keyword search does not use AI.' }}</p>
      <form [formGroup]="form" (ngSubmit)="submit(false)">
        <label>{{ i18n.language() === 'ta' ? 'என்ன சேவை தேவை?' : 'What service do you need?' }}
          <input type="search" formControlName="query" minlength="2" maxlength="200" required aria-describedby="search-help search-privacy">
        </label>
        <label>{{ i18n.language() === 'ta' ? 'இடம் (விருப்பம்)' : 'Location (optional)' }}
          <select formControlName="location">
            <option value="">{{ i18n.language() === 'ta' ? 'தேடலில் உள்ள இடம் / அனைத்து இடங்கள்' : 'From query / all locations' }}</option>
            @for (place of placeOptions(); track place.id) { <option [value]="place.id">{{ place.label }}</option> }
          </select>
        </label>
        <button type="submit" [disabled]="form.invalid || loading()">{{ i18n.language() === 'ta' ? 'AI தேடல்' : 'AI search' }}</button>
        <button type="button" class="secondary" [disabled]="form.invalid || loading()" (click)="submit(true)">{{ i18n.language() === 'ta' ? 'சொல் தேடல்' : 'Keyword search' }}</button>
      </form>
      @if (locationsError()) {
        <p role="alert">{{ i18n.language() === 'ta' ? 'இடங்களை ஏற்ற முடியவில்லை.' : 'Unable to load location choices.' }}
          <button type="button" (click)="loadLocations()">{{ i18n.text().retry }}</button></p>
      }
      @if (loading()) {
        <p role="status" class="state">{{ i18n.language() === 'ta' ? 'சேவைகள் தேடப்படுகின்றன…' : 'Searching for services…' }}</p>
      } @else if (error()) {
        <div class="state"><p role="alert">{{ i18n.language() === 'ta' ? 'தேடலை முடிக்க முடியவில்லை. இடத்தையும் உள்நுழைவையும் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.' : 'Unable to search. Check your location and session, then try again.' }}</p>
          <button type="button" (click)="retry()">{{ i18n.text().retry }}</button>
          <button type="button" class="secondary" (click)="submit(true)">{{ i18n.language() === 'ta' ? 'சொல் தேடலை முயற்சி' : 'Try keyword search' }}</button>
        </div>
      } @else if (result(); as response) {
        @if (response.mode === 'keyword') {
          <div class="state"><p role="status">{{ i18n.language() === 'ta' ? 'AI பயன்படுத்தப்படவில்லை. சாதாரண சொல் தேடல் முடிவுகள் காட்டப்படுகின்றன.' : 'AI was not used. Showing literal keyword-search results.' }}</p>
            <button type="button" (click)="submit(false)">{{ i18n.language() === 'ta' ? 'AI தேடலை மீண்டும் முயற்சி' : 'Retry AI search' }}</button></div>
        } @else {
          <p [lang]="response.language">{{ interpretation() }}</p>
        }
        <h2>{{ i18n.language() === 'ta' ? 'வெளியிடப்பட்ட சேவைகள்' : 'Published services' }}</h2>
        @if (!response.listings.length) {
          <p role="status" class="state">{{ i18n.language() === 'ta' ? 'பொருத்தமான வெளியிடப்பட்ட சேவைகள் இல்லை. தேடலை மாற்றவும் அல்லது சேவை வகைகளைப் பார்க்கவும்.' : 'No matching published services. Try a simpler query or browse categories.' }}</p>
        } @else {
          <p role="status">{{ response.listings.length }} {{ i18n.language() === 'ta' ? 'சேவைகள்' : 'services' }}</p>
          <div class="listings">@for (listing of response.listings; track listing.id) { <app-listing-summary [listing]="listing" /> }</div>
          @if (response.hasMore) { <p>{{ i18n.language() === 'ta' ? 'மேலும் சேவைகள் உள்ளன. தேடலைக் குறுக்கவும் அல்லது வகைகளைப் பார்க்கவும்.' : 'More services are available. Refine your search or browse categories.' }}</p> }
        }
      }
      <a routerLink="/services">{{ i18n.language() === 'ta' ? 'சேவை வகைகளைப் பார்க்க' : 'Browse service categories' }}</a>
    </section>
  `,
  styleUrl: '../directory.scss',
})
export class AiServiceSearchComponent {
  protected readonly i18n = inject(LanguageService);
  private readonly search = inject(AiServiceSearchService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly attempts = signal(0);
  private readonly locations = signal<DirectoryLocation[]>([]);
  protected readonly locationsError = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly result = signal<AiServiceSearchResult | null>(null);
  protected readonly placeOptions = computed(() => locationOptions(this.locations(), this.i18n.language()));
  protected readonly form = inject(NonNullableFormBuilder).group({
    query: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]], location: '',
  });
  protected readonly interpretation = computed(() => {
    const result = this.result();
    if (!result) return '';
    const tamil = result.language === 'ta';
    const name = (place: typeof result.intent.category) => place ? (tamil ? place.name_ta : place.name_en ?? place.name_ta) : '';
    return [tamil ? 'தேடல் புரிதல்:' : 'Search interpreted as:', name(result.intent.category), name(result.intent.location), result.intent.keywords].filter(Boolean).join(' · ');
  });

  constructor() {
    void this.loadLocations();
    effect(onCleanup => {
      const query = this.params().get('q') ?? '';
      const location = this.params().get('location') ?? '';
      const keywordOnly = this.params().get('mode') === 'keyword';
      this.attempts();
      untracked(() => this.form.setValue({ query, location }, { emitEvent: false }));
      this.result.set(null);
      this.error.set(false);
      this.loading.set(false);
      if (!query.trim()) return;
      let current = true;
      onCleanup(() => { current = false; });
      this.loading.set(true);
      void this.search.search(query, location || null, keywordOnly)
        .then(result => { if (current) this.result.set(result); })
        .catch(() => { if (current) this.error.set(true); })
        .finally(() => { if (current) this.loading.set(false); });
    });
  }

  protected async loadLocations(): Promise<void> {
    this.locationsError.set(false);
    try { this.locations.set(await this.directory.locations()); } catch { this.locationsError.set(true); }
  }
  protected retry(): void { this.attempts.update(value => value + 1); }
  protected submit(keywordOnly: boolean): void {
    if (this.form.invalid || !this.form.controls.query.value.trim()) return;
    const { query, location } = this.form.getRawValue();
    const mode = keywordOnly ? 'keyword' : null;
    if (query.trim() === this.params().get('q') && (location || null) === this.params().get('location')
      && mode === this.params().get('mode')) { this.retry(); return; }
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: query.trim(), location: location || null, mode } });
  }
}
