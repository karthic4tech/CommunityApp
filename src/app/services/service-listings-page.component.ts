import { ChangeDetectionStrategy, Component, ElementRef, OnInit, afterRenderEffect, computed, inject, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ServiceCategory } from '../core/models/service-category';
import { findCategory } from '../core/models/service-listing';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ListingDirectoryComponent } from './listing-directory/listing-directory.component';

interface CategorySelection {
  parent: ServiceCategory;
  subcategory: ServiceCategory;
}

@Component({
  selector: 'app-service-listings-page',
  imports: [RouterLink, ListingDirectoryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="service-listings-page container-xl">
      <nav class="breadcrumbs" [attr.aria-label]="i18n.language() === 'ta' ? 'வழித்தடம்' : 'Breadcrumb'">
        <a routerLink="/services">{{ i18n.language() === 'ta' ? 'சேவைகள்' : 'Services' }}</a>
        <span aria-hidden="true">/</span>
        @if (selection(); as selected) {
          <a [routerLink]="['/services', selected.parent.slug]">{{ i18n.language() === 'ta' ? selected.parent.nameTamil : selected.parent.nameEnglish }}</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{{ i18n.language() === 'ta' ? selected.subcategory.nameTamil : selected.subcategory.nameEnglish }}</span>
        } @else {
          <span aria-current="page">{{ i18n.language() === 'ta' ? 'சேவை' : 'Service' }}</span>
        }
      </nav>
      <section aria-labelledby="listing-page-title" [attr.aria-busy]="categories.loading()">
      @if (categories.loading()) {
        <h1 #heading tabindex="-1" id="listing-page-title">{{ i18n.language() === 'ta' ? 'சேவைகள்' : 'Services' }}</h1>
        <p class="state" role="status">{{ i18n.text().loading }}</p>
      } @else if (categories.error()) {
        <h1 #heading tabindex="-1" id="listing-page-title">{{ i18n.language() === 'ta' ? 'சேவைகள்' : 'Services' }}</h1>
        <div class="state"><p role="alert">{{ i18n.text().error }}</p>
          <button type="button" (click)="categories.refresh()">{{ i18n.text().retry }}</button>
        </div>
      } @else if (selection(); as selected) {
        <header class="listing-page-heading">
          <p class="eyebrow">{{ i18n.language() === 'ta' ? 'உள்ளூர் சேவை' : 'LOCAL SERVICE CATEGORY' }}</p>
          <h1 #heading tabindex="-1" id="listing-page-title">{{ i18n.language() === 'ta' ? selected.subcategory.nameTamil : selected.subcategory.nameEnglish }}</h1>
          <p class="secondary" [lang]="i18n.secondaryLanguage()">{{ i18n.language() === 'ta' ? selected.subcategory.nameEnglish : selected.subcategory.nameTamil }}</p>
          @if (selected.subcategory.description) { <p class="description" [lang]="i18n.language()">{{ selected.subcategory.description }}</p> }
        </header>
        <app-listing-directory [category]="selected.subcategory" />
      } @else {
        <h1 #heading tabindex="-1" id="listing-page-title">{{ i18n.language() === 'ta' ? 'சேவை கிடைக்கவில்லை' : 'Service not found' }}</h1>
        <p class="state" role="status">{{ i18n.language() === 'ta' ? 'இந்த வகை அல்லது உட்பிரிவு தற்போது கிடைக்கவில்லை.' : 'This category or subcategory is not currently available.' }}</p>
        <a class="state-link" routerLink="/services">{{ i18n.language() === 'ta' ? 'அனைத்து சேவைகளையும் பார்க்க' : 'Browse all services' }}</a>
      }
      </section>
    </div>
  `,
  styles: `
    :host { display:block; min-width:0; padding-block:1.25rem 2.5rem; color:#173a50; }
    .service-listings-page { width:100%; max-width:var(--cdm-content-width); margin:0 auto; }
    .breadcrumbs { display:flex; align-items:center; flex-wrap:wrap; gap:.55rem; margin-bottom:1rem; color:#64748b; font-size:.84rem; }
    .breadcrumbs a, .state-link { color:#17634b; }
    .listing-page-heading { padding:clamp(1.25rem,3vw,2rem); border:1px solid #e3eae5; border-radius:16px; background:#fff; }
    .eyebrow { margin:0 0 .4rem; color:#17634b; font-size:.72rem; font-weight:800; letter-spacing:.12em; }
    h1 { color:#12345a; font-size:clamp(1.55rem,3vw,2rem); margin:0; overflow-wrap:anywhere; }
    .secondary, .description { color:#64748b; line-height:1.7; }
    .secondary { margin:.3rem 0 0; }
    .description { margin:.5rem 0 0; white-space:pre-line; }
    .state { display:flex; align-items:center; flex-wrap:wrap; gap:.75rem; margin:1rem 0; padding:1rem 1.15rem; border:1px solid #e3eae5; border-radius:13px; background:white; color:#64748b; line-height:1.7; }
    .state-link { display:inline-flex; align-items:center; min-height:44px; margin-top:1rem; }
    button { min-height:44px; border:1px solid #17634b; border-radius:9px; background:#17634b; color:white; padding:.65rem .9rem; font:inherit; font-weight:700; cursor:pointer; }
    button:focus-visible,a:focus-visible { outline:3px solid #16805b50; outline-offset:3px; }
  `,
})
export class ServiceListingsPageComponent implements OnInit {
  protected readonly categories = inject(ServiceCategoryService);
  protected readonly i18n = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly selection = computed<CategorySelection | undefined>(() => {
    const parent = findCategory(this.categories.categories(), this.params().get('categorySlug') ?? '');
    const subcategorySlug = this.params().get('subcategorySlug') ?? '';
    const subcategory = parent?.subcategories.find(category => category.slug === subcategorySlug);
    return parent && subcategory ? { parent, subcategory } : undefined;
  });
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');

  constructor() {
    afterRenderEffect(() => {
      this.params();
      this.heading()?.nativeElement.focus({ preventScroll: true });
    });
  }

  ngOnInit(): void {
    void this.categories.load();
  }
}
