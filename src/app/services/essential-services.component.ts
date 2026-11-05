import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DirectoryLocation, DirectoryPage, locationOptions, locationSearchOptions } from '../core/models/service-listing';
import { ServiceCategory } from '../core/models/service-category';
import { EssentialShortcut } from '../core/models/essential-service';
import { EssentialServiceService } from '../core/services/essential-service.service';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { CategoryCardComponent } from '../home/category-card.component';
import { ListingSummaryComponent } from './listing-summary/listing-summary.component';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../shared/components/searchable-select/searchable-select.models';

@Component({
  selector: 'app-essential-services',
  imports: [CategoryCardComponent, ListingSummaryComponent, RouterLink, FormsModule, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="essential-page container-xl" aria-labelledby="essential-title" [attr.aria-busy]="categoriesLoading() || listingsLoading()">
      <header class="essential-hero">
        <p class="eyebrow">{{ i18n.language() === 'ta' ? 'சிடிஎம் 360 / அத்தியாவசிய சேவைகள்' : 'CDM 360 / ESSENTIAL SERVICES' }}</p>
        <div class="hero-heading">
          <div>
            <h1 id="essential-title">{{ i18n.language() === 'ta' ? 'முக்கியமானவை. ஒரே சொடுக்கில்.' : 'Everything Important. Just a Click Away.' }}</h1>
            <p>{{ i18n.language() === 'ta' ? 'சிதம்பரத்தில் அத்தியாவசிய உள்ளூர் சேவைகள், அன்றாட உதவி மற்றும் உள்ளூர் நிபுணர்களைக் கண்டறியுங்கள்.' : 'Discover essential local services, everyday assistance and local professionals in Chidambaram.' }}</p>
          </div>
          <span class="hero-symbol" aria-hidden="true"><i class="bi bi-lightning-charge"></i></span>
        </div>

        <form class="essential-search cdm-form" (submit)="applySearch($event, query.value, category.value, location.value)">
          <label class="keyword-field" for="essential-query">
            <span>{{ i18n.language() === 'ta' ? 'எந்த சேவை தேவை?' : 'What service do you need?' }}</span>
            <span class="input-wrap"><i class="bi bi-search" aria-hidden="true"></i><input #query id="essential-query" type="search" maxlength="200" [value]="searchTerm()" [placeholder]="i18n.language() === 'ta' ? 'ஆம்புலன்ஸ், வேலை, உணவு…' : 'Ambulance, jobs, food…'"></span>
          </label>
          <app-searchable-select #location="ngModel" name="essential-location" controlId="essential-location"
            [label]="i18n.language() === 'ta' ? 'இடம்' : 'Location'" [options]="searchablePlaces()" [ngModel]="locationFilter()"
            [loading]="locationsLoading()" [disabled]="locationsError()" [emptyValue]="''" [clearable]="true"
            [ngModelOptions]="{standalone:true}"
            [placeholder]="i18n.language() === 'ta' ? 'அனைத்து இடங்களும்' : 'All locations'"
            [searchPlaceholder]="i18n.language() === 'ta' ? 'இடங்களைத் தேடுங்கள்…' : 'Search locations…'" />
          <app-searchable-select #category="ngModel" name="essential-category" controlId="essential-category"
            [label]="i18n.language() === 'ta' ? 'சேவை வகை' : 'Essential category'" [options]="categoryOptions()" [ngModel]="categoryFilter()"
            [emptyValue]="''" [clearable]="true" [ngModelOptions]="{standalone:true}"
            [placeholder]="i18n.language() === 'ta' ? 'அனைத்து அத்தியாவசிய சேவைகள்' : 'All essential services'"
            [searchPlaceholder]="i18n.language() === 'ta' ? 'ஆங்கிலம் அல்லது தமிழில் தேடுங்கள்…' : 'Search in English or Tamil…'" />
          <button type="submit" class="search-button"><i class="bi bi-search" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'தேடுக' : 'Search' }}</button>
          <button type="button" class="clear-button" (click)="clearSearch()">{{ i18n.language() === 'ta' ? 'நீக்கு' : 'Clear' }}</button>
        </form>
        @if (locationsError()) { <p class="location-error" role="status">{{ i18n.language() === 'ta' ? 'இடங்கள் ஏற்றப்படவில்லை; அனைத்து இடங்களிலும் தேடப்படுகிறது.' : 'Locations could not be loaded; searching all locations.' }}</p> }
      </header>

      @if (emergencyShortcuts().length) {
        <section class="emergency-band" aria-labelledby="emergency-title">
          <div class="emergency-intro"><span class="emergency-icon"><i class="bi bi-telephone-forward" aria-hidden="true"></i></span><div><p class="eyebrow">{{ i18n.language() === 'ta' ? 'விரைவான அணுகல்' : 'QUICK ACCESS' }}</p><h2 id="emergency-title">{{ i18n.language() === 'ta' ? 'அவசர உதவி தொடர்புகள்' : 'Emergency contacts' }}</h2><p>{{ i18n.language() === 'ta' ? 'பட்டியலிடப்பட்ட சேவைகளைப் பார்த்து நேரடியாக தொடர்பு கொள்ளுங்கள்.' : 'Open an available listing to view its published contact options.' }}</p></div></div>
          <div class="emergency-links">
            @for (shortcut of emergencyShortcuts(); track shortcut.id) {
              <a [routerLink]="shortcut.destination"><i class="bi" [class]="shortcut.icon || 'bi bi-telephone'" aria-hidden="true"></i><span>{{ i18n.language() === 'ta' ? (shortcut.title_ta || shortcut.title) : shortcut.title }}</span><i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>
            }
          </div>
          <small>{{ i18n.language() === 'ta' ? 'சிடிஎம் 360 ஒரு சேவை அடைவு; அவசர மீட்பு சேவை அல்ல.' : 'CDM 360 is a directory, not an emergency response service. Contact providers directly.' }}</small>
        </section>
      }

      <section class="priority-section" aria-labelledby="priority-title">
        <div class="section-heading"><div><p class="eyebrow">{{ i18n.language() === 'ta' ? 'அத்தியாவசிய சேவைகள்' : 'CURATED FOR YOUR TOWN' }}</p><h2 id="priority-title">{{ i18n.language() === 'ta' ? 'முக்கிய சேவைகளை விரைவாகக் கண்டறியுங்கள்' : 'Find what matters, faster.' }}</h2><p>{{ i18n.language() === 'ta' ? 'நிர்வாகத்தால் தேர்ந்தெடுக்கப்பட்ட சேவைகள்.' : 'A focused selection of services chosen for local everyday needs.' }}</p></div><span class="count">{{ shortcuts().length }} {{ i18n.language() === 'ta' ? 'குறுக்குவழிகள்' : 'shortcuts' }}</span></div>
        @if (categoriesLoading()) {
          <div class="loading-state" role="status"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>{{ i18n.language() === 'ta' ? 'அத்தியாவசிய சேவைகள் ஏற்றப்படுகின்றன…' : 'Loading essential services…' }}</div>
        } @else if (errorMessage(); as message) {
          <div class="state error-state"><p role="alert">{{ message }}</p><button type="button" class="secondary-button" (click)="load()">{{ i18n.text().retry }}</button></div>
        } @else if (shortcuts().length) {
          <div class="shortcut-grid">
            @for (shortcut of shortcuts(); track shortcut.id) {
              <a class="shortcut-tile" [class.emergency-tile]="shortcut.is_emergency" [routerLink]="shortcut.destination">
                <span class="shortcut-icon"><i class="bi" [class]="shortcut.icon || 'bi bi-grid'" aria-hidden="true"></i></span>
                <span class="shortcut-copy"><strong>{{ i18n.language() === 'ta' ? (shortcut.title_ta || shortcut.title) : shortcut.title }}</strong><small>{{ i18n.language() === 'ta' ? shortcut.subcategoryNameTamil || shortcut.categoryNameTamil : shortcut.subcategoryName || shortcut.categoryName }}</small></span>
                <i class="bi bi-arrow-up-right shortcut-arrow" aria-hidden="true"></i>
              </a>
            }
          </div>
        } @else if (essentialCategories().length) {
          <p class="state" role="status">{{ i18n.language() === 'ta' ? 'அத்தியாவசிய குறுக்குவழிகள் இன்னும் அமைக்கப்படவில்லை. கீழே உள்ள தேர்ந்தெடுக்கப்பட்ட வகைகளைப் பாருங்கள்.' : 'Shortcuts are not configured yet. Browse the curated categories below.' }}</p>
        } @else {
          <p class="state" role="status">{{ i18n.language() === 'ta' ? 'தற்போது அத்தியாவசியமாக எந்த வகையும் தேர்ந்தெடுக்கப்படவில்லை.' : 'No services have been selected for the essential directory yet.' }}</p>
        }
      </section>

      <section class="essential-categories" aria-labelledby="category-title" [attr.aria-busy]="categoriesLoading()">
        <div class="section-heading"><div><p class="eyebrow">{{ i18n.language() === 'ta' ? 'நிர்வாகத் தேர்வு' : 'ADMIN-CURATED' }}</p><h2 id="category-title">{{ i18n.language() === 'ta' ? 'அத்தியாவசிய வகைகள்' : 'Essential categories' }}</h2></div><span class="count">{{ essentialCategoryCount() }} {{ i18n.language() === 'ta' ? 'வகைகள்' : 'categories' }}</span></div>
        @if (essentialCategories().length) {
          <div class="category-grid row row-cols-2 row-cols-sm-3 row-cols-lg-4 g-3">
            @for (categoryItem of essentialCategories(); track categoryItem.id) { <app-category-card class="col" [category]="categoryItem" variant="marketplace" basePath="/services/category" /> }
          </div>
        }
      </section>

      <section class="listing-section" aria-labelledby="results-title" [attr.aria-busy]="listingsLoading()">
        <div class="section-heading"><div><p class="eyebrow">{{ i18n.language() === 'ta' ? 'உள்ளூர் வழங்குநர்கள்' : 'LOCAL PROVIDERS' }}</p><h2 id="results-title">{{ i18n.language() === 'ta' ? 'அத்தியாவசிய சேவை வழங்குநர்கள்' : 'Essential service listings' }}</h2></div>
          @if (!listingsLoading() && !listingsError()) { <span class="count" aria-live="polite">{{ listingResults().listings.length }} {{ i18n.language() === 'ta' ? 'இந்தப் பக்கத்தில்' : 'on this page' }}</span> }
        </div>
        @if (listingsLoading()) {
          <div class="loading-grid" role="status" aria-label="Loading service listings"><span></span><span></span><span></span></div>
        } @else if (listingsError()) {
          <div class="state error-state"><p role="alert">{{ i18n.language() === 'ta' ? 'சேவைகளை ஏற்ற முடியவில்லை.' : 'Unable to load essential listings.' }}</p><button type="button" class="secondary-button" (click)="retrySearch()">{{ i18n.text().retry }}</button></div>
        } @else if (!listingResults().listings.length) {
          <p class="state" role="status">{{ i18n.language() === 'ta' ? 'இந்த வடிகட்டிகளுக்கு சேவை பட்டியல்கள் இல்லை.' : 'No published listings match these essential service filters.' }}</p>
        } @else {
          <div class="listing-grid row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
            @for (listing of listingResults().listings; track listing.id) { <app-listing-summary class="col" [listing]="listing" /> }
          </div>
          @if (listingPage() > 0 || listingResults().hasMore) {
            <nav class="pagination" [attr.aria-label]="i18n.language() === 'ta' ? 'சேவை பக்கங்கள்' : 'Service listing pages'">
              <button type="button" class="secondary-button" [disabled]="listingPage() === 0 || listingsLoading()" (click)="changePage(listingPage() - 1)">{{ i18n.language() === 'ta' ? 'முந்தைய' : 'Previous' }}</button>
              <span>{{ i18n.language() === 'ta' ? 'பக்கம்' : 'Page' }} {{ listingPage() + 1 }}</span>
              <button type="button" class="secondary-button" [disabled]="!listingResults().hasMore || listingsLoading()" (click)="changePage(listingPage() + 1)">{{ i18n.language() === 'ta' ? 'அடுத்த' : 'Next' }}</button>
            </nav>
          }
        }
      </section>

      <footer class="all-services-cta"><div><p class="eyebrow">{{ i18n.language() === 'ta' ? 'மேலும் கண்டறியுங்கள்' : 'LOOKING FOR MORE?' }}</p><h2>{{ i18n.language() === 'ta' ? 'முழுமையான சேவை அடைவை ஆராயுங்கள்.' : 'Explore the complete service directory.' }}</h2></div><a routerLink="/services" class="secondary-button">{{ i18n.language() === 'ta' ? 'அனைத்து சேவைகளையும் பார்க்க' : 'Browse All Services' }} <i class="bi bi-arrow-right" aria-hidden="true"></i></a></footer>
    </section>
  `,
  styles: `
    :host { display:block; min-width:0; color:var(--cdm-navy); background:var(--cdm-page); }
    .essential-page { padding:clamp(1rem,3vw,2.25rem) calc(var(--bs-gutter-x,1.5rem)/2) 3.5rem; }
    .essential-hero { position:relative; overflow:hidden; padding:clamp(1.25rem,4vw,2.6rem); border-radius:22px; background:radial-gradient(ellipse at 87% 14%,var(--cdm-royal-blue) 0,transparent 28%),linear-gradient(122deg,var(--cdm-navy) 0%,var(--cdm-navy) 66%,var(--cdm-navy) 100%); box-shadow:0 18px 48px color-mix(in srgb, var(--cdm-navy) 9%, transparent); }
    .essential-hero::after { position:absolute; top:-7rem; right:-5rem; width:21rem; height:21rem; border:1px solid #ffffff1a; border-radius:50%; content:""; pointer-events:none; }
    .eyebrow { margin:0 0 .4rem; color:var(--cdm-royal-blue); font-size:.71rem; font-weight:800; letter-spacing:.13em; }
    .essential-hero .eyebrow { color:var(--cdm-yellow); }
    .hero-heading { display:flex; align-items:center; justify-content:space-between; gap:1rem; position:relative; z-index:1; }
    h1 { max-width:790px; margin:0; color:#fff; font-size:clamp(2rem,4.7vw,3.55rem); font-weight:780; letter-spacing:-.045em; line-height:1.08; }
    .hero-heading p { max-width:660px; margin:.7rem 0 0; color:var(--cdm-blue-soft); font-size:1.02rem; line-height:1.65; }
    .hero-symbol { display:grid; place-items:center; flex:0 0 68px; width:68px; height:68px; border:1px solid #ffffff24; border-radius:19px; color:var(--cdm-yellow); background:#ffffff12; font-size:1.8rem; }
    .essential-search { position:relative; z-index:1; display:grid; grid-template-columns:minmax(210px,1.4fr) minmax(160px,.8fr) minmax(190px,1fr) auto auto; align-items:end; gap:.65rem; margin-top:1.6rem; padding:1rem; border:1px solid #ffffff55; border-radius:15px; background:#fff; box-shadow:0 12px 30px #00205024; }
    label { display:grid; min-width:0; gap:.38rem; color:var(--cdm-muted); font-size:.78rem; font-weight:700; }
    input, select { width:100%; min-width:0; min-height:46px; padding:.65rem .8rem; border:1px solid var(--cdm-border); border-radius:9px; color:var(--cdm-navy); background:#fff; font:inherit; font-size:.87rem; }
    .input-wrap { display:flex; align-items:center; gap:.65rem; min-width:0; padding-inline:.8rem; border:1px solid var(--cdm-border); border-radius:9px; background:#fff; }
    .input-wrap:focus-within { border-color:var(--cdm-royal-blue); outline:3px solid color-mix(in srgb, var(--cdm-green) 27%, transparent); outline-offset:2px; }
    .input-wrap i { flex:0 0 auto; color:var(--cdm-navy); }
    .input-wrap input { flex:1 1 auto; width:0; min-width:0; padding:.65rem 0; border:0; border-radius:0; background:transparent; box-shadow:none; }
    .input-wrap input:focus-visible { outline:0; }
    :is(input,select):focus-visible,:is(a,button):focus-visible { outline:3px solid color-mix(in srgb, var(--cdm-btn-primary) 44%, transparent); outline-offset:3px; }
    .search-button,.clear-button,.secondary-button { display:inline-flex; align-items:center; justify-content:center; gap:.45rem; min-height:44px; padding:.6rem .9rem; border:1px solid var(--cdm-btn-primary); border-radius:9px; color:var(--cdm-white); background:var(--cdm-btn-primary); font:inherit; font-size:.82rem; font-weight:750; text-decoration:none; cursor:pointer; }
    .search-button:hover { background:var(--cdm-btn-primary-hover); }.clear-button,.secondary-button { border-color:var(--cdm-btn-border); color:var(--cdm-navy); background:#fff; }.clear-button:hover,.secondary-button:hover { border-color:var(--cdm-btn-primary-hover); background:var(--cdm-btn-primary-light); }
    .location-error { margin:.75rem 0 0; color:var(--cdm-yellow); font-size:.78rem; }
    .emergency-band { display:grid; grid-template-columns:minmax(240px,.9fr) minmax(300px,1.3fr); gap:1rem 2rem; align-items:center; margin-top:1.35rem; padding:1.25rem clamp(1rem,3vw,1.75rem); border:1px solid var(--cdm-form-danger); border-left:5px solid var(--cdm-form-danger); border-radius:14px; background:var(--cdm-page); }
    .emergency-intro { display:flex; gap:.9rem; align-items:center; }.emergency-icon { display:grid; place-items:center; flex:0 0 46px; width:46px; height:46px; border-radius:13px; color:var(--cdm-form-danger); background:var(--cdm-form-danger); font-size:1.15rem; }
    .emergency-band .eyebrow { color:var(--cdm-form-danger); }.emergency-band h2 { margin:0; color:var(--cdm-form-danger); font-size:1.08rem; }.emergency-band p:not(.eyebrow) { margin:.25rem 0 0; color:var(--cdm-navy); font-size:.81rem; }
    .emergency-links { display:flex; flex-wrap:wrap; gap:.5rem; }.emergency-links a { display:inline-flex; align-items:center; gap:.5rem; min-height:42px; padding:.5rem .7rem; border:1px solid var(--cdm-form-danger); border-radius:8px; color:var(--cdm-form-danger); background:white; font-size:.79rem; font-weight:700; text-decoration:none; }.emergency-links a:hover { background:var(--cdm-page); }.emergency-band > small { grid-column:1/-1; color:var(--cdm-navy); font-size:.73rem; }
    .section-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; margin-bottom:1rem; }.section-heading h2,.all-services-cta h2 { margin:0; color:var(--cdm-navy); font-size:clamp(1.25rem,2.3vw,1.65rem); font-weight:760; letter-spacing:-.025em; }.section-heading p:not(.eyebrow) { margin:.35rem 0 0; color:var(--cdm-muted); font-size:.88rem; }
    .priority-section,.essential-categories,.listing-section { margin-top:2rem; }.count { flex:none; color:var(--cdm-muted); font-size:.8rem; }
    .shortcut-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.7rem; }.shortcut-tile { position:relative; display:flex; align-items:center; gap:.75rem; min-width:0; min-height:84px; padding:.8rem; border:1px solid var(--cdm-border); border-radius:12px; color:var(--cdm-navy); background:white; text-decoration:none; transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease; }.shortcut-tile:hover { transform:translateY(-2px); border-color:var(--cdm-border); box-shadow:0 7px 20px color-mix(in srgb, var(--cdm-navy) 5%, transparent); }.shortcut-icon { display:grid; place-items:center; flex:0 0 42px; width:42px; height:42px; border-radius:11px; color:var(--cdm-royal-blue); background:var(--cdm-green-soft); font-size:1.1rem; }.shortcut-copy { display:grid; min-width:0; gap:.22rem; }.shortcut-copy strong { overflow-wrap:anywhere; font-size:.87rem; line-height:1.3; }.shortcut-copy small { overflow:hidden; color:var(--cdm-muted); font-size:.72rem; text-overflow:ellipsis; white-space:nowrap; }.shortcut-arrow { margin-left:auto; color:var(--cdm-muted); }.emergency-tile .shortcut-icon { color:var(--cdm-form-danger); background:var(--cdm-page); }
    .state,.loading-state { display:flex; align-items:center; flex-wrap:wrap; gap:.7rem; min-height:70px; padding:1rem; border:1px solid var(--cdm-border); border-radius:12px; color:var(--cdm-muted); background:#fff; line-height:1.55; }.state p { margin:0; }.error-state { border-color:var(--cdm-form-danger); color:#C92A2A; background:var(--cdm-page); }
    .loading-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; }.loading-grid span { height:180px; border-radius:13px; background:linear-gradient(100deg,var(--cdm-page) 20%,var(--cdm-page) 45%,var(--cdm-page) 70%); background-size:200% 100%; animation:shimmer 1.4s linear infinite; }
    .pagination { display:flex; align-items:center; justify-content:center; gap:.8rem; margin-top:1rem; }.pagination span { min-width:70px; color:var(--cdm-muted); font-size:.83rem; text-align:center; }
    .all-services-cta { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-top:2.5rem; padding:1.3rem 1.5rem; border:1px solid var(--cdm-green-soft); border-radius:15px; background:var(--cdm-page); }.all-services-cta .eyebrow { margin-bottom:.3rem; }
    @keyframes shimmer { to { background-position:-200% 0; } }
    @media(max-width:900px) { .essential-search { grid-template-columns:repeat(2,minmax(0,1fr)); }.keyword-field { grid-column:1/-1; }.shortcut-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }.emergency-band { grid-template-columns:1fr; }.emergency-band > small { grid-column:auto; } }
    @media(max-width:600px) { .essential-page { padding:1rem .75rem 2.5rem; }.essential-hero { padding:1.1rem; border-radius:17px; }.hero-symbol { display:none; }.essential-search { grid-template-columns:1fr; gap:.6rem; margin-top:1.1rem; padding:.8rem; }.keyword-field { grid-column:auto; }.search-button,.clear-button { width:100%; }.shortcut-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:.55rem; }.shortcut-tile { min-height:78px; padding:.6rem; gap:.55rem; }.shortcut-icon { flex-basis:36px; width:36px; height:36px; }.shortcut-copy strong { font-size:.78rem; }.shortcut-copy small { font-size:.68rem; }.section-heading { align-items:flex-start; }.all-services-cta { align-items:stretch; flex-direction:column; }.all-services-cta > a { width:100%; } }
    @media(prefers-reduced-motion:reduce) { .shortcut-tile,.loading-grid span { transition:none; animation:none; } }
  `,
})
export class EssentialServicesComponent implements OnInit {
  protected readonly i18n = inject(LanguageService);
  private readonly categoryService = inject(ServiceCategoryService);
  private readonly essentialService = inject(EssentialServiceService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly essentialCategories = signal<readonly ServiceCategory[]>([]);
  protected readonly shortcuts = signal<readonly EssentialShortcut[]>([]);
  protected readonly categoriesLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly locations = signal<readonly DirectoryLocation[]>([]);
  protected readonly locationsLoading = signal(true);
  protected readonly locationsError = signal(false);
  protected readonly defaultLocationId = signal('');
  protected readonly listingResults = signal<DirectoryPage>({ listings: [], hasMore: false });
  protected readonly listingsLoading = signal(true);
  protected readonly listingsError = signal(false);
  private searchAttempt = signal(0);

  protected readonly searchTerm = computed(() => this.queryParams().get('q') ?? '');
  protected readonly categoryFilter = computed(() => this.queryParams().get('category') ?? '');
  protected readonly locationParam = computed(() => this.queryParams().get('location'));
  protected readonly locationFilter = computed(() => this.locationParam() ?? this.defaultLocationId());
  protected readonly listingPage = computed(() => {
    const page = Number(this.queryParams().get('page') ?? 1);
    return Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page - 1 : 0;
  });
  protected readonly places = computed(() => locationOptions(this.locations(), this.i18n.language()));
  protected readonly searchablePlaces = computed(() => locationSearchOptions(this.locations(), this.i18n.language()));
  protected readonly emergencyShortcuts = computed(() => this.shortcuts().filter(item => item.is_emergency));
  protected readonly categoryOptions = computed<readonly SearchableSelectOption[]>(() => {
    const options: SearchableSelectOption[] = [];
    const visit = (categories: readonly ServiceCategory[], prefix = ''): void => {
      for (const category of categories) {
        const bilingual = `${category.nameEnglish} — ${category.nameTamil}`;
        const label = prefix ? `${prefix} / ${bilingual}` : bilingual;
        options.push({ value: category.id, label, searchText: `${category.nameEnglish} ${category.nameTamil} ${category.slug} ${prefix}` });
        visit(category.subcategories, bilingual);
      }
    };
    visit(this.essentialCategories());
    return options;
  });
  protected readonly essentialCategoryCount = computed(() => this.categoryOptions().length);

  constructor() {
    effect((onCleanup) => {
      const categories = this.essentialCategories();
      const locationsAreLoading = this.locationsLoading();
      const categoryId = this.categoryFilter();
      const locationId = this.locationFilter();
      const keyword = this.searchTerm().trim().slice(0, 200);
      const page = this.listingPage();
      this.searchAttempt();
      let current = true;
      onCleanup(() => { current = false; });
      if (!categories.length || this.categoriesLoading() || locationsAreLoading) {
        this.listingResults.set({ listings: [], hasMore: false });
        this.listingsLoading.set(false);
        return;
      }
      this.listingsLoading.set(true);
      this.listingsError.set(false);
      void this.directory.searchEssential(categoryId || null, locationId || null, keyword, page)
        .then(result => { if (current) this.listingResults.set(result); })
        .catch(() => { if (current) this.listingsError.set(true); })
        .finally(() => { if (current) this.listingsLoading.set(false); });
    });
  }

  ngOnInit(): void { void this.load(); }

  protected async load(): Promise<void> {
    this.categoriesLoading.set(true);
    this.errorMessage.set(null);
    try {
      const [categories, shortcuts] = await Promise.all([
        this.categoryService.getEssentialCategories(true),
        this.essentialService.getEssentialShortcuts(),
      ]);
      this.essentialCategories.set(categories);
      this.shortcuts.set(shortcuts);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load essential services.');
    } finally { this.categoriesLoading.set(false); }
    try {
      const locations = await this.directory.locations();
      this.locations.set(locations);
      const chidambaram = locations.find(place => place.location_type === 'town' && place.name_en?.toLocaleLowerCase() === 'chidambaram')
        ?? locations.find(place => place.name_en?.toLocaleLowerCase() === 'chidambaram' || place.name_ta === 'சிதம்பரம்');
      this.defaultLocationId.set(chidambaram?.id ?? '');
    } catch { this.locationsError.set(true); }
    finally { this.locationsLoading.set(false); }
  }

  protected applySearch(event: Event, keyword: string, categoryId: string, locationId: string): void {
    event.preventDefault();
    void this.router.navigate([], { relativeTo: this.route, queryParams: {
      q: keyword.trim().slice(0, 200) || null, category: categoryId || null,
      location: locationId || null, page: null,
    } });
  }

  protected clearSearch(): void { void this.router.navigate([], { relativeTo: this.route, queryParams: { q: null, category: null, location: null, page: null } }); }
  protected retrySearch(): void { this.searchAttempt.update(value => value + 1); }
  protected changePage(page: number): void { void this.router.navigate([], { relativeTo: this.route, queryParamsHandling: 'merge', queryParams: { page: page > 0 ? page + 1 : null } }); }
}
