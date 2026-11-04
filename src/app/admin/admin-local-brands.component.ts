import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocalBrand } from '../core/models/local-brand';
import { LocalBrandService } from '../core/services/local-brand.service';

@Component({
  selector: 'app-admin-local-brands',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="admin-brands" aria-labelledby="admin-brands-title" [attr.aria-busy]="loading() || savingId() !== null">
      <header class="page-header">
        <div>
          <a class="back-link" routerLink="/admin"><i class="bi bi-arrow-left" aria-hidden="true"></i> Admin dashboard</a>
          <p class="eyebrow">HOMEPAGE CONTENT</p>
          <h1 id="admin-brands-title">Local brands</h1>
          <p class="intro">Feature verified businesses with an active published service and set their display order.</p>
        </div>
      </header>

      @if (message(); as text) { <p class="message" role="status" aria-live="polite">{{ text }}</p> }
      @if (error(); as text) { <div class="state error-state" role="alert"><p>{{ text }}</p><button type="button" class="secondary-action" (click)="load()">Try again</button></div> }
      @else if (loading()) { <p class="state" role="status">Loading eligible businesses…</p> }
      @else if (!businesses().length) { <p class="state" role="status">No verified businesses with active published services are available to feature.</p> }
      @else {
        <div class="business-list">
          @for (business of businesses(); track business.id) {
            <article class="business-row">
              @if (business.logoUrl) {
                <img class="business-logo" [src]="business.logoUrl" [alt]="business.logoAlt" width="120" height="68" loading="lazy" />
              } @else {
                <span class="business-logo logo-fallback" aria-hidden="true">{{ initials(business.displayName) }}</span>
              }
              <div class="business-name"><h2>{{ business.displayName }}</h2><small>Verified · Active published listing</small></div>
              <label class="feature-toggle"><input #featured type="checkbox" [checked]="business.featured" [disabled]="savingId() !== null" /> Feature on homepage</label>
              <label class="order-field"><span>Display order</span><input #order type="number" min="0" step="1" required [value]="business.featureOrder" [disabled]="savingId() !== null" /></label>
              <button type="button" class="save-button" [disabled]="savingId() !== null" (click)="save(business, featured.checked, order.value)">
                {{ savingId() === business.id ? 'Saving…' : 'Save' }}
              </button>
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host { display:block; min-width:0; padding-block:1.5rem 2.5rem; }
    .admin-brands { display:grid; gap:1rem; }
    .page-header { display:flex; justify-content:space-between; gap:1rem; padding:clamp(1.5rem,4vw,2.25rem); border:1px solid #e4e8e3; border-radius:18px; background:#fff; }
    .back-link { display:inline-flex; align-items:center; gap:.4rem; min-height:40px; margin-bottom:.7rem; color:#16805b; font-size:.84rem; font-weight:700; text-decoration:none; }
    .eyebrow { margin:0 0 .4rem; color:#16805b; font-size:.73rem; font-weight:800; letter-spacing:.12em; }
    h1 { margin:0; color:#12345a; font-size:clamp(1.75rem,4vw,2.4rem); }
    .intro { margin:.5rem 0 0; color:#667580; line-height:1.6; }
    .business-list { display:grid; gap:.75rem; }
    .business-row { display:grid; grid-template-columns:120px minmax(160px,1fr) minmax(150px,auto) 130px auto; align-items:center; gap:1rem; padding:1rem; border:1px solid #e4e8e3; border-radius:14px; background:#fff; }
    .business-logo { display:grid; place-items:center; width:120px; height:68px; border:1px solid #edf0ec; border-radius:9px; background:#fbfcfa; object-fit:contain; }
    .logo-fallback { color:#12345a; font-size:1.15rem; font-weight:800; }
    .business-name { min-width:0; }
    .business-name h2 { margin:0; color:#12345a; font-size:1rem; overflow-wrap:anywhere; }
    .business-name small { color:#667580; font-size:.75rem; }
    .feature-toggle { display:inline-flex; align-items:center; gap:.5rem; color:#33495a; font-size:.84rem; font-weight:650; }
    .feature-toggle input { width:1.1rem; height:1.1rem; accent-color:#16805b; }
    .order-field { display:grid; gap:.3rem; color:#526575; font-size:.75rem; font-weight:700; }
    .order-field input { width:100%; min-height:40px; padding:.45rem .6rem; border:1px solid #d4ddd8; border-radius:8px; color:#12345a; font:inherit; font-size:.9rem; }
    .save-button { min-height:42px; padding:.55rem .85rem; border:1px solid #16805b; border-radius:8px; background:#16805b; color:#fff; font:inherit; font-size:.84rem; font-weight:750; cursor:pointer; }
    .save-button:disabled { cursor:wait; opacity:.6; }
    .state { display:flex; align-items:center; flex-wrap:wrap; gap:.75rem; margin:0; padding:1rem; border:1px solid #e4e8e3; border-radius:12px; background:#fff; color:#667580; }
    .state p { margin:0; }.error-state { color:#96332c; }
    .secondary-action { min-height:40px; padding:.45rem .7rem; border:1px solid #d5ded8; border-radius:8px; background:#fff; color:#12345a; font:inherit; font-weight:700; }
    .message { margin:0; color:#176044; font-weight:700; }
    :is(a,button,input):focus-visible { outline:3px solid #16805b60; outline-offset:3px; }
    @media(max-width:850px) { .business-row { grid-template-columns:90px minmax(0,1fr) auto; } .business-logo { width:90px; height:62px; } .feature-toggle { grid-column:2; } .order-field { grid-column:1 / 3; } .save-button { grid-column:3; grid-row:2; } }
    @media(max-width:520px) { .business-row { grid-template-columns:72px minmax(0,1fr); gap:.7rem; } .business-logo { width:72px; height:56px; } .feature-toggle, .order-field, .save-button { grid-column:1 / -1; grid-row:auto; } .save-button { width:100%; } }
  `,
})
export class AdminLocalBrandsComponent implements OnInit {
  private readonly brandsService = inject(LocalBrandService);
  protected readonly businesses = signal<LocalBrand[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly savingId = signal<string | null>(null);

  ngOnInit(): void { void this.load(); }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try { this.businesses.set(await this.brandsService.eligibleBusinesses()); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to load eligible businesses.'); }
    finally { this.loading.set(false); }
  }

  protected async save(business: LocalBrand, featured: boolean, rawOrder: string): Promise<void> {
    const order = Number(rawOrder);
    if (!rawOrder.trim() || !Number.isSafeInteger(order) || order < 0) {
      this.error.set('Display order must be a non-negative whole number.');
      return;
    }
    this.savingId.set(business.id);
    this.error.set(null);
    this.message.set(null);
    try {
      await this.brandsService.updateFeature(business.id, featured, order);
      await this.load();
      this.message.set('Homepage brand settings saved.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to save homepage brand settings.');
    } finally {
      this.savingId.set(null);
    }
  }

  protected initials(name: string): string {
    return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toLocaleUpperCase()).join('') || 'CD';
  }
}
