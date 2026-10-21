import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategory } from '../core/models/service-category';
import { CategoryCardComponent } from '../home/category-card.component';

@Component({
  selector: 'app-services',
  imports: [CategoryCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="categories-title" [attr.aria-busy]="service.loading()">
      <div class="section-heading"><div>
        <p class="section-kicker">{{ i18n.language() === 'ta' ? 'உங்களுக்காகத் தேர்ந்தெடுக்கப்பட்டது' : 'MADE FOR YOUR COMMUNITY' }}</p>
        <h1 id="categories-title">{{ i18n.text().categories }}</h1>
      </div><span class="category-count" aria-live="polite">{{ filteredCategories().length }} {{ i18n.language() === 'ta' ? 'வகைகள்' : 'categories' }}</span></div>
      <form class="service-search" (submit)="search($event, query.value)">
        <input #query type="search" [value]="searchTerm()" (input)="updateSearch(query.value)" [placeholder]="i18n.language() === 'ta' ? 'சேவைகளைத் தேடுங்கள்...' : 'Search services...'" [attr.aria-label]="i18n.language() === 'ta' ? 'சேவைகளைத் தேடுங்கள்' : 'Search services'">
        <button type="submit">{{ i18n.language() === 'ta' ? 'தேடுக' : 'Search' }}</button>
      </form>
      @if (service.loading()) {
        <div class="state"><p role="status">{{ i18n.text().loading }}</p></div>
      } @else if (service.error()) {
        <div class="state"><p role="alert">{{ i18n.text().error }}</p><button type="button" (click)="service.refresh()">{{ i18n.text().retry }}</button></div>
      } @else if (!filteredCategories().length) {
        <div class="state"><p role="status">{{ searchTerm().trim() ? (i18n.language() === 'ta' ? 'பொருத்தமான சேவைகள் கிடைக்கவில்லை. வேறு சொல்லை முயற்சிக்கவும்.' : 'No matching services. Try another search.') : i18n.text().empty }}</p>
          @if (searchTerm().trim()) {
            <button type="button" (click)="updateSearch('')">{{ i18n.language() === 'ta' ? 'தேடலை நீக்கு' : 'Clear search' }}</button>
          } @else {
            <button type="button" (click)="service.refresh()">{{ i18n.text().refresh }}</button>
          }
        </div>
      } @else {
        <div class="categories">
          @for (category of filteredCategories(); track category.id) {
            <app-category-card [category]="category" />
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }
    .section-heading { display:flex; align-items:end; justify-content:space-between; gap:1rem; margin-bottom:1.1rem; }
    .section-kicker { color:#52665b; font-size:.7rem; font-weight:800; letter-spacing:.12em; margin:0 0 .25rem; }
    h1 { color:#173f32; font-size:clamp(1.5rem,2.5vw,2rem); margin:0; }
    .category-count { color:#52665b; font-size:.85rem; }
    .service-search { display:flex; gap:.5rem; margin-bottom:1.5rem; }
    input { width:100%; min-width:0; border:1px solid #b8c9bf; border-radius:10px; padding:.75rem; background:white; color:#173f32; }
    input::placeholder { color:#52665b; }
    button { border:0; border-radius:9px; background:#075541; color:white; padding:.7rem 1rem; font:inherit; cursor:pointer; min-height:44px; }
    .categories { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; align-items:start; }
    .state { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; padding:1.5rem; border:1px solid #dfe7e2; border-radius:16px; background:white; color:#536b60; line-height:1.8; }
    @media (max-width:1000px) { .categories { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:650px) { .categories { grid-template-columns:1fr; gap:.75rem; } .section-heading { align-items:start; } }
  `,
})
export class ServicesComponent implements OnInit {
  protected readonly service = inject(ServiceCategoryService);
  protected readonly i18n = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly searchTerm = computed(() => this.queryParams().get('q') ?? '');
  protected readonly filteredCategories = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    return term ? this.service.categories().filter(category => this.matchesCategory(category, term)) : this.service.categories();
  });

  ngOnInit(): void { void this.service.load(); }

  protected search(event: Event, term: string): void {
    event.preventDefault();
    this.updateSearch(term);
  }

  protected updateSearch(term: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: term || null }, replaceUrl: true });
  }

  private matchesCategory(category: ServiceCategory, term: string): boolean {
    return `${category.nameTamil} ${category.nameEnglish} ${category.description ?? ''} ${category.slug}`.toLocaleLowerCase().includes(term)
      || category.subcategories.some(child => this.matchesCategory(child, term));
  }
}
