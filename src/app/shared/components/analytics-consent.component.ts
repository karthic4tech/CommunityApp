import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-analytics-consent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (analytics.showConsentChoices()) {
      <section class="analytics-consent" role="region" aria-labelledby="analytics-consent-title">
        <div class="consent-copy">
          <h2 id="analytics-consent-title">Optional analytics</h2>
          <p>Allow CDM 360 to measure visits to public pages and improve the site. Analytics stays off unless you allow it. You can change this choice later in Privacy settings.</p>
        </div>
        <div class="consent-actions">
          @if (analytics.consent() !== 'unknown') {
            <button type="button" class="consent-close" (click)="analytics.closePrivacySettings()">Close</button>
          }
          <button type="button" class="consent-reject" (click)="analytics.setConsent(false)">Reject optional analytics</button>
          <button type="button" class="consent-accept" (click)="analytics.setConsent(true)">Allow analytics</button>
        </div>
      </section>
    } @else if (analytics.showPrivacySettings()) {
      <button type="button" class="privacy-settings" (click)="analytics.openPrivacySettings()">Privacy settings</button>
    }
  `,
  styles: `
    :host { position:relative; z-index:1060; }
    .analytics-consent { position:fixed; right:1rem; bottom:1rem; left:1rem; display:flex; align-items:center; justify-content:space-between; gap:1.25rem; max-width:70rem; margin-inline:auto; padding:1rem 1.15rem; border:1px solid #b8c8d8; border-radius:14px; background:#fff; color:#002050; box-shadow:0 12px 40px rgb(0 32 80 / .2); }
    .consent-copy { min-width:0; }
    .consent-copy h2 { margin:0 0 .25rem; color:#002050; font-size:1rem; }
    .consent-copy p { max-width:68ch; margin:0; color:#42566f; font-size:.84rem; line-height:1.5; }
    .consent-actions { display:flex; flex:none; flex-wrap:wrap; justify-content:flex-end; gap:.5rem; }
    .consent-actions button,.privacy-settings { min-height:44px; padding:.6rem .8rem; border:1px solid #71849b; border-radius:8px; background:#fff; color:#002050; font:inherit; font-size:.8rem; font-weight:700; cursor:pointer; }
    .consent-actions .consent-accept { border-color:#087f69; background:#087f69; color:#fff; }
    .privacy-settings { position:fixed; right:1rem; bottom:1rem; z-index:1060; box-shadow:0 3px 14px rgb(0 32 80 / .16); }
    .consent-actions button:focus-visible,.privacy-settings:focus-visible { outline:3px solid #0755b8; outline-offset:3px; }
    @media(max-width:700px) {
      .analytics-consent { align-items:stretch; flex-direction:column; gap:.7rem; padding:.9rem; }
      .consent-actions { display:grid; grid-template-columns:1fr 1fr; }
      .consent-actions .consent-close { grid-column:1/-1; justify-self:end; }
      .consent-actions button { min-width:0; padding:.55rem; font-size:.75rem; }
    }
    @media(prefers-reduced-motion:reduce) { *,*:before,*:after { scroll-behavior:auto; transition-duration:.01ms; } }
  `,
})
export class AnalyticsConsentComponent {
  protected readonly analytics = inject(AnalyticsService);
}
