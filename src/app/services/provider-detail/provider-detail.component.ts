import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ServiceCategory, findCategoryPathById } from '../../core/models/service-category';
import { ServiceListing } from '../../core/models/service-listing';
import { LanguageService } from '../../core/services/language.service';
import { ServiceCategoryService } from '../../core/services/service-category.service';
import { ServiceDirectoryService } from '../../core/services/service-directory.service';
import { ListingSummaryComponent } from '../listing-summary/listing-summary.component';
import { LodgeReviewsComponent } from '../lodge-reviews.component';
import { LodgeInquiryComponent } from '../lodge-inquiry.component';
import { SeoService } from '../../core/services/seo.service';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-provider-detail',
  imports: [RouterLink, ListingSummaryComponent, LodgeReviewsComponent, LodgeInquiryComponent],
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
                <a [routerLink]="['/services/category', category.slug]">{{ i18n.language() === 'ta' ? category.nameTamil : category.nameEnglish }}</a>
              } @else {
                <span>{{ i18n.language() === 'ta' ? category.nameTamil : category.nameEnglish }}</span>
              }
            }
          }
        </nav>
        <app-listing-summary [listing]="selected" [detail]="true" [hidePhoneContacts]="isLodgeListing()" />
        @if (isLodgeListing()) { <app-lodge-inquiry [listing]="selected" /> }
        @if (isLodgeListing()) { <app-lodge-reviews [listingId]="selected.id" [signInReturnUrl]="lodgeReviewReturnUrl(selected)" [startWriting]="queryParams().get('review') === 'write'" /> }
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
    :host { display:block; width:min(var(--cdm-content-width), calc(100% - 2 * var(--cdm-page-gutter))); margin-inline:auto; }
    .breadcrumbs { display:flex; align-items:center; flex-wrap:wrap; gap:.55rem; margin-bottom:1rem; color:var(--cdm-muted); font-size:.9rem; }
    .breadcrumbs a, .back-link { color:var(--cdm-royal-blue); }
    .related { margin-top:2rem; }
    .related h2 { color:var(--cdm-navy); font-size:1.25rem; }
    .related-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; }
    .back-link { display:inline-flex; align-items:center; min-height:44px; margin-top:1rem; }
    @media (max-width:1000px) { .related-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:650px) { .related-grid { grid-template-columns:1fr; } }
  `,
})
export class ServiceDetailComponent implements OnInit {
  protected readonly i18n = inject(LanguageService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly categoryService = inject(ServiceCategoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly attempts = signal(0);
  protected readonly listing = signal<ServiceListing | null>(null);
  protected readonly related = signal<readonly ServiceListing[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly categoryPath = computed<ServiceCategory[] | undefined>(() => {
    const current = this.listing();
    return current ? findCategoryPathById(this.categoryService.categories(), current.category_id) : undefined;
  });
  protected readonly isLodgeListing = computed(() => this.categoryPath()?.some(category => ['hotels', 'lodge-stay'].includes(category.slug)) ?? false);

  protected lodgeReviewReturnUrl(listing: ServiceListing): string {
    const path = listing.slug ? `/services/${listing.slug}` : `/providers/${listing.id}`;
    return `${path}?review=write#reviews`;
  }

  constructor() {
    effect(onCleanup => {
      const id = this.params().get('id') ?? '';
      const slug = this.params().get('slug');
      this.attempts();
      this.loading.set(true);
      this.error.set(false);
      this.listing.set(null);
      this.related.set([]);
      this.seo.setNoIndex(slug ? `/services/${slug}` : `/providers/${id}`);
      let current = true;
      onCleanup(() => { current = false; });
      void (slug ? this.directory.detailBySlug(slug) : this.directory.detail(id)).then(listing => {
        if (!current) return;
        this.listing.set(listing);
        if (listing) {
          const category = listing.service_categories?.name_en?.trim() || 'Local Service';
          const categorySlug = listing.service_categories?.slug ?? '';
          if (['hotels', 'lodge-stay'].includes(categorySlug)) this.analytics.track('hotel_listing_view');
          const listingPath = listing.slug ? `/services/${listing.slug}` : `/providers/${listing.id}`;
          const lodging = ['hotels', 'lodge-stay'].includes(categorySlug);
          const restaurant = ['restaurants', 'vegetarian-restaurants', 'non-vegetarian-restaurants'].includes(categorySlug);
          const providerSchema = {
            '@type': lodging ? 'Hotel' : restaurant ? 'Restaurant' : 'Organization',
            name: listing.service_providers.display_name,
            ...(listing.service_providers.description ? { description: listing.service_providers.description } : {}),
            url: `https://cdm360.in${listingPath}`,
          };
          const serviceSchema = {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: listing.title,
            description: listing.description,
            serviceType: category,
            url: `https://cdm360.in${listingPath}`,
            inLanguage: this.i18n.language() === 'ta' ? 'ta-IN' : 'en-IN',
            provider: providerSchema,
            ...(listing.listing_locations.length
              ? {
                  areaServed: listing.listing_locations.flatMap(({ locations }) =>
                    locations ? [{ '@type': 'Place', name: locations.name_en?.trim() || locations.name_ta }] : [],
                  ),
                }
              : {}),
          };
          this.seo.update({
            title: `${listing.title} – ${category} in Chidambaram | CDM 360`,
            description: listing.description?.trim()
              || `Public ${category.toLocaleLowerCase()} listing for ${listing.title} in Chidambaram. Contact the provider to confirm current details.`,
            path: listingPath,
            language: this.i18n.language(),
            structuredData: [
              serviceSchema,
              this.seo.breadcrumbSchema([
                { name: 'Home', path: '/' },
                { name: 'Services', path: '/services' },
                ...(categorySlug ? [{ name: category, path: `/services/category/${categorySlug}` }] : []),
                { name: listing.title, path: listingPath },
              ]),
            ],
          });
          void this.directory.related(listing.service_providers.id, listing.id)
            .then(related => { if (current) this.related.set(related); })
            .catch(() => { /* Related services are optional; keep the detail usable. */ });
        } else this.seo.setNoIndex(slug ? `/services/${slug}` : `/providers/${id}`);
      }).catch(() => { if (current) this.error.set(true); })
        .finally(() => { if (current) this.loading.set(false); });
    });
  }

  ngOnInit(): void {
    void this.categoryService.load();
  }

  protected retry(): void { this.attempts.update(value => value + 1); }
}

export { ServiceDetailComponent as ProviderDetailComponent };
