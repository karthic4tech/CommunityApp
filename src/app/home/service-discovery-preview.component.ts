import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EssentialShortcut } from '../core/models/essential-service';
import { ServiceCategory } from '../core/models/service-category';
import { EssentialServiceService } from '../core/services/essential-service.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { CategoryCardComponent } from './category-card.component';

@Component({
  selector: 'app-service-discovery-preview',
  imports: [RouterLink, CategoryCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="discovery-preview">
      <section class="quick-section" aria-labelledby="quick-title">
        <div class="section-heading"><div><p class="eyebrow">CDM 360 / QUICK ACCESS</p><h2 id="quick-title">Need Something? Find It Quickly.</h2><p>Quick access to the services people need most in Chidambaram.</p></div><a class="text-link emergency-cta" routerLink="/essential-services" [queryParams]="{ q: 'ambulance' }"><i class="bi bi-telephone-forward" aria-hidden="true"></i>Quick Emergency Contacts</a></div>
        @if (loading()) { <p class="state" role="status">Loading service shortcuts…</p> }
        @else if (shortcutError()) { <p class="state" role="status">Service shortcuts need the Essential Services database migration.</p> }
        @else if (shortcuts().length) {
          <div class="shortcut-strip">
            @for (shortcut of shortcuts(); track shortcut.id) {
              <a class="shortcut" [class.emergency]="shortcut.is_emergency" [routerLink]="shortcut.destination">
                <span class="shortcut-icon"><i class="bi" [class]="shortcut.icon || 'bi bi-grid'" aria-hidden="true"></i></span>
                <span>{{ shortcut.title }}</span><i class="bi bi-arrow-up-right" aria-hidden="true"></i>
              </a>
            }
          </div>
        } @else { <p class="state" role="status">No service shortcuts are published yet.</p> }
      </section>

      <section class="preview-section essential-preview" aria-labelledby="essential-preview-title">
        <div class="section-heading"><div><p class="eyebrow">A CURATED LOCAL SELECTION</p><h2 id="essential-preview-title">Essential Services</h2><p>Important local services, all in one place.</p></div><a class="section-link" routerLink="/essential-services">Explore Essential Services <i class="bi bi-arrow-right" aria-hidden="true"></i></a></div>
        @if (loading()) { <p class="state" role="status">Loading selected services…</p> }
        @else if (essentialError()) { <p class="state" role="status">Apply the Essential Services migration to load curated categories.</p> }
        @else if (essentialCategories().length) {
          <div class="category-grid row row-cols-2 row-cols-sm-3 row-cols-lg-4 g-3">
            @for (category of essentialCategories(); track category.id) { <app-category-card class="col" [category]="category" variant="marketplace" basePath="/services/category" /> }
          </div>
        } @else { <p class="state" role="status">Essential categories will appear here when selected by an administrator.</p> }
      </section>

      <section class="preview-section all-preview" aria-labelledby="all-preview-title">
        <div class="section-heading"><div><p class="eyebrow">THE COMPLETE COMMUNITY DIRECTORY</p><h2 id="all-preview-title">Explore All Services</h2><p>Discover every service available in your community.</p></div><a class="section-link" routerLink="/services">View All Services <i class="bi bi-arrow-right" aria-hidden="true"></i></a></div>
        @if (loading()) { <p class="state" role="status">Loading all service categories…</p> }
        @else if (error()) { <p class="state" role="status">Active service categories could not be loaded.</p> }
        @else if (allPreview().length) {
          <div class="category-grid row row-cols-2 row-cols-sm-3 row-cols-lg-4 g-3">
            @for (category of allPreview(); track category.id) { <app-category-card class="col" [category]="category" variant="marketplace" basePath="/services/category" /> }
          </div>
        } @else { <p class="state" role="status">No active service categories are available right now.</p> }
      </section>
    </div>
  `,
  styles: `
    :host { display:block; }
    .discovery-preview { display:grid; gap:2.1rem; width:min(1220px,calc(100% - 2rem)); margin:0 auto; padding:2.5rem 0 3rem; }
    .quick-section,.preview-section { min-width:0; }
    .quick-section { padding:clamp(1rem,3vw,1.65rem); border:1px solid var(--cdm-border); border-radius:17px; background:linear-gradient(125deg,var(--cdm-page),#fff 68%); }
    .section-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
    .eyebrow { margin:0 0 .4rem; color:var(--cdm-royal-blue); font-size:.69rem; font-weight:800; letter-spacing:.13em; }
    h2 { margin:0; color:var(--cdm-navy); font-size:clamp(1.25rem,2.4vw,1.7rem); font-weight:770; letter-spacing:-.03em; }
    .section-heading p:not(.eyebrow) { margin:.35rem 0 0; color:var(--cdm-muted); font-size:.88rem; line-height:1.55; }
    .text-link,.section-link { display:inline-flex; align-items:center; gap:.45rem; min-height:42px; flex:none; color:var(--cdm-royal-blue); font-size:.8rem; font-weight:750; text-decoration:none; }
    .text-link:hover,.section-link:hover { color:var(--cdm-royal-blue); text-decoration:underline; text-underline-offset:.2em; }
    .emergency-cta { padding:.55rem .75rem; border:1px solid var(--cdm-form-danger); border-radius:9px; color:#C92A2A; background:var(--cdm-page); }
    .shortcut-strip { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:.55rem; }
    .shortcut { display:flex; align-items:center; gap:.5rem; min-width:0; min-height:54px; padding:.55rem .65rem; border:1px solid var(--cdm-border); border-radius:10px; color:var(--cdm-navy); background:#fff; font-size:.76rem; font-weight:700; text-decoration:none; transition:border-color .15s ease,transform .15s ease; }
    .shortcut:hover { transform:translateY(-1px); border-color:var(--home-saffron); }.shortcut > span:nth-child(2) { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.shortcut > i:last-child { margin-left:auto; color:var(--cdm-muted); font-size:.78rem; }
    .shortcut-icon { display:grid; place-items:center; flex:0 0 30px; width:30px; height:30px; border-radius:8px; color:var(--cdm-royal-blue); background:var(--home-saffron-light); font-size:.92rem; }.shortcut.emergency { border-color:var(--cdm-form-danger); }.shortcut.emergency .shortcut-icon { color:var(--cdm-form-danger); background:var(--cdm-page); }
    .essential-preview { padding:0 0 1.8rem; border-bottom:1px solid var(--cdm-border); }.all-preview { padding:0; }.category-grid { align-items:stretch; }
    .state { margin:0; padding:1rem; border:1px solid var(--cdm-border); border-radius:10px; color:var(--cdm-muted); background:#fff; }
    :is(a,button):focus-visible { outline:3px solid color-mix(in srgb, var(--home-saffron) 50%, transparent); outline-offset:3px; }
    @media(max-width:850px) { .shortcut-strip { grid-template-columns:repeat(4,minmax(0,1fr)); } }
    @media(max-width:600px) { .discovery-preview { width:calc(100% - 1.5rem); gap:1.5rem; padding:1.5rem 0 2rem; }.section-heading { align-items:flex-start; flex-direction:column; }.section-link { align-self:flex-start; }.shortcut-strip { grid-template-columns:repeat(2,minmax(0,1fr)); }.shortcut { font-size:.72rem; }.quick-section { padding:.9rem; } }
    @media(prefers-reduced-motion:reduce) { .shortcut { transition:none; } }
  `,
})
export class ServiceDiscoveryPreviewComponent implements OnInit {
  private readonly categoryService = inject(ServiceCategoryService);
  private readonly essentialService = inject(EssentialServiceService);
  protected readonly categories = this.categoryService.categories;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly essentialError = signal(false);
  protected readonly shortcutError = signal(false);
  protected readonly shortcuts = signal<readonly EssentialShortcut[]>([]);
  protected readonly essentialCategories = signal<readonly ServiceCategory[]>([]);
  protected readonly allPreview = computed(() => this.categories().slice(0, 6));

  ngOnInit(): void { void this.load(); }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    this.essentialError.set(false);
    this.shortcutError.set(false);
    const [allResult, essentialResult, shortcutResult] = await Promise.allSettled([
      this.categoryService.load(),
      this.categoryService.getEssentialCategories(),
      this.essentialService.getEssentialShortcuts(),
    ]);
    if (allResult.status === 'rejected' || this.categoryService.error()) this.error.set(true);
    if (essentialResult.status === 'fulfilled') {
      const essential = essentialResult.value;
      this.essentialCategories.set(essential
        .filter(category => category.showOnHomepage)
        .sort((a, b) => (a.homepageOrder ?? a.sortOrder) - (b.homepageOrder ?? b.sortOrder))
        .slice(0, 8));
    } else {
      this.essentialError.set(true);
    }
    if (shortcutResult.status === 'fulfilled') {
      const shortcuts = shortcutResult.value;
      this.shortcuts.set(shortcuts.slice(0, 12));
    } else {
      this.shortcutError.set(true);
    }
    this.loading.set(false);
  }
}
