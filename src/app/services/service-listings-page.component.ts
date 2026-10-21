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
        <header>
          <h1 #heading tabindex="-1" id="listing-page-title">{{ i18n.language() === 'ta' ? selected.subcategory.nameTamil : selected.subcategory.nameEnglish }}</h1>
          <p class="secondary" [lang]="i18n.secondaryLanguage()">{{ i18n.language() === 'ta' ? selected.subcategory.nameEnglish : selected.subcategory.nameTamil }}</p>
          @if (selected.subcategory.description) { <p class="description" lang="ta">{{ selected.subcategory.description }}</p> }
        </header>
        <app-listing-directory [category]="selected.subcategory" />
      } @else {
        <h1 #heading tabindex="-1" id="listing-page-title">{{ i18n.language() === 'ta' ? 'சேவை கிடைக்கவில்லை' : 'Service not found' }}</h1>
        <p class="state" role="status">{{ i18n.language() === 'ta' ? 'இந்த வகை அல்லது உட்பிரிவு தற்போது கிடைக்கவில்லை.' : 'This category or subcategory is not currently available.' }}</p>
        <a class="state-link" routerLink="/services">{{ i18n.language() === 'ta' ? 'அனைத்து சேவைகளையும் பார்க்க' : 'Browse all services' }}</a>
      }
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }
    .breadcrumbs { display:flex; align-items:center; flex-wrap:wrap; gap:.55rem; margin-bottom:1rem; color:#52665b; font-size:.9rem; }
    .breadcrumbs a, .state-link { color:#075541; }
    h1 { color:#173f32; font-size:clamp(1.5rem,2.5vw,2rem); margin:0; overflow-wrap:anywhere; }
    .secondary, .description { color:#52665b; line-height:1.8; }
    .description { white-space:pre-line; }
    .state { padding:1.5rem; border:1px solid #dfe7e2; border-radius:16px; background:white; color:#536b60; line-height:1.8; }
    .state-link { display:inline-flex; align-items:center; min-height:44px; margin-top:1rem; }
    button { border:0; border-radius:9px; background:#075541; color:white; padding:.7rem 1rem; font:inherit; cursor:pointer; min-height:44px; }
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
