import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocalBrand } from '../core/models/local-brand';
import { LanguageService } from '../core/services/language.service';
import { LocalBrandService } from '../core/services/local-brand.service';

@Component({
  selector: 'app-business-directory',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="business-directory" aria-labelledby="business-directory-title" [attr.aria-busy]="loading()">
      <header class="directory-heading">
        <div>
          <p class="eyebrow">{{ i18n.language() === 'ta' ? 'உள்ளூர் வணிக அடைவு' : 'CDM360 BUSINESS DIRECTORY' }}</p>
          <h1 id="business-directory-title">{{ i18n.language() === 'ta' ? 'சிதம்பரத்தின் உள்ளூர் வணிகங்கள்' : 'Local businesses in Chidambaram' }}</h1>
          <p>{{ i18n.language() === 'ta' ? 'சரிபார்க்கப்பட்டு தற்போது செயல்படும் உள்ளூர் வணிகங்களைக் கண்டறியுங்கள்.' : 'Explore verified local businesses with active published services.' }}</p>
        </div>
      </header>

      @if (loading()) {
        <p class="directory-state" role="status">{{ i18n.language() === 'ta' ? 'வணிகங்கள் ஏற்றப்படுகின்றன…' : 'Loading businesses…' }}</p>
      } @else if (error(); as message) {
        <div class="directory-state" role="alert"><p>{{ message }}</p><button type="button" class="retry" (click)="load()">{{ i18n.text().retry }}</button></div>
      } @else if (!businesses().length) {
        <p class="directory-state" role="status">{{ i18n.language() === 'ta' ? 'செயல்படும் வணிகங்கள் தற்போது இல்லை.' : 'There are no active businesses to show right now.' }}</p>
      } @else {
        <div class="business-grid">
          @for (business of businesses(); track business.id) {
            <a class="business-card" [routerLink]="['/providers', business.listingId]" [attr.aria-label]="(i18n.language() === 'ta' ? 'வணிக விவரங்களைத் திறக்கவும்: ' : 'Open business details: ') + business.displayName">
              <span class="logo-frame">
                @if (business.logoUrl) {
                  <img [src]="business.logoUrl" [alt]="business.logoAlt" width="180" height="100" loading="lazy" decoding="async" />
                } @else {
                  <span class="logo-fallback" role="img" [attr.aria-label]="(i18n.language() === 'ta' ? 'லோகோ இல்லை: ' : 'Logo unavailable: ') + business.displayName">
                    <i class="bi bi-shop-window" aria-hidden="true"></i><strong>{{ initials(business.displayName) }}</strong>
                  </span>
                }
              </span>
              <strong>{{ business.displayName }}</strong>
              <span class="card-link">{{ i18n.language() === 'ta' ? 'வணிக விவரங்கள்' : 'Business details' }} <i class="bi bi-arrow-right" aria-hidden="true"></i></span>
            </a>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host { display:block; min-width:0; padding-block:1.5rem 3rem; }
    .business-directory { width:min(1200px,calc(100% - 40px)); margin-inline:auto; display:grid; gap:1.25rem; }
    .directory-heading { padding:clamp(1.5rem,4vw,2.25rem); border:1px solid var(--cdm-border); border-radius:18px; background:#fff; }
    .eyebrow { margin:0 0 .45rem; color:var(--cdm-royal-blue); font-size:.73rem; font-weight:800; letter-spacing:.12em; }
    h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.8rem,4vw,2.5rem); letter-spacing:-.03em; }
    .directory-heading p:last-child { margin:.55rem 0 0; color:var(--cdm-muted); line-height:1.6; }
    .business-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:1rem; }
    .business-card { display:grid; justify-items:center; gap:.7rem; min-width:0; min-height:200px; padding:1rem; border:1px solid var(--cdm-border); border-radius:14px; background:#fff; color:var(--cdm-navy); text-align:center; text-decoration:none; transition:border-color .18s ease,transform .18s ease,box-shadow .18s ease; }
    .business-card:hover { border-color:var(--cdm-border); box-shadow:0 6px 18px color-mix(in srgb, var(--cdm-navy) 5%, transparent); transform:translateY(-2px); }
    .business-card:focus-visible { outline:3px solid color-mix(in srgb, var(--cdm-green) 38%, transparent); outline-offset:3px; }
    .logo-frame { display:grid; place-items:center; width:100%; height:112px; padding:.7rem; border-radius:10px; background:var(--cdm-page); }
    .logo-frame img { display:block; width:100%; height:100%; object-fit:contain; object-position:center; }
    .logo-fallback { display:grid; place-items:center; align-content:center; gap:.25rem; width:100%; height:100%; border:1px dashed var(--cdm-border); border-radius:8px; background:var(--cdm-blue-soft); color:var(--cdm-royal-blue); }
    .logo-fallback i { color:var(--cdm-yellow); }.logo-fallback strong { color:var(--cdm-navy); font-size:1.2rem; }
    .card-link { display:inline-flex; align-items:center; gap:.4rem; margin-top:auto; color:var(--cdm-royal-blue); font-size:.8rem; font-weight:700; }
    .directory-state { display:flex; align-items:center; flex-wrap:wrap; gap:.75rem; min-height:100px; margin:0; padding:1.2rem; border:1px solid var(--cdm-border); border-radius:14px; background:#fff; color:var(--cdm-muted); }
    .retry { min-height:42px; padding:.55rem .85rem; border:1px solid var(--cdm-border); border-radius:8px; background:#fff; color:var(--cdm-navy); font:inherit; font-weight:700; }
    @media(max-width:600px) { .business-directory { width:calc(100% - 28px); } .business-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:.7rem; } .business-card { min-height:170px; padding:.7rem; } .logo-frame { height:90px; } }
  `,
})
export class BusinessDirectoryComponent implements OnInit {
  protected readonly i18n = inject(LanguageService);
  private readonly brandsService = inject(LocalBrandService);
  protected readonly businesses = signal<LocalBrand[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void { void this.load(); }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try { this.businesses.set(await this.brandsService.eligibleBusinesses()); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to load businesses.'); }
    finally { this.loading.set(false); }
  }

  protected initials(name: string): string {
    return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toLocaleUpperCase()).join('') || 'CD';
  }
}
