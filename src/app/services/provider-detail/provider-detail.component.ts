import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ServiceCategory, findCategoryPathById } from '../../core/models/service-category';
import { ServiceListing } from '../../core/models/service-listing';
import { LanguageService } from '../../core/services/language.service';
import { ServiceCategoryService } from '../../core/services/service-category.service';
import { ServiceDirectoryService } from '../../core/services/service-directory.service';
import { ListingSummaryComponent } from '../listing-summary/listing-summary.component';

@Component({
  selector: 'app-provider-detail',
  imports: [RouterLink, ListingSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [attr.aria-busy]="loading()" [attr.aria-label]="i18n.language() === 'ta' ? 'சேவை விவரங்கள்' : 'Service details'">
      @if (loading()) {
        <h1 id="provider-page-title">{{ i18n.language() === 'ta' ? 'சேவை விவரங்கள்' : 'Service details' }}</h1>
        <p class="state" role="status">{{ i18n.language() === 'ta' ? 'விவரங்கள் ஏற்றப்படுகின்றன…' : 'Loading service details…' }}</p>
      } @else if (error()) {
        <h1 id="provider-page-title">{{ i18n.language() === 'ta' ? 'சேவை விவரங்கள்' : 'Service details' }}</h1>
        <div class="state"><p role="alert">{{ i18n.language() === 'ta' ? 'விவரங்களை ஏற்ற முடியவில்லை.' : 'Unable to load service details.' }}</p>
          <button type="button" (click)="retry()">{{ i18n.text().retry }}</button></div>
      } @else if (listing(); as selected) {
        <nav class="breadcrumbs" [attr.aria-label]="i18n.language() === 'ta' ? 'வழித்தடம்' : 'Breadcrumb'">
          <a routerLink="/services">{{ i18n.language() === 'ta' ? 'சேவைகள்' : 'Services' }}</a>
          @if (categoryPath(); as path) {
            @for (category of path; track category.id; let last = $last; let index = $index) {
              <span aria-hidden="true">/</span>
              @if (last) {
                <span aria-current="page">{{ i18n.language() === 'ta' ? category.nameTamil : category.nameEnglish }}</span>
              } @else if (index === 0) {
                <a [routerLink]="['/services', category.slug]">{{ i18n.language() === 'ta' ? category.nameTamil : category.nameEnglish }}</a>
              } @else {
                <span>{{ i18n.language() === 'ta' ? category.nameTamil : category.nameEnglish }}</span>
              }
            }
          }
        </nav>
        <app-listing-summary [listing]="selected" [detail]="true" />
        @if (related().length) {
          <section class="related" aria-labelledby="related-title">
            <h2 id="related-title">{{ i18n.language() === 'ta' ? 'இந்த வழங்குநரின் பிற சேவைகள்' : 'More services from this provider' }}</h2>
            <div class="related-grid">
              @for (service of related(); track service.id) { <app-listing-summary [listing]="service" /> }
            </div>
          </section>
        }
      } @else {
        <h1 id="provider-page-title">{{ i18n.language() === 'ta' ? 'சேவை கிடைக்கவில்லை' : 'Service not found' }}</h1>
        <p class="state" role="status">{{ i18n.language() === 'ta' ? 'இந்த சேவை தற்போது பொதுவில் கிடைக்கவில்லை.' : 'This service is not currently available to the public.' }}</p>
        <a class="back-link" routerLink="/services">{{ i18n.language() === 'ta' ? 'அனைத்து சேவைகளையும் பார்க்க' : 'Browse all services' }}</a>
      }
    </section>
  `,
  styleUrl: '../directory.scss',
  styles: `
    .breadcrumbs { display:flex; align-items:center; flex-wrap:wrap; gap:.55rem; margin-bottom:1rem; color:#52665b; font-size:.9rem; }
    .breadcrumbs a, .back-link { color:#075541; }
    .related { margin-top:2rem; }
    .related h2 { color:#173f32; font-size:1.25rem; }
    .related-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; }
    .back-link { display:inline-flex; align-items:center; min-height:44px; margin-top:1rem; }
    @media (max-width:1000px) { .related-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:650px) { .related-grid { grid-template-columns:1fr; } }
  `,
})
export class ProviderDetailComponent implements OnInit {
  protected readonly i18n = inject(LanguageService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly categoryService = inject(ServiceCategoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly attempts = signal(0);
  protected readonly listing = signal<ServiceListing | null>(null);
  protected readonly related = signal<readonly ServiceListing[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly categoryPath = computed<ServiceCategory[] | undefined>(() => {
    const current = this.listing();
    return current ? findCategoryPathById(this.categoryService.categories(), current.category_id) : undefined;
  });

  constructor() {
    effect(onCleanup => {
      const id = this.params().get('id') ?? '';
      this.attempts();
      this.loading.set(true);
      this.error.set(false);
      this.listing.set(null);
      this.related.set([]);
      let current = true;
      onCleanup(() => { current = false; });
      void this.directory.detail(id).then(listing => {
        if (!current) return;
        this.listing.set(listing);
        if (listing) {
          void this.directory.related(listing.service_providers.id, listing.id)
            .then(related => { if (current) this.related.set(related); })
            .catch(() => { /* Related services are optional; keep the detail usable. */ });
        }
      }).catch(() => { if (current) this.error.set(true); })
        .finally(() => { if (current) this.loading.set(false); });
    });
  }

  ngOnInit(): void {
    void this.categoryService.load();
  }

  protected retry(): void { this.attempts.update(value => value + 1); }
}
