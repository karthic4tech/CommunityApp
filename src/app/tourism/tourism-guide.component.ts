import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LanguageService } from '../core/services/language.service';
import { SeoService } from '../core/services/seo.service';
import { TOURISM_GUIDES } from './tourism-guide-content';

@Component({
  selector: 'app-tourism-guide',
  imports: [NgOptimizedImage, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (guide(); as selected) {
      <main class="guide-shell" aria-labelledby="guide-title">
        <nav class="breadcrumbs" [attr.aria-label]="isTamil() ? 'வழித்தடம்' : 'Breadcrumb'">
          <a routerLink="/">{{ isTamil() ? 'முகப்பு' : 'Home' }}</a>
          <span aria-hidden="true">/</span>
          <a routerLink="/tourism">{{ isTamil() ? 'சுற்றுலா' : 'Tourism' }}</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{{ isTamil() ? selected.titleTamil : selected.titleEnglish }}</span>
        </nav>

        <article class="guide-card">
          <header class="guide-header">
            <p class="eyebrow">{{ isTamil() ? 'சுயாதீன பார்வையாளர் வழிகாட்டி' : 'INDEPENDENT VISITOR GUIDE' }}</p>
            <h1 id="guide-title">{{ isTamil() ? selected.titleTamil : selected.titleEnglish }}</h1>
            <p class="guide-intro">{{ isTamil() ? selected.descriptionTamil : selected.descriptionEnglish }}</p>
            <figure class="guide-image">
              <img
                [ngSrc]="selected.image"
                [width]="selected.imageWidth"
                [height]="selected.imageHeight"
                priority
                sizes="(max-width: 760px) 100vw, 900px"
                [alt]="isTamil() ? selected.imageAltTamil : selected.imageAltEnglish"
              />
              <figcaption>{{ isTamil() ? 'விளக்கப் படம்' : 'Illustrative image; not an official destination photograph' }}</figcaption>
            </figure>
          </header>

          @for (section of selected.sections; track section.headingEnglish) {
            <section class="guide-section" [attr.aria-labelledby]="'guide-section-' + $index">
              <h2 [id]="'guide-section-' + $index">{{ isTamil() ? section.headingTamil : section.headingEnglish }}</h2>
              <p>{{ isTamil() ? section.bodyTamil : section.bodyEnglish }}</p>
            </section>
          }

          <section class="guide-faq" aria-labelledby="guide-faq-title">
            <h2 id="guide-faq-title">{{ isTamil() ? 'பயணக் கேள்விகள்' : 'Visitor questions' }}</h2>
            @for (faq of selected.faqs; track faq.questionEnglish) {
              <details>
                <summary>{{ isTamil() ? faq.questionTamil : faq.questionEnglish }}</summary>
                <p>{{ isTamil() ? faq.answerTamil : faq.answerEnglish }}</p>
              </details>
            }
          </section>

          <aside class="source-note" aria-label="Source and verification">
            <p>
              {{ isTamil() ? 'ஆதாரம்' : 'Source' }}:
              <a [href]="selected.sourceUrl" target="_blank" rel="noopener noreferrer">{{ selected.sourceLabel }}</a>
              @if (selected.secondarySourceUrl && selected.secondarySourceLabel) {
                · <a [href]="selected.secondarySourceUrl" target="_blank" rel="noopener noreferrer">{{ selected.secondarySourceLabel }}</a>
              }
            </p>
            <p>
              {{ isTamil() ? 'மூலப் பக்கத்தின் கடைசி புதுப்பிப்பு' : 'Source page last updated' }}:
              <time [attr.datetime]="selected.sourceUpdatedAt">{{ selected.sourceUpdatedAt }}</time>.
              {{ isTamil() ? 'இந்த வழிகாட்டி சரிபார்க்கப்பட்டது' : 'This guide checked' }}:
              <time [attr.datetime]="selected.lastVerifiedAt">{{ selected.lastVerifiedAt }}</time>.
              {{ isTamil() ? 'நேரம், விதி மற்றும் கிடைப்புத் தகவலைப் பயணத்திற்கு முன் மீண்டும் உறுதிப்படுத்தவும்.' : 'Reconfirm time-sensitive details before travel.' }}
            </p>
          </aside>

          <nav class="related-links" [attr.aria-label]="isTamil() ? 'தொடர்புடைய உள்ளூர் சேவைகள்' : 'Related local services'">
            <a class="primary-link" routerLink="/services">{{ isTamil() ? 'உள்ளூர் சேவைகளைப் பாருங்கள்' : 'Browse local services' }}</a>
            <a routerLink="/services/transport-tourism-services/lodge-stay">{{ isTamil() ? 'வெளியிடப்பட்ட தங்குமிடப் பட்டியல்கள்' : 'Published stay listings' }}</a>
            <a routerLink="/tourism">{{ isTamil() ? 'சுற்றுலா வழிகாட்டிக்குத் திரும்பு' : 'Back to the tourism guide' }}</a>
          </nav>
        </article>
      </main>
    } @else {
      <main class="guide-shell" aria-labelledby="guide-missing-title">
        <nav class="breadcrumbs" [attr.aria-label]="isTamil() ? 'வழித்தடம்' : 'Breadcrumb'">
          <a routerLink="/">{{ isTamil() ? 'முகப்பு' : 'Home' }}</a>
          <span aria-hidden="true">/</span>
          <a routerLink="/tourism">{{ isTamil() ? 'சுற்றுலா' : 'Tourism' }}</a>
        </nav>
        <section class="guide-card missing">
          <h1 id="guide-missing-title">{{ isTamil() ? 'இந்த வழிகாட்டி கிடைக்கவில்லை' : 'This guide is unavailable' }}</h1>
          <p>{{ isTamil() ? 'சுற்றுலா வழிகாட்டிக்குத் திரும்பவும்.' : 'Return to the tourism guide to explore current destination information.' }}</p>
          <a routerLink="/tourism">{{ isTamil() ? 'சுற்றுலா வழிகாட்டி' : 'Tourism guide' }}</a>
        </section>
      </main>
    }
  `,
  styles: `
    :host { display:block; min-width:0; padding:1rem 1rem 3rem; color:var(--cdm-navy); background:var(--cdm-page); }
    .guide-shell { width:min(100%, 960px); margin-inline:auto; }
    .breadcrumbs { display:flex; flex-wrap:wrap; gap:.55rem; margin-bottom:1rem; color:var(--cdm-muted); font-size:.86rem; }
    .breadcrumbs a { color:var(--cdm-royal-blue); }
    .guide-card { padding:clamp(1rem,3vw,2rem); border:1px solid var(--cdm-border); border-radius:18px; background:#fff; }
    .eyebrow { margin:0 0 .4rem; color:var(--cdm-royal-blue); font-size:.72rem; font-weight:800; letter-spacing:.1em; }
    h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.7rem,4vw,2.5rem); line-height:1.25; }
    h2 { margin:0 0 .55rem; color:var(--cdm-navy); font-size:clamp(1.15rem,2.5vw,1.45rem); }
    p { color:#42566f; line-height:1.7; }
    .guide-intro { margin:.65rem 0 1rem; font-size:1.05rem; }
    .guide-image { margin:1.1rem 0 0; }
    .guide-image img { display:block; width:100%; height:auto; max-height:460px; object-fit:cover; border-radius:12px; }
    figcaption { margin-top:.35rem; color:var(--cdm-muted); font-size:.78rem; }
    .guide-section { margin-top:1.5rem; }
    .guide-section p { margin:0; white-space:pre-line; }
    .guide-faq { display:grid; gap:.5rem; margin-top:1.6rem; }
    .guide-faq details { padding:.8rem .95rem; border:1px solid var(--cdm-border); border-radius:10px; }
    .guide-faq summary { min-height:30px; color:var(--cdm-navy); font-weight:700; cursor:pointer; }
    .guide-faq details p { margin:.55rem 0 0; }
    .source-note { margin-top:1.5rem; padding:.85rem 1rem; border-left:4px solid var(--cdm-green); background:var(--cdm-page); }
    .source-note p { margin:.2rem 0; font-size:.82rem; }
    .source-note a,.related-links a { color:var(--cdm-royal-blue); }
    .related-links { display:flex; flex-wrap:wrap; gap:.6rem; margin-top:1.25rem; }
    .related-links a { display:inline-flex; align-items:center; min-height:44px; padding:.55rem .8rem; border:1px solid var(--cdm-border); border-radius:9px; background:#fff; font-weight:700; text-decoration:none; }
    .related-links .primary-link { color:#fff; border-color:var(--cdm-btn-primary); background:var(--cdm-btn-primary); }
    a:focus-visible,summary:focus-visible { outline:3px solid color-mix(in srgb,var(--cdm-royal-blue) 35%,transparent); outline-offset:3px; }
    @media(max-width:560px) { :host { padding-inline:.75rem; }.guide-card { border-radius:14px; }.related-links { display:grid; }.related-links a { justify-content:center; } }
  `,
})
export class TourismGuideComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  protected readonly i18n = inject(LanguageService);
  private readonly slug = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly guide = computed(() =>
    TOURISM_GUIDES.find((item) => item.slug === this.slug().get('slug')) ?? null,
  );
  protected readonly isTamil = computed(() => this.i18n.language() === 'ta');

  constructor() {
    effect(() => {
      const selected = this.guide();
      const language = this.i18n.language();
      if (!selected) {
        this.seo.update({
          title: language === 'ta' ? 'சுற்றுலா வழிகாட்டி கிடைக்கவில்லை | நம் சிதம்பரம்' : 'Tourism guide not found | CDM 360',
          description: language === 'ta' ? 'இந்த சுற்றுலா வழிகாட்டி தற்போது கிடைக்கவில்லை.' : 'This tourism guide is currently unavailable.',
          path: `/tourism/${this.slug().get('slug') ?? ''}`,
          robots: 'noindex,nofollow',
          language,
        });
        return;
      }

      const tamil = language === 'ta';
      const title = tamil
        ? `${selected.titleTamil} | நம் சிதம்பரம்`
        : `${selected.titleEnglish} | CDM 360`;
      const url = `https://cdm360.in/tourism/${selected.slug}`;
      this.seo.update({
        title,
        description: tamil ? selected.descriptionTamil : selected.descriptionEnglish,
        path: `/tourism/${selected.slug}`,
        language,
        structuredData: [
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            '@id': `${url}#webpage`,
            name: title,
            url,
            inLanguage: tamil ? 'ta-IN' : 'en-IN',
            mainEntity: {
              '@type': 'TouristAttraction',
              '@id': `${url}#attraction`,
              name: tamil ? selected.titleTamil : selected.titleEnglish,
              description: tamil ? selected.descriptionTamil : selected.descriptionEnglish,
              url,
              inLanguage: tamil ? 'ta-IN' : 'en-IN',
            },
          },
          this.seo.breadcrumbSchema([
            { name: tamil ? 'முகப்பு' : 'Home', path: '/' },
            { name: tamil ? 'சுற்றுலா' : 'Tourism', path: '/tourism' },
            { name: tamil ? selected.titleTamil : selected.titleEnglish, path: `/tourism/${selected.slug}` },
          ]),
        ],
      });
    });
  }
}
