import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AiServiceSearchResult } from '../../core/models/ai-service-search';
import { DirectoryLocation, locationSearchOptions } from '../../core/models/service-listing';
import { AiServiceSearchService } from '../../core/services/ai-service-search.service';
import { LanguageService } from '../../core/services/language.service';
import { ServiceDirectoryService } from '../../core/services/service-directory.service';
import { ListingSummaryComponent } from '../listing-summary/listing-summary.component';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionErrorEventLike { error: string; }
type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

@Component({
  selector: 'app-ai-service-search',
  imports: [ReactiveFormsModule, RouterLink, ListingSummaryComponent, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ai-search-page" aria-labelledby="ai-search-title" [attr.aria-busy]="loading()">
      <div class="ai-search-shell">
       <header class="ai-search-hero">
         <p class="ai-search-eyebrow">{{ i18n.language() === 'ta' ? 'சிடிஎம் 360 / ஸ்மார்ட் உள்ளூர் தேடல்' : 'CDM 360 / SMART LOCAL SEARCH' }}</p>
         <h1 id="ai-search-title">{{ i18n.language() === 'ta' ? 'உங்களுக்குத் தேவையான சேவையைச் சொல்லுங்கள்' : 'Describe the service you need' }}</h1>
          <p id="search-help">{{ i18n.language() === 'ta' ? 'உங்கள் சமூகத்தில் நம்பகமான சேவைகளையும் நிபுணர்களையும் கண்டறியுங்கள்.' : 'Find trusted services and professionals across your community.' }}</p>
          <a class="help-link" routerLink="/help/use-ai-search"><i class="bi bi-question-circle" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'AI Search-ஐ எவ்வாறு பயன்படுத்துவது?' : 'How to use AI Search' }}</a>
       </header>
       <div class="ai-search-panel">
       <p id="search-privacy" class="ai-search-transparency"><i class="bi bi-stars" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'உங்கள் தேடலைப் புரிந்துகொள்ள AI உதவுகிறது. முடிவுகள் CDM 360 பதிவுகளிலிருந்து பெறப்படுகின்றன.' : 'AI helps understand your search. Results are retrieved from CDM 360 listings.' }}</p>
       <form class="cdm-form" [formGroup]="form" (ngSubmit)="submit(false)">
         <label>{{ i18n.language() === 'ta' ? 'என்ன சேவை தேவை?' : 'What service do you need?' }}
           <span class="search-control">
             <i class="bi bi-search" aria-hidden="true"></i>
             <input #queryInput type="search" formControlName="query" minlength="2" maxlength="200" required aria-describedby="search-help search-privacy">
             @if (form.controls.query.value) { <button type="button" class="icon-button" aria-label="Clear search" (click)="clearQuery()"><i class="bi bi-x-lg" aria-hidden="true"></i></button> }
             <button type="button" class="icon-button microphone-button" [class.is-listening]="voiceState() === 'listening'" [attr.aria-label]="voiceButtonLabel()" [attr.aria-pressed]="voiceState() === 'listening'" (click)="toggleVoice()">
               <i class="bi bi-mic-fill" aria-hidden="true"></i>
             </button>
           </span>
         </label>
         <div class="search-examples" aria-label="Search suggestions">
           <button type="button" (click)="useExample('Need a plumber near Chidambaram')">Need a plumber near Chidambaram</button>
           <button type="button" (click)="useExample('எலக்ட்ரீஷியன் வேண்டும்')">எலக்ட்ரீஷியன் வேண்டும்</button>
         </div>
         @if (voiceState() !== 'idle' && voiceState() !== 'completed') { <p class="voice-status" role="status">{{ voiceMessage() }}</p> }
         <app-searchable-select [label]="i18n.language() === 'ta' ? 'இடம் (விருப்பம்)' : 'Location (optional)'" controlId="ai-search-location"
          formControlName="location" [options]="placeOptions()" [emptyValue]="''" [clearable]="true" [loading]="locationsLoading()"
          [placeholder]="i18n.language() === 'ta' ? 'தேடலில் உள்ள இடம் / அனைத்து இடங்கள்' : 'From query / all locations'"
          [searchPlaceholder]="i18n.language() === 'ta' ? 'இடங்களைத் தேடுங்கள்…' : 'Search locations…'" />
         <button type="submit" [disabled]="form.invalid || loading()">{{ i18n.language() === 'ta' ? 'தேடல்' : 'Search' }}</button>
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
           <div class="state"><p role="status">{{ response.reason === 'direct_match' ? (i18n.language() === 'ta' ? 'வேகமான நேரடி தேடல் முடிவுகள்.' : 'Fast direct search results.') : (i18n.language() === 'ta' ? 'AI பயன்படுத்தப்படவில்லை. சாதாரண சொல் தேடல் முடிவுகள் காட்டப்படுகின்றன.' : 'AI was not used. Showing literal keyword-search results.') }}</p>
            <button type="button" (click)="submit(false)">{{ i18n.language() === 'ta' ? 'AI தேடலை மீண்டும் முயற்சி' : 'Retry AI search' }}</button></div>
        } @else {
          <p [lang]="response.language">{{ interpretation() }}</p>
        }
        <h2>{{ i18n.language() === 'ta' ? 'வெளியிடப்பட்ட சேவைகள்' : 'Published services' }}</h2>
         @if (!response.listings.length) {
           <p role="status" class="state">{{ i18n.language() === 'ta' ? 'மன்னிக்கவும், இந்தத் தேடலுக்கு பொருத்தமான முடிவுகள் கிடைக்கவில்லை.' : 'Sorry, no matching results were found. No matching published services.' }}</p>
        } @else {
          <p role="status">{{ response.listings.length }} {{ i18n.language() === 'ta' ? 'சேவைகள்' : 'services' }}</p>
          <div class="listings">@for (listing of response.listings; track listing.id) { <app-listing-summary [listing]="listing" /> }</div>
          @if (response.hasMore) { <p>{{ i18n.language() === 'ta' ? 'மேலும் சேவைகள் உள்ளன. தேடலைக் குறுக்கவும் அல்லது வகைகளைப் பார்க்கவும்.' : 'More services are available. Refine your search or browse categories.' }}</p> }
        }
      }
       <a class="ai-browse-link" routerLink="/services">{{ i18n.language() === 'ta' ? 'சேவை வகைகளைப் பார்க்க' : 'Browse service categories' }} <i class="bi bi-arrow-right" aria-hidden="true"></i></a>
       </div>
      </div>
    </section>
  `,
  styleUrl: '../directory.scss',
})
 export class AiServiceSearchComponent implements OnDestroy {
  protected readonly i18n = inject(LanguageService);
  private readonly search = inject(AiServiceSearchService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly attempts = signal(0);
  private readonly locations = signal<DirectoryLocation[]>([]);
  protected readonly locationsError = signal(false);
  protected readonly locationsLoading = signal(true);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly voiceState = signal<'idle' | 'requesting_permission' | 'listening' | 'processing' | 'completed' | 'unsupported' | 'permission_denied' | 'error'>('idle');
  protected readonly result = signal<AiServiceSearchResult | null>(null);
  protected readonly placeOptions = computed(() => locationSearchOptions(this.locations(), this.i18n.language()));
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
  private recognition: SpeechRecognitionLike | null = null;

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
    this.locationsLoading.set(true);
    this.locationsError.set(false);
    try { this.locations.set(await this.directory.locations()); } catch { this.locationsError.set(true); }
    finally { this.locationsLoading.set(false); }
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

  ngOnDestroy(): void { this.recognition?.stop(); this.recognition = null; }

  protected clearQuery(): void { this.form.controls.query.setValue(''); this.voiceState.set('idle'); }

  protected useExample(query: string): void { this.form.controls.query.setValue(query); }

  protected toggleVoice(): void {
    if (this.voiceState() === 'listening') { this.recognition?.stop(); return; }
    const browser = globalThis as typeof globalThis & { SpeechRecognition?: SpeechRecognitionConstructorLike; webkitSpeechRecognition?: SpeechRecognitionConstructorLike };
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) { this.voiceState.set('unsupported'); return; }
    this.voiceState.set('requesting_permission');
    const recognition = new Constructor();
    recognition.lang = this.i18n.language() === 'ta' ? 'ta-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = event => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index][0]?.transcript ?? '').join(' ').trim();
      if (transcript) { this.form.controls.query.setValue(transcript); this.voiceState.set('completed'); }
    };
    recognition.onerror = event => {
      this.voiceState.set(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'permission_denied' : 'error');
      this.recognition = null;
    };
    recognition.onend = () => { if (this.voiceState() === 'listening' || this.voiceState() === 'requesting_permission') this.voiceState.set('processing'); this.recognition = null; };
    this.recognition = recognition;
    try { recognition.start(); this.voiceState.set('listening'); } catch { this.voiceState.set('error'); this.recognition = null; }
  }

  protected voiceButtonLabel(): string {
    if (this.voiceState() === 'listening') return this.i18n.language() === 'ta' ? 'குரல் பதிவை நிறுத்து' : 'Stop voice search';
    return this.i18n.language() === 'ta' ? 'குரல் தேடலை தொடங்கு' : 'Start voice search';
  }

  protected voiceMessage(): string {
    const tamil = this.i18n.language() === 'ta';
    switch (this.voiceState()) {
      case 'requesting_permission': return tamil ? 'மைக்ரோஃபோன் அனுமதி கேட்கப்படுகிறது…' : 'Requesting microphone permission…';
      case 'listening': return tamil ? 'கேட்டுக்கொண்டிருக்கிறோம்…' : 'Listening…';
      case 'processing': return tamil ? 'குரல் உரையாக மாற்றப்படுகிறது…' : 'Processing your voice…';
      case 'unsupported': return tamil ? 'உங்கள் உலாவியில் குரல் தேடல் ஆதரிக்கப்படவில்லை. தட்டச்சு செய்து தேடுங்கள்.' : 'Voice search is not supported in this browser. Type your search instead.';
      case 'permission_denied': return tamil ? 'மைக்ரோஃபோன் அனுமதி வழங்கப்படவில்லை. தட்டச்சு செய்து தேடலாம்.' : 'Microphone permission was denied. You can type your search instead.';
      case 'error': return tamil ? 'குரல் தேடல் கிடைக்கவில்லை. தட்டச்சு செய்து தேடலாம்.' : 'Voice search is unavailable. You can type your search instead.';
      default: return '';
    }
  }
}
