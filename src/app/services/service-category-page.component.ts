import { ChangeDetectionStrategy, Component, ElementRef, OnInit, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ServiceCategory } from '../core/models/service-category';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { LanguageService } from '../core/services/language.service';
import { CategoryCardComponent } from '../home/category-card.component';
import { findCategory } from '../core/models/service-listing';

@Component({
  selector: 'app-service-category-page',
  imports: [RouterLink, CategoryCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="category-page container-xl">
      <nav class="breadcrumbs" [attr.aria-label]="i18n.language() === 'ta' ? 'வழித்தடம்' : 'Breadcrumb'">
        <a routerLink="/services">{{ i18n.language() === 'ta' ? 'சேவைகள்' : 'Services' }}</a>
        <span aria-hidden="true">/</span>
        @if (category(); as selected) {
          <span aria-current="page">{{ i18n.language() === 'ta' ? selected.nameTamil : selected.nameEnglish }}</span>
        } @else {
          <span aria-current="page">{{ i18n.language() === 'ta' ? 'சேவை வகை' : 'Service category' }}</span>
        }
      </nav>
      <section aria-labelledby="category-title" [attr.aria-busy]="service.loading()">
      @if (service.loading()) {
        <h1 #heading tabindex="-1" id="category-title">{{ i18n.text().categories }}</h1>
        <p class="state" role="status">{{ i18n.text().loading }}</p>
      } @else if (service.error()) {
        <h1 #heading tabindex="-1" id="category-title">{{ i18n.text().categories }}</h1>
        <div class="state"><p role="alert">{{ i18n.text().error }}</p>
          <button type="button" (click)="service.refresh()">{{ i18n.text().retry }}</button>
        </div>
      } @else if (category(); as selected) {
        <header>
          <p class="eyebrow">{{ i18n.language() === 'ta' ? 'சேவை வகை' : 'SERVICE CATEGORY' }}</p>
          <h1 #heading tabindex="-1" id="category-title">{{ i18n.language() === 'ta' ? selected.nameTamil : selected.nameEnglish }}</h1>
          <p class="secondary" [lang]="i18n.secondaryLanguage()">{{ i18n.language() === 'ta' ? selected.nameEnglish : selected.nameTamil }}</p>
          @if (selected.description) { <p class="description" [lang]="i18n.language()">{{ selected.description }}</p> }
        </header>
        @if (selected.subcategories.length) {
          <div class="subcategory-heading">
            <div><h2>{{ i18n.language() === 'ta' ? 'துணைவகைகள் மூலம் கண்டறியுங்கள்' : 'Find a subcategory' }}</h2><p>{{ filteredSubcategories().length }} {{ i18n.language() === 'ta' ? 'துணைவகைகள்' : 'subcategories' }}</p></div>
            <label class="subcategory-search" for="subcategory-search"><span class="visually-hidden">{{ i18n.language() === 'ta' ? 'துணைவகைகளைத் தேடுங்கள்' : 'Search subcategories' }}</span><i class="bi bi-search" aria-hidden="true"></i><input id="subcategory-search" type="search" [value]="subcategorySearch()" (input)="subcategorySearch.set(searchInput.value)" #searchInput [placeholder]="i18n.language() === 'ta' ? 'துணைவகையைத் தேடுங்கள்' : 'Search subcategories'" /></label>
          </div>
        }
        @if (filteredSubcategories().length) {
          <div class="subcategories row row-cols-2 row-cols-sm-3 row-cols-lg-4 row-cols-xl-5 g-3">
            @for (child of filteredSubcategories(); track child.id) {
              <app-category-card class="col" [category]="child" [parentSlug]="selected.slug" [iconOverride]="selected.icon" variant="marketplace" />
            }
          </div>
        } @else if (selected.subcategories.length) {
          <div class="state empty-state"><i class="bi bi-search" aria-hidden="true"></i><p role="status">{{ i18n.language() === 'ta' ? 'பொருந்தும் துணைவகைகள் இல்லை.' : 'No matching subcategories.' }}</p><button class="secondary-button" type="button" (click)="subcategorySearch.set('')">{{ i18n.language() === 'ta' ? 'தேடலை நீக்கு' : 'Clear search' }}</button></div>
        } @else {
          <p class="state empty-state" role="status">{{ i18n.text().noChildren }}</p>
        }
      } @else {
        <h1 #heading tabindex="-1" id="category-title">{{ i18n.language() === 'ta' ? 'சேவை வகை கிடைக்கவில்லை' : 'Service category not found' }}</h1>
        <p class="state" role="status">{{ i18n.language() === 'ta' ? 'இந்த சேவை வகை தற்போது கிடைக்கவில்லை. அனைத்து சேவைகளையும் பார்க்கவும்.' : 'This service category is currently unavailable. Browse all services instead.' }}</p>
        <a class="state-link" routerLink="/services">{{ i18n.language() === 'ta' ? 'அனைத்து சேவைகளையும் பார்க்க' : 'Browse all services' }}</a>
      }
      </section>
    </div>
  `,
  styles: `
    :host { display:block; min-width:0; padding-block:1.25rem 2.5rem; color:#173a50; }
    .category-page { width:100%; max-width:var(--cdm-content-width); margin:0 auto; }
    .breadcrumbs { display:flex; align-items:center; flex-wrap:wrap; gap:.55rem; margin-bottom:1rem; color:#64748b; font-size:.84rem; }
    .breadcrumbs a, .state-link { color:#17634b; }
    header { padding:clamp(1.25rem,3vw,2rem); border:1px solid #e3eae5; border-radius:16px; background:#fff; }
    .eyebrow { margin:0 0 .4rem; color:#17634b; font-size:.72rem; font-weight:800; letter-spacing:.12em; }
    h1 { color:#12345a; font-size:clamp(1.55rem,3vw,2rem); margin:0; overflow-wrap:anywhere; }
    .secondary, .description { color:#64748b; line-height:1.7; }
    .secondary { margin:.3rem 0 0; }
    .description { margin:.5rem 0 0; white-space:pre-line; }
    .subcategory-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; margin:1.5rem 0 .85rem; }
    h2 { color:#12345a; font-size:1.15rem; margin:0; }
    .subcategory-heading p { margin:.25rem 0 0; color:#64748b; font-size:.82rem; }
    .subcategory-search { position:relative; flex:0 1 320px; }
    .subcategory-search i { position:absolute; left:.85rem; top:50%; transform:translateY(-50%); color:#647c6e; }
    .subcategory-search input { width:100%; min-height:44px; padding:.6rem .8rem .6rem 2.35rem; border:1px solid #d4dfd9; border-radius:9px; color:#173a50; font:inherit; }
    .subcategory-search input:focus-visible { outline:3px solid #16805b30; outline-offset:1px; }
    .subcategories { align-items:stretch; }
    .state { display:flex; align-items:center; flex-wrap:wrap; gap:.7rem; margin:1rem 0; padding:1rem 1.15rem; border:1px solid #e3eae5; border-radius:13px; background:#fff; color:#64748b; line-height:1.65; }
    .state p { margin:0; }
    .empty-state > i { color:#17634b; }
    .state-link { display:inline-flex; align-items:center; min-height:44px; margin-top:1rem; }
    .secondary-button { min-height:42px; padding:.5rem .8rem; border:1px solid #d4dfd9; border-radius:8px; background:#fff; color:#12345a; font:inherit; font-weight:700; }
    .visually-hidden { position:absolute; width:1px; height:1px; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
    :is(a,button,input):focus-visible { outline:3px solid #16805b50; outline-offset:3px; }
    @media (max-width:620px) { .subcategory-heading { align-items:stretch; flex-direction:column; }.subcategory-search { flex-basis:auto; } }
  `,
})
export class ServiceCategoryPageComponent implements OnInit {
  protected readonly service = inject(ServiceCategoryService);
  protected readonly i18n = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly category = computed(() => findCategory(this.service.categories(), this.params().get('categorySlug') ?? ''));
  protected readonly subcategorySearch = signal('');
  protected readonly filteredSubcategories = computed(() => {
    const subcategories = this.category()?.subcategories ?? [];
    const term = this.subcategorySearch().trim().toLocaleLowerCase();
    return term ? subcategories.filter((subcategory) => this.matchesSubcategory(subcategory, term)) : subcategories;
  });
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');

  constructor() {
    afterRenderEffect(() => {
      this.params();
      this.heading()?.nativeElement.focus({ preventScroll: true });
    });
  }

  ngOnInit(): void {
    void this.service.load();
  }

  private matchesSubcategory(category: ServiceCategory, term: string): boolean {
    return `${category.nameTamil} ${category.nameEnglish} ${category.description ?? ''} ${category.slug}`.toLocaleLowerCase().includes(term)
      || category.subcategories.some((child) => this.matchesSubcategory(child, term));
  }
}
