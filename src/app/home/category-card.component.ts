import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ServiceCategory } from '../core/models/service-category';
import { LanguageService } from '../core/services/language.service';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';

const ICONS: Readonly<Record<string, string>> = {
  house: 'bi-house-heart', heart: 'bi-heart-pulse', 'hard-hat': 'bi-cone-striped', hospital: 'bi-hospital', 'graduation-cap': 'bi-mortarboard',
  'book-open': 'bi-book-half', utensils: 'bi-cup-hot', users: 'bi-people', 'car-front': 'bi-car-front', 'flower-2': 'bi-flower1',
  recycle: 'bi-recycle', store: 'bi-shop', dumbbell: 'bi-activity', landmark: 'bi-bank', 'calendar-days': 'bi-calendar-event',
  'briefcase-business': 'bi-briefcase', 'building-2': 'bi-buildings', 'heart-handshake': 'bi-heart', car: 'bi-car-front',
  sprout: 'bi-flower2', 'monitor-smartphone': 'bi-phone', 'paw-print': 'bi-patch-check',
};
const PALETTES = ['orange', 'rose', 'blue', 'red', 'purple', 'green'];
const MARKETPLACE_PALETTES = ['market-navy', 'market-green', 'market-saffron'];

@Component({
  selector: 'app-category-card',
  imports: [RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #labels>
        <span [class]="'icon ' + paletteFor(category().sortOrder)" aria-hidden="true"><i class="bi" [class]="'bi ' + iconFor(category().icon ?? iconOverride())"></i></span>
        <span class="labels">
          @if (i18n.language() === 'ta') {
            <strong lang="ta">{{ category().nameTamil }}</strong>
          } @else {
            <strong lang="en">{{ category().nameEnglish }}</strong>
          }
          @if (variant() === 'marketplace' && category().subcategories.length) {
            <small class="subcategory-count">{{ category().subcategories.length }} {{ i18n.language() === 'ta' ? 'துணைவகைகள்' : 'subcategories' }}</small>
          }
          @if (variant() === 'marketplace') {
            <small class="marketplace-hint">{{ i18n.language() === 'ta' ? 'சேவைகளைப் பாருங்கள்' : 'Explore services' }}</small>
          }
        </span>
    </ng-template>
    @if (navigable()) {
      <a class="card" [class.marketplace-card]="variant() === 'marketplace'" [id]="'category-' + category().slug"
        [routerLink]="parentSlug() ? ['/services', parentSlug(), category().slug] : ['/services', category().slug]">
        <ng-container [ngTemplateOutlet]="labels" />
        <span class="arrow" aria-hidden="true">›</span>
      </a>
    } @else {
      <article class="card" [class.marketplace-card]="variant() === 'marketplace'" [id]="'category-' + category().slug">
        <ng-container [ngTemplateOutlet]="labels" />
      </article>
    }
  `,
  styles: `
    :host { display:block; min-width:0; }
    .card { display:flex; align-items:center; gap:.9rem; padding:1rem 1.1rem; min-height:96px; text-decoration:none; border:1px solid #e0e7e2; border-radius:15px; background:#fff; box-shadow:0 4px 14px #1d483508; transition:border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
    a.card:hover { border-color:#b8d3c3; box-shadow:0 8px 22px #1d483510; transform:translateY(-2px); }
    a.card:focus-visible { outline:3px solid #176044; outline-offset:3px; }
    .icon { flex:0 0 58px; width:58px; height:58px; display:grid; place-items:center; border-radius:13px; font-size:1.45rem; font-weight:700; }
    .orange { color:#a34b0a; background:#fff0df; }.rose { color:#a52b40; background:#ffeaec; }.blue { color:#236b8e; background:#e0f1f8; }.red { color:#ad2525; background:#ffebeb; }.purple { color:#694184; background:#f0e7f8; }.green { color:#146344; background:#e1f4e9; }
    .labels { display:flex; flex-direction:column; gap:.3rem; min-width:0; flex:1; }
    strong { color:#174b3a; line-height:1.6; font-size:1rem; overflow-wrap:anywhere; }
    .labels > span { color:#52665b; font-size:.82rem; line-height:1.5; overflow-wrap:anywhere; }
    .arrow { color:#174b3a; font-size:1.8rem; line-height:1; margin-left:auto; transition:transform .18s ease; }
    .marketplace-card { position:relative; height:100%; min-height:132px; flex-direction:column; align-items:stretch; gap:.55rem; padding:.9rem; border-radius:14px; box-shadow:none; }
    .marketplace-card .icon { flex:0 0 42px; width:42px; height:42px; border-radius:11px; font-size:1.12rem; }
    .marketplace-card .market-navy { color:#23496b; background:#edf3f8; }
    .marketplace-card .market-green { color:#17634b; background:#edf6f1; }
    .marketplace-card .market-saffron { color:#8a650b; background:#fbf5e5; }
    .marketplace-card .labels { gap:.25rem; }
    .marketplace-card strong { color:#12345a; line-height:1.35; }
    .subcategory-count { color:#64748b; font-size:.74rem; font-weight:550; line-height:1.35; }
    .marketplace-hint { color:#17634b; font-size:.72rem; font-weight:700; line-height:1.3; }
    .marketplace-card .arrow { position:absolute; top:.9rem; right:.95rem; color:#698373; font-size:1.25rem; }
    @media (max-width:650px) { .card { min-height:84px; padding:.85rem; gap:.75rem; }.icon { flex-basis:50px; width:50px; height:50px; font-size:1.8rem; } strong { font-size:.95rem; } }
    @media (prefers-reduced-motion: reduce) { .card, .arrow { transition:none; } }
  `,
})
export class CategoryCardComponent {
  readonly category = input.required<ServiceCategory>();
  readonly navigable = input(true);
  readonly parentSlug = input<string | null>(null);
  readonly variant = input<'default' | 'marketplace'>('default');
  readonly iconOverride = input<string | null>(null);
  protected readonly i18n = inject(LanguageService);

  protected iconFor(name: string | null): string {
    return ICONS[name ?? ''] ?? 'bi-grid';
  }

  protected paletteFor(sortOrder: number): string {
    if (this.variant() === 'marketplace') return MARKETPLACE_PALETTES[Math.abs(Math.trunc(sortOrder)) % MARKETPLACE_PALETTES.length];
    return PALETTES[Math.abs(Math.trunc(sortOrder / 10)) % PALETTES.length];
  }
}
