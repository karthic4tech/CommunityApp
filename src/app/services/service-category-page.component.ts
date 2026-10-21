import { ChangeDetectionStrategy, Component, ElementRef, OnInit, afterRenderEffect, computed, inject, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { LanguageService } from '../core/services/language.service';
import { CategoryCardComponent } from '../home/category-card.component';
import { findCategory } from '../core/models/service-listing';

@Component({
  selector: 'app-service-category-page',
  imports: [RouterLink, CategoryCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
          <h1 #heading tabindex="-1" id="category-title">{{ i18n.language() === 'ta' ? selected.nameTamil : selected.nameEnglish }}</h1>
          <p class="secondary" [lang]="i18n.secondaryLanguage()">{{ i18n.language() === 'ta' ? selected.nameEnglish : selected.nameTamil }}</p>
          @if (selected.description) { <p class="description" lang="ta">{{ selected.description }}</p> }
        </header>
        <div class="section-heading">
          <h2>{{ i18n.language() === 'ta' ? 'உட்பிரிவுகள்' : 'Subcategories' }}</h2>
          <span>{{ selected.subcategories.length }} {{ i18n.language() === 'ta' ? 'உட்பிரிவுகள்' : 'subcategories' }}</span>
        </div>
        @if (selected.subcategories.length) {
          <div class="subcategories">
            @for (child of selected.subcategories; track child.id) {
              <app-category-card [category]="child" [parentSlug]="selected.slug" />
            }
          </div>
        } @else {
          <p class="state" role="status">{{ i18n.text().noChildren }}</p>
        }
      } @else {
        <h1 #heading tabindex="-1" id="category-title">{{ i18n.language() === 'ta' ? 'சேவை வகை கிடைக்கவில்லை' : 'Service category not found' }}</h1>
        <p class="state" role="status">{{ i18n.language() === 'ta' ? 'இந்த சேவை வகை தற்போது கிடைக்கவில்லை. அனைத்து சேவைகளையும் பார்க்கவும்.' : 'This service category is currently unavailable. Browse all services instead.' }}</p>
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
    .section-heading { display:flex; justify-content:space-between; align-items:center; gap:1rem; margin:2rem 0 1rem; }
    h2 { font-size:1.2rem; margin:0; }
    .section-heading span { color:#52665b; font-size:.85rem; }
    .subcategories { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; align-items:start; }
    .state { padding:1.5rem; border:1px solid #dfe7e2; border-radius:16px; background:white; color:#536b60; line-height:1.8; }
    .state-link { display:inline-flex; align-items:center; min-height:44px; margin-top:1rem; }
    button { border:0; border-radius:9px; background:#075541; color:white; padding:.7rem 1rem; font:inherit; cursor:pointer; min-height:44px; }
    @media (max-width:1000px) { .subcategories { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:650px) { .subcategories { grid-template-columns:1fr; gap:.75rem; } .section-heading { align-items:start; } }
  `,
})
export class ServiceCategoryPageComponent implements OnInit {
  protected readonly service = inject(ServiceCategoryService);
  protected readonly i18n = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly category = computed(() => findCategory(this.service.categories(), this.params().get('categorySlug') ?? ''));
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
}
