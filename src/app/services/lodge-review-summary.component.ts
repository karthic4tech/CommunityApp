import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { LanguageService } from '../core/services/language.service';
import { LodgeReviewSummary, LodgeReviewsService } from '../core/services/lodge-reviews.service';

@Component({
  selector: 'app-lodge-review-summary',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lodge-rating-summary" [attr.aria-busy]="loading()">
      @if (loading()) {
        <span class="rating-skeleton" role="status" [attr.aria-label]="i18n.language() === 'ta' ? 'மதிப்பீடுகள் ஏற்றப்படுகின்றன' : 'Loading ratings'"></span>
      } @else if (error()) {
        <span class="rating-loading" role="status">{{ i18n.language() === 'ta' ? 'மதிப்பீடுகள் இப்போது இல்லை' : 'Ratings temporarily unavailable' }}</span>
      } @else if (summary()?.review_count; as count) {
        <span class="rating-stars" aria-hidden="true">★</span>
        <strong>{{ summary()?.average_rating | number:'1.1-1' }}</strong>
        <span>{{ count }} {{ i18n.language() === 'ta' ? 'மதிப்பீடுகள்' : (count === 1 ? 'review' : 'reviews') }}</span>
      } @else {
        <span class="new-listing">{{ i18n.language() === 'ta' ? 'புதிய பட்டியல் – மதிப்பீடுகள் இல்லை' : 'New Listing – No Reviews Yet' }}</span>
      }
    </div>
  `,
  styles: `
    :host { display:block; min-width:0; }
    .lodge-rating-summary { display:flex; align-items:center; flex-wrap:wrap; gap:.35rem; min-height:34px; color:#52657b; font-size:.78rem; }
    .rating-stars { color:#b88619; font-size:1rem; }
    .lodge-rating-summary strong { color:#102b4c; font-size:.85rem; }
    .new-listing { color:#52657b; }
    .rating-loading { color:#65758a; font-size:.75rem; }
    .rating-skeleton { display:block; width:140px; height:15px; border-radius:999px; background:linear-gradient(90deg,#edf0f2 25%,#f8f9fa 45%,#edf0f2 65%); background-size:220% 100%; animation:rating-shimmer 1.2s ease-in-out infinite; }
    @keyframes rating-shimmer { to { background-position-x:-220%; } }
    @media(prefers-reduced-motion:reduce) { .rating-skeleton { animation:none; } }
  `,
})
export class LodgeReviewSummaryComponent {
  readonly listingId = input.required<string>();
  protected readonly i18n = inject(LanguageService);
  private readonly reviews = inject(LodgeReviewsService);
  protected readonly summary = signal<LodgeReviewSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  constructor() {
    effect(onCleanup => {
      const listingId = this.listingId();
      let active = true;
      this.loading.set(true);
      this.error.set(false);
      void this.reviews.summary(listingId).then(summary => {
        if (active) this.summary.set(summary);
      }).catch(() => {
        if (active) this.error.set(true);
      }).finally(() => {
        if (active) this.loading.set(false);
      });
      onCleanup(() => { active = false; });
    });
  }
}
