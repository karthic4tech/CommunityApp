import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ServiceCategory } from '../core/models/service-category';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

@Component({
  selector: 'app-community-hub',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="hub" aria-labelledby="hub-title">
      <div class="hub-shell">
        <section class="welcome-panel" aria-describedby="hub-description">
          <p class="eyebrow">{{ i18n.language() === 'ta' ? 'உங்கள் உள்ளூர் சமூகத்திற்கு வரவேற்கிறோம்' : 'WELCOME TO YOUR LOCAL COMMUNITY' }}</p>
          <h1 id="hub-title">{{ i18n.language() === 'ta' ? 'இன்று உங்களுக்கு என்ன தேவை?' : 'What do you need today?' }}</h1>
          <p id="hub-description">{{ i18n.language() === 'ta' ? 'சிதம்பரத்தில் நம்பகமான உள்ளூர் சேவைகளையும் வணிகங்களையும் கண்டறியுங்கள்.' : 'Find trusted local services and businesses in Chidambaram.' }}</p>
          <form class="hub-search" (submit)="search($event)" novalidate>
            <label class="visually-hidden" for="hub-search-input">{{ i18n.language() === 'ta' ? 'தேடுங்கள்' : 'Search local services' }}</label>
            <i class="bi bi-search" aria-hidden="true"></i>
            <input id="hub-search-input" type="search" [value]="query()" (input)="query.set(searchInput.value)" #searchInput autocomplete="off" [placeholder]="i18n.language() === 'ta' ? 'பிளம்பர், வேலை, உணவு…' : 'Search plumber, jobs, food…'" />
            <button type="button" class="icon-button" [class.listening]="voiceState() === 'listening'" [attr.aria-pressed]="voiceState() === 'listening'" [attr.aria-label]="voiceLabel()" (click)="toggleVoice()"><i class="bi bi-mic-fill" aria-hidden="true"></i></button>
          </form>
          @if (searchMessage()) { <p class="search-message" role="alert">{{ searchMessage() }}</p> }
          @if (voiceMessage()) { <p class="voice-message" role="status">{{ voiceMessage() }}</p> }
        </section>

        <a class="feature-card service-card" routerLink="/services">
          <span class="card-icon" aria-hidden="true"><i class="bi bi-wrench-adjustable"></i></span>
          <span class="card-copy"><strong>{{ i18n.language() === 'ta' ? 'ஒரு சேவையைக் கண்டறியுங்கள்' : 'Find a Service' }}</strong><span>{{ i18n.language() === 'ta' ? 'பிளம்பர், எலக்ட்ரீஷியன், மெக்கானிக், ஆம்புலன்ஸ் மற்றும் பல' : 'Plumber, electrician, mechanic, ambulance and more' }}</span></span>
          <i class="bi bi-arrow-right card-arrow" aria-hidden="true"></i>
        </a>

        <div class="core-grid">
          <a class="feature-card core-card" routerLink="/businesses">
            <span class="card-icon business-icon" aria-hidden="true"><i class="bi bi-shop"></i></span>
            <span class="card-copy"><strong>{{ i18n.language() === 'ta' ? 'உள்ளூர் வணிகங்கள்' : 'Local Businesses' }}</strong><span>{{ i18n.language() === 'ta' ? 'கடைகள், உணவகங்கள் மற்றும் உள்ளூர் வழங்குநர்கள்' : 'Shops, restaurants and local providers' }}</span></span>
            <i class="bi bi-arrow-up-right card-arrow" aria-hidden="true"></i>
          </a>
          <a class="feature-card core-card" [routerLink]="postNeedDestination" [attr.aria-label]="postNeedLabel()">
            <span class="card-icon need-icon" aria-hidden="true"><i class="bi bi-megaphone"></i></span>
            <span class="card-copy"><strong>{{ i18n.language() === 'ta' ? 'ஒரு தேவையைப் பதிவிடுங்கள்' : 'Post a Need' }}</strong><span>{{ i18n.language() === 'ta' ? 'சமூகத்திடம் உங்களுக்கு என்ன தேவை என்று சொல்லுங்கள்' : 'Tell the community what you need' }}</span></span>
            <i class="bi bi-arrow-up-right card-arrow" aria-hidden="true"></i>
          </a>
        </div>

        <section class="popular" aria-labelledby="popular-title">
          <div class="section-heading"><h2 id="popular-title">{{ i18n.language() === 'ta' ? 'பிரபலமான சேவைகள்' : 'Popular Services' }}</h2><a routerLink="/services">{{ i18n.language() === 'ta' ? 'அனைத்தையும் காண்க' : 'View all' }} <i class="bi bi-arrow-right" aria-hidden="true"></i></a></div>
          @if (categoriesLoading()) { <p class="category-state" role="status">{{ i18n.language() === 'ta' ? 'சேவைகள் ஏற்றப்படுகின்றன…' : 'Loading services…' }}</p> }
          @else if (categoriesError()) { <p class="category-state" role="alert">{{ i18n.language() === 'ta' ? 'சேவைகளை ஏற்ற முடியவில்லை.' : 'Popular services are unavailable right now.' }}</p> }
          @else if (popularCategories().length) {
            <div class="chips" aria-label="Popular service categories">
              @for (category of popularCategories(); track category.id) { <a class="chip" [routerLink]="['/services/category', category.slug]" [attr.lang]="i18n.language()">{{ i18n.language() === 'ta' ? category.nameTamil : category.nameEnglish }}<i class="bi bi-arrow-up-right" aria-hidden="true"></i></a> }
            </div>
          } @else { <p class="category-state">{{ i18n.language() === 'ta' ? 'சேவை வகைகள் தற்போது இல்லை.' : 'No service categories are available right now.' }}</p> }
        </section>
      </div>
    </main>
  `,
  styles: `
    :host { display:block; min-width:0; background:#f8fafc; }
    .hub { padding:clamp(1.25rem,4vw,3.25rem) 0 clamp(2.5rem,6vw,5rem); color:#002050; }
    .hub-shell { width:min(100% - 2rem, 980px); margin-inline:auto; display:grid; gap:1rem; }
    .welcome-panel { padding:clamp(1.5rem,4vw,3rem); border:1px solid #dbe7f3; border-radius:26px; background:#edf5fc; }
    .eyebrow { margin:0 0 .7rem; color:#0755b8; font-size:.7rem; font-weight:800; letter-spacing:.13em; }
    h1 { max-width:620px; margin:0; color:#002050; font-size:clamp(2rem,5vw,3.55rem); line-height:1.05; letter-spacing:-.045em; }
    .welcome-panel > p:not(.eyebrow) { margin:.85rem 0 1.5rem; color:#64748b; font-size:1rem; line-height:1.65; }
    .hub-search { display:flex; align-items:center; min-height:58px; max-width:720px; padding:.35rem .45rem .35rem 1.1rem; gap:.75rem; border:1px solid #e2e8f0; border-radius:999px; background:#fff; box-shadow:0 5px 18px rgb(0 32 80 / 6%); }
    .hub-search > i { color:#0755b8; font-size:1.15rem; }
    .hub-search input { min-width:0; flex:1; border:0; outline:0; color:#002050; background:transparent; font:inherit; }
    .hub-search input::placeholder { color:#94a3b8; }
    .icon-button { display:grid; place-items:center; flex:0 0 46px; min-width:46px; min-height:46px; border:0; border-radius:50%; background:#f0f7ff; color:#0755b8; font:inherit; cursor:pointer; }
    .icon-button:hover, .icon-button.listening { background:#0755b8; color:#fff; }
    .search-message, .voice-message { margin:.7rem 0 0; color:#a1472b; font-size:.84rem; }
    .voice-message { color:#0755b8; }
    .feature-card { display:flex; align-items:center; min-width:0; padding:1.25rem 1.4rem; border:1px solid #e2e8f0; border-radius:18px; background:#fff; color:#002050; text-decoration:none; transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease; }
    .feature-card:hover { border-color:#b8d3ee; box-shadow:0 10px 24px rgb(0 32 80 / 8%); transform:translateY(-2px); }
    .feature-card:focus-visible, .popular a:focus-visible { outline:3px solid #0da68c; outline-offset:3px; }
    .service-card { min-height:104px; }
    .core-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; }
    .core-card { min-height:156px; align-items:flex-start; }
    .card-icon { display:grid; place-items:center; flex:0 0 48px; width:48px; height:48px; margin-right:1rem; border-radius:14px; background:#e7f1ff; color:#0755b8; font-size:1.35rem; }
    .business-icon { background:#e5f8f2; color:#0da68c; }.need-icon { background:#fff0e9; color:#e3864f; }
    .card-copy { display:grid; gap:.35rem; min-width:0; }.card-copy strong { font-size:1.05rem; }.card-copy span { color:#64748b; font-size:.88rem; line-height:1.5; }
    .card-arrow { margin-left:auto; padding:.3rem; color:#0755b8; font-size:1.1rem; }.popular { padding-top:.55rem; }
    .section-heading { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:.75rem; }.section-heading h2 { margin:0; font-size:1.15rem; }.section-heading a { color:#0755b8; font-size:.82rem; font-weight:750; text-decoration:none; white-space:nowrap; }
    .chips { display:flex; gap:.65rem; overflow-x:auto; padding:.25rem .15rem .6rem; scrollbar-width:thin; }.chip { display:inline-flex; align-items:center; gap:.5rem; min-height:44px; padding:.55rem .85rem; border:1px solid #dbe7f3; border-radius:999px; background:#fff; color:#002050; font-size:.82rem; font-weight:700; text-decoration:none; white-space:nowrap; }.chip:hover { border-color:#0da68c; color:#0755b8; }.chip i { color:#0da68c; }
    .category-state { margin:0; color:#64748b; font-size:.85rem; }.visually-hidden { position:absolute; width:1px; height:1px; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
    @media (max-width:620px) { .hub-shell { width:min(100% - 1.25rem, 520px); }.welcome-panel { border-radius:20px; padding:1.35rem; }.hub-search { min-height:54px; }.core-grid { grid-template-columns:1fr; }.core-card { min-height:112px; }.service-card { min-height:94px; } }
  `,
})
export class CommunityHubComponent implements OnInit, OnDestroy {
  protected readonly i18n = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly categoryService = inject(ServiceCategoryService);
  protected readonly query = signal('');
  protected readonly searchMessage = signal('');
  protected readonly voiceState = signal<'idle' | 'listening' | 'unsupported' | 'permission_denied' | 'error'>('idle');
  protected readonly categoriesLoading = this.categoryService.loading;
  protected readonly categoriesError = computed(() => Boolean(this.categoryService.error()));
  private recognition: SpeechRecognitionLike | null = null;
  readonly postNeedDestination = '/services/submit';
  protected readonly popularCategories = computed(() => {
    const preferred = ['jobs-professional-services', 'transport-tourism-services', 'home-services', 'food-restaurant-services', 'medical-emergency-services'];
    const categories = this.categoryService.categories();
    const selected = preferred.map(slug => categories.find(category => category.slug === slug)).filter((category): category is ServiceCategory => Boolean(category));
    return selected.length ? selected : categories.slice(0, 5);
  });

  ngOnInit(): void { void this.categoryService.load(); }

  protected search(event: Event): void {
    event.preventDefault();
    const term = this.query().trim();
    this.searchMessage.set('');
    if (!term) { this.searchMessage.set(this.i18n.language() === 'ta' ? 'தேடுவதற்கு ஒரு சொல்லை உள்ளிடுங்கள்.' : 'Enter a service or business to search.'); return; }
    if (term.length < 2) { this.searchMessage.set(this.i18n.language() === 'ta' ? 'குறைந்தது இரண்டு எழுத்துகளை உள்ளிடுங்கள்.' : 'Enter at least two characters.'); return; }
    void this.router.navigate(['/service-search'], { queryParams: { q: term } });
  }

  protected postNeedLabel(): string { return this.i18n.language() === 'ta' ? 'சேவை வழங்குநராக பதிவு செய்யவும்' : 'Open the existing service submission form'; }

  protected toggleVoice(): void {
    if (this.voiceState() === 'listening') { this.recognition?.stop(); return; }
    const browser = globalThis as typeof globalThis & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) { this.voiceState.set('unsupported'); return; }
    const recognition = new Constructor(); recognition.lang = this.i18n.language() === 'ta' ? 'ta-IN' : 'en-IN'; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = event => { const text = Array.from({ length: event.results.length }, (_, i) => event.results[i][0]?.transcript ?? '').join(' ').trim(); if (text) { this.query.set(text); this.voiceState.set('idle'); } };
    recognition.onerror = event => { this.voiceState.set(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'permission_denied' : 'error'); this.recognition = null; };
    recognition.onend = () => { this.recognition = null; if (this.voiceState() === 'listening') this.voiceState.set('idle'); };
    this.recognition = recognition;
    try { recognition.start(); this.voiceState.set('listening'); } catch { this.voiceState.set('error'); this.recognition = null; }
  }

  protected voiceLabel(): string { return this.voiceState() === 'listening' ? 'Stop voice search' : 'Start voice search'; }
  protected voiceMessage(): string { const tamil = this.i18n.language() === 'ta'; switch (this.voiceState()) { case 'listening': return tamil ? 'கேட்டுக்கொண்டிருக்கிறோம்…' : 'Listening…'; case 'unsupported': return tamil ? 'இந்த உலாவியில் குரல் தேடல் ஆதரிக்கப்படவில்லை.' : 'Voice search is not supported in this browser.'; case 'permission_denied': return tamil ? 'மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது.' : 'Microphone permission was denied.'; case 'error': return tamil ? 'குரல் தேடல் கிடைக்கவில்லை.' : 'Voice search is unavailable.'; default: return ''; } }
  ngOnDestroy(): void { this.recognition?.stop(); this.recognition = null; }
}
