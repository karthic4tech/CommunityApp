import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export type RobotsDirective = 'index,follow' | 'noindex,follow' | 'noindex,nofollow';
export type StructuredData = Readonly<Record<string, unknown>>;

export interface PageSeo {
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly image?: string;
  readonly robots?: RobotsDirective;
  readonly language?: 'en' | 'ta';
  readonly structuredData?: StructuredData | readonly StructuredData[];
}

export interface BreadcrumbItem {
  readonly name: string;
  readonly path: string;
}

const SITE_ORIGIN = 'https://cdm360.in';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/assets/images/cdm360-logo.jpeg`;

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly head = this.document.head;

  update(page: PageSeo): void {
    const path = this.normalizedPath(page.path);
    const canonical = `${SITE_ORIGIN}${path}`;
    const image = this.absoluteUrl(page.image ?? DEFAULT_IMAGE);
    const description = page.description.trim().slice(0, 300);
    const title = page.title.trim();
    const language = page.language ?? 'en';

    this.titleService.setTitle(title);
    this.document.documentElement.lang = language === 'ta' ? 'ta-IN' : 'en-IN';
    this.setMeta('name', 'description', description);
    this.setMeta('name', 'robots', page.robots ?? 'index,follow');
    this.setMeta('property', 'og:type', 'website');
    this.setMeta('property', 'og:site_name', 'CDM 360');
    this.setMeta('property', 'og:title', title);
    this.setMeta('property', 'og:description', description);
    this.setMeta('property', 'og:image', image);
    this.setMeta('property', 'og:url', canonical);
    this.setMeta('property', 'og:locale', language === 'ta' ? 'ta_IN' : 'en_IN');
    this.setMeta('name', 'twitter:card', 'summary_large_image');
    this.setMeta('name', 'twitter:title', title);
    this.setMeta('name', 'twitter:description', description);
    this.setMeta('name', 'twitter:image', image);
    this.setCanonical(canonical);
    this.setGlobalStructuredData();
    this.setPageStructuredData(page.structuredData);
    this.removeMetaKeywords();
  }

  setNoIndex(path: string): void {
    this.update({
      title: 'CDM 360 Account | Nam Chidambaram',
      description: 'CDM 360 account and community services.',
      path,
      robots: 'noindex,nofollow',
    });
  }

  resetForNavigation(path: string, isPrivate: boolean): void {
    const cleanPath = this.normalizedPath(path);
    const language = this.document.documentElement.lang.toLowerCase().startsWith('ta') ? 'ta' : 'en';
    this.update({
      title: 'CDM 360 | Nam Chidambaram',
      description: 'Explore local services, businesses and visitor information in Chidambaram, Tamil Nadu.',
      path: cleanPath,
      robots: isPrivate ? 'noindex,nofollow' : 'index,follow',
      language,
    });
  }

  setCanonicalPath(path: string): void {
    this.setCanonical(`${SITE_ORIGIN}${this.normalizedPath(path)}`);
    this.setMeta('property', 'og:url', `${SITE_ORIGIN}${this.normalizedPath(path)}`);
  }

  setRobots(value: RobotsDirective): void {
    this.setMeta('name', 'robots', value);
  }

  setLanguage(language: 'en' | 'ta'): void {
    this.document.documentElement.lang = language === 'ta' ? 'ta-IN' : 'en-IN';
    this.setMeta('property', 'og:locale', language === 'ta' ? 'ta_IN' : 'en_IN');
  }

  breadcrumbSchema(items: readonly BreadcrumbItem[]): StructuredData {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: `${SITE_ORIGIN}${this.normalizedPath(item.path)}`,
      })),
    };
  }

  private normalizedPath(path: string): string {
    const pathname = path.split(/[?#]/, 1)[0] || '/';
    const normalized = `/${pathname.split('/').filter(Boolean).join('/')}`;
    return normalized === '/' ? '/' : normalized;
  }

  private absoluteUrl(value: string): string {
    try {
      const url = new URL(value, SITE_ORIGIN);
      return url.protocol === 'https:' ? url.href : DEFAULT_IMAGE;
    } catch {
      return DEFAULT_IMAGE;
    }
  }

  private setMeta(attribute: 'name' | 'property', key: string, content: string): void {
    const selector = `meta[${attribute}="${key}"]`;
    const matches = Array.from(this.head.querySelectorAll<HTMLMetaElement>(selector));
    const element = matches[0];
    if (element) {
      this.meta.updateTag({ [attribute]: key, content }, `${attribute}="${key}"`);
    } else {
      this.meta.addTag({ [attribute]: key, content });
    }
    for (const duplicate of matches.slice(1)) duplicate.remove();
  }

  private setCanonical(href: string): void {
    const matches = Array.from(this.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'));
    const element = matches[0] ?? this.document.createElement('link');
    for (const duplicate of matches.slice(1)) duplicate.remove();
    element.rel = 'canonical';
    element.href = href;
    if (!element.isConnected) this.head.appendChild(element);
  }

  private setGlobalStructuredData(): void {
    this.setJsonLd('cdm360-global-structured-data', {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${SITE_ORIGIN}/#organization`,
          name: 'CDM 360',
          alternateName: 'Nam Chidambaram (நம் சிதம்பரம்)',
          url: `${SITE_ORIGIN}/`,
          logo: { '@type': 'ImageObject', url: DEFAULT_IMAGE },
        },
        {
          '@type': 'WebSite',
          '@id': `${SITE_ORIGIN}/#website`,
          url: `${SITE_ORIGIN}/`,
          name: 'CDM 360',
          inLanguage: ['en', 'ta'],
          publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        },
      ],
    });
  }

  private setPageStructuredData(schema: PageSeo['structuredData']): void {
    const id = 'cdm360-page-structured-data';
    const existing = this.document.getElementById(id);
    if (!schema) {
      existing?.remove();
      return;
    }
    const graph = Array.isArray(schema) ? schema as readonly StructuredData[] : [schema as StructuredData];
    if (graph.length === 1) {
      this.setJsonLd(id, graph[0]);
      return;
    }
    const entities = graph.map(({ '@context': _context, ...entity }) => entity);
    this.setJsonLd(id, { '@context': 'https://schema.org', '@graph': entities });
  }

  private setJsonLd(id: string, value: StructuredData): void {
    const element = this.document.getElementById(id) ?? this.document.createElement('script');
    element.id = id;
    element.setAttribute('type', 'application/ld+json');
    element.textContent = JSON.stringify(value).replace(/[<>&]/g, character =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );
    if (!element.isConnected) this.head.appendChild(element);
  }

  private removeMetaKeywords(): void {
    for (const element of this.head.querySelectorAll('meta[name="keywords"]')) element.remove();
  }
}
