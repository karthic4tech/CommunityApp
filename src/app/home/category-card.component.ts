import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ServiceCategory } from '../core/models/service-category';
import { LanguageService } from '../core/services/language.service';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';

const ICONS: Readonly<Record<string, string>> = {
  house: '⌂', heart: '♡', 'hard-hat': '⚒', hospital: '✚', 'graduation-cap': '✧',
  'book-open': '▤', utensils: '♨', users: '♧', 'car-front': '↗', 'flower-2': '✿',
  recycle: '⟳', store: '▦', dumbbell: '↗', landmark: '▥', 'calendar-days': '▦',
  'briefcase-business': '▣', 'building-2': '▥', 'heart-handshake': '♡', car: '↗',
  sprout: '❧', 'monitor-smartphone': '▣', 'paw-print': '◇',
};
const PALETTES = ['orange', 'rose', 'blue', 'red', 'purple', 'green'];

@Component({
  selector: 'app-category-card',
  imports: [RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #labels>
        <span [class]="'icon ' + paletteFor(category().sortOrder)" aria-hidden="true">{{ iconFor(category().icon) }}</span>
        <span class="labels"><strong [lang]="i18n.language()">{{ i18n.language() === 'ta' ? category().nameTamil : category().nameEnglish }}</strong>
          <span [lang]="i18n.secondaryLanguage()">{{ i18n.language() === 'ta' ? category().nameEnglish : category().nameTamil }}</span>
        </span>
    </ng-template>
    @if (navigable()) {
      <a class="card" [id]="'category-' + category().slug"
        [routerLink]="parentSlug() ? ['/services', parentSlug(), category().slug] : ['/services', category().slug]">
        <ng-container [ngTemplateOutlet]="labels" />
        <span class="arrow" aria-hidden="true">›</span>
      </a>
    } @else {
      <article class="card" [id]="'category-' + category().slug">
        <ng-container [ngTemplateOutlet]="labels" />
      </article>
    }
  `,
  styles: `
    :host { display:block; min-width:0; }
    .card { display:flex; align-items:center; gap:.9rem; padding:1rem 1.1rem; min-height:96px; text-decoration:none; border:1px solid #e0e7e2; border-radius:15px; background:#fff; box-shadow:0 4px 14px #1d483508; transition:border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
    a.card:hover { border-color:#b8d3c3; box-shadow:0 8px 22px #1d483510; transform:translateY(-2px); }
    a.card:focus-visible { outline:3px solid #176044; outline-offset:3px; }
    .icon { flex:0 0 58px; width:58px; height:58px; display:grid; place-items:center; border-radius:13px; font-size:2rem; font-weight:700; }
    .orange { color:#a34b0a; background:#fff0df; }.rose { color:#a52b40; background:#ffeaec; }.blue { color:#236b8e; background:#e0f1f8; }.red { color:#ad2525; background:#ffebeb; }.purple { color:#694184; background:#f0e7f8; }.green { color:#146344; background:#e1f4e9; }
    .labels { display:flex; flex-direction:column; gap:.3rem; min-width:0; flex:1; }
    strong { color:#174b3a; line-height:1.6; font-size:1rem; overflow-wrap:anywhere; }
    .labels > span { color:#52665b; font-size:.82rem; line-height:1.5; overflow-wrap:anywhere; }
    .arrow { color:#174b3a; font-size:1.8rem; line-height:1; margin-left:auto; transition:transform .18s ease; }
    @media (max-width:650px) { .card { min-height:84px; padding:.85rem; gap:.75rem; }.icon { flex-basis:50px; width:50px; height:50px; font-size:1.8rem; } strong { font-size:.95rem; } }
    @media (prefers-reduced-motion: reduce) { .card, .arrow { transition:none; } }
  `,
})
export class CategoryCardComponent {
  readonly category = input.required<ServiceCategory>();
  readonly navigable = input(true);
  readonly parentSlug = input<string | null>(null);
  protected readonly i18n = inject(LanguageService);

  protected iconFor(name: string | null): string {
    return ICONS[name ?? ''] ?? '◇';
  }

  protected paletteFor(sortOrder: number): string {
    return PALETTES[Math.abs(Math.trunc(sortOrder / 10)) % PALETTES.length];
  }
}
