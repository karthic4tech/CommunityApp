import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SeoService } from './core/services/seo.service';
import { AnalyticsService } from './core/services/analytics.service';
import { LanguageService } from './core/services/language.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);
  private readonly i18n = inject(LanguageService);

  constructor() {
    effect(() => this.seo.setLanguage(this.i18n.language()));
    this.router.events.pipe(
      filter((event): event is NavigationStart => event instanceof NavigationStart),
      takeUntilDestroyed(),
    ).subscribe(event => {
      const path = event.url.split(/[?#]/, 1)[0] || '/';
      this.seo.resetForNavigation(path, this.isPrivatePath(path) || this.isSearchPath(path));
    });
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(event => {
      const path = event.urlAfterRedirects.split(/[?#]/, 1)[0] || '/';
      this.seo.setCanonicalPath(path);
      this.analytics.pageView(path);
    });
  }

  private isPrivatePath(path: string): boolean {
    return path === '/account'
      || path.startsWith('/admin')
      || path.startsWith('/auth/')
      || ['/my-submissions', '/my-lodging-inquiries', '/services/submit'].some(route => path === route || path.startsWith(`${route}/`))
      || path.startsWith('/marketplace/my-')
      || ['/marketplace/sell', '/marketplace/edit', '/marketplace/favourites', '/jobs/submit']
        .some(route => path === route || path.startsWith(`${route}/`));
  }

  private isSearchPath(path: string): boolean {
    return path === '/service-search';
  }
}
