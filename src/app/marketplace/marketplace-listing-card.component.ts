import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MarketplaceListing } from './marketplace.models';

@Component({
  selector: 'app-marketplace-listing-card',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="mp-card">
      <a class="mp-card-link" [routerLink]="['/marketplace/item', listing().id, listing().slug]" [attr.aria-label]="'View ' + listing().title">
        <div class="mp-card-image">
          @if (primaryImage(); as image) { <img [src]="image" [alt]="listing().images?.[0]?.alt_text || listing().title" loading="lazy" decoding="async"> }
          @else { <div class="mp-image-fallback" aria-hidden="true"><i class="bi bi-image"></i></div> }
          @if (listing().is_featured) { <span class="mp-featured"><i class="bi bi-stars" aria-hidden="true"></i> Featured</span> }
          @if (listing().condition === 'brand_new') { <span class="mp-condition-new">New</span> }
        </div>
        <div class="mp-card-body">
          <div class="mp-price-row"><strong>{{ listing().price | currency:'INR':'symbol':'1.0-0' }}</strong>@if (listing().is_negotiable) { <span>Negotiable</span> }</div>
          <h3>{{ listing().title }}</h3>
          <p class="mp-card-meta"><span>{{ listing().location?.name_en || listing().location?.name_ta || 'Chidambaram' }}</span><span aria-hidden="true">·</span><span>{{ conditionLabel() }}</span></p>
          <time [attr.datetime]="listing().published_at || listing().created_at">{{ (listing().published_at || listing().created_at) | date:'mediumDate' }}</time>
        </div>
      </a>
      <button class="mp-favourite" type="button" [class.saved]="saved()" [attr.aria-pressed]="saved()" [attr.aria-label]="saved() ? 'Remove from favourites' : 'Save to favourites'" (click)="$event.stopPropagation(); favourite.emit(listing().id)">
        <i class="bi" [class.bi-heart]="!saved()" [class.bi-heart-fill]="saved()" aria-hidden="true"></i>
      </button>
    </article>
  `,
  styles: `
    :host { display:block; min-width:0; height:100%; }
    .mp-card { position:relative; height:100%; overflow:hidden; border:1px solid var(--cdm-border); border-radius:14px; background:#fff; transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease; }
    .mp-card:hover { transform:translateY(-2px); border-color:var(--cdm-border); box-shadow:0 12px 28px color-mix(in srgb, var(--cdm-navy) 7%, transparent); }
    .mp-card-link { display:block; height:100%; color:inherit; text-decoration:none; }
    .mp-card-image { position:relative; overflow:hidden; aspect-ratio:4/3; background:var(--cdm-page); }
    .mp-card-image img { width:100%; height:100%; object-fit:cover; transition:transform .3s ease; }.mp-card:hover img { transform:scale(1.025); }
    .mp-image-fallback { display:grid; place-items:center; width:100%; height:100%; color:var(--cdm-muted); font-size:2rem; }
    .mp-featured,.mp-condition-new { position:absolute; top:.65rem; left:.65rem; display:inline-flex; align-items:center; gap:.3rem; padding:.32rem .55rem; border-radius:999px; color:var(--cdm-yellow); background:var(--cdm-yellow); font-size:.68rem; font-weight:800; }
    .mp-condition-new { top:auto; bottom:.65rem; left:.65rem; color:var(--cdm-navy); background:var(--cdm-page); }
    .mp-card-body { padding:.85rem .9rem 1rem; }.mp-price-row { display:flex; align-items:center; gap:.55rem; }.mp-price-row strong { color:var(--cdm-navy); font-size:1.13rem; font-weight:800; }.mp-price-row span { color:var(--cdm-muted); font-size:.67rem; }
    h3 { display:-webkit-box; min-height:2.55em; margin:.4rem 0 .45rem; overflow:hidden; color:var(--cdm-navy); font-size:.9rem; font-weight:700; line-height:1.4; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
    .mp-card-meta { display:flex; align-items:center; gap:.35rem; margin:0 0 .35rem; overflow:hidden; color:var(--cdm-muted); font-size:.72rem; white-space:nowrap; }.mp-card-meta span:first-child { overflow:hidden; text-overflow:ellipsis; }.mp-card time { color:var(--cdm-muted); font-size:.68rem; }
    .mp-favourite { position:absolute; top:.55rem; right:.55rem; display:grid; place-items:center; width:38px; height:38px; padding:0; border:1px solid #ffffffc7; border-radius:50%; color:var(--cdm-navy); background:#ffffffec; box-shadow:0 2px 8px #00000014; }.mp-favourite.saved { color:var(--cdm-form-danger); }.mp-favourite i { font-size:1.1rem; }
    :is(a,button):focus-visible { outline:3px solid color-mix(in srgb, var(--cdm-btn-primary) 50%, transparent); outline-offset:3px; }
    @media(prefers-reduced-motion:reduce) { .mp-card,.mp-card-image img { transition:none; } }
  `,
})
export class MarketplaceListingCardComponent {
  readonly listing = input.required<MarketplaceListing>();
  readonly saved = input(false);
  readonly favourite = output<string>();
  protected primaryImage(): string | null {
    const images = this.listing().images ?? [];
    return images.find(image => image.is_primary)?.url ?? images[0]?.url ?? null;
  }
  protected conditionLabel(): string {
    return ({ brand_new: 'Brand New', like_new: 'Like New', gently_used: 'Gently Used', good: 'Good', fair: 'Fair', for_parts: 'For Parts' } as const)[this.listing().condition];
  }
}
