import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../core/services/seo.service';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="not-found" aria-labelledby="not-found-title">
      <p class="eyebrow">404 · PAGE NOT FOUND</p>
      <h1 id="not-found-title">We couldn’t find that page.</h1>
      <p>The address may have changed, or the page may no longer be available.</p>
      <a routerLink="/">Go to CDM 360 home</a>
    </main>
  `,
  styles: `
    :host { display:block; }
    .not-found { width:min(48rem, calc(100% - 2rem)); margin:clamp(3rem, 10vw, 7rem) auto; padding:clamp(1.5rem, 5vw, 3rem); border:1px solid var(--cdm-border); border-radius:1rem; background:#fff; }
    .eyebrow { color:var(--cdm-royal-blue); font-size:.8rem; font-weight:800; letter-spacing:.1em; }
    h1 { color:var(--cdm-navy); font-size:clamp(1.8rem, 5vw, 2.7rem); }
    p { color:var(--cdm-muted); }
    a { display:inline-flex; align-items:center; min-height:44px; padding:.6rem 1rem; border-radius:.5rem; background:var(--cdm-btn-primary); color:#fff; font-weight:700; text-decoration:none; }
    a:focus-visible { outline:3px solid var(--cdm-royal-blue); outline-offset:3px; }
  `,
})
export class NotFoundComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.update({
      title: 'Page Not Found | CDM 360',
      description: 'The requested CDM 360 page could not be found.',
      path: '/404',
      robots: 'noindex,nofollow',
    });
  }
}
