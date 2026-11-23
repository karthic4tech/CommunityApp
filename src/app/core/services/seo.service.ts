import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

export interface PageSeo {
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly image?: string;
  readonly robots?: 'index,follow' | 'noindex,follow' | 'noindex,nofollow';
  readonly language?: 'en' | 'ta';
}

const SITE_ORIGIN = 'https://cdm360.in';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/assets/images/cdm360-logo.jpeg`;

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly head = this.document.head;

  update(page: PageSeo): void {
    const path = this.normalizedPath(page.path);
    const canonical = `${SITE_ORIGIN}${path}`;
    const image = this.absoluteUrl(page.image ?? DEFAULT_IMAGE);
    const description = page.description.trim().slice(0, 300);
    const title = page.title.trim();

    this.document.title = title;
    this.document.documentElement.lang = page.language ?? 'en';
    this.setMeta('name', 'description', description);
    this.setMeta('name', 'robots', page.robots ?? 'index,follow');
    this.setMeta('property', 'og:type', 'website');
    this.setMeta('property', 'og:site_name', 'CDM 360');
    this.setMeta('property', 'og:title', title);
    this.setMeta('property', 'og:description', description);
    this.setMeta('property', 'og:image', image);
    this.setMeta('property', 'og:url', canonical);
    this.setMeta('name', 'twitter:card', 'summary_large_image');
    this.setMeta('name', 'twitter:title', title);
    this.setMeta('name', 'twitter:description', description);
    this.setMeta('name', 'twitter:image', image);
    this.setCanonical(canonical);
    this.setStructuredData();
  }

  setNoIndex(path: string): void {
    this.update({
      title: 'CDM 360 | நம் சிதம்பரம்',
      description: 'CDM 360 account and community services.',
      path,
      robots: 'noindex,nofollow',
    });
  }

  setCanonicalPath(path: string): void {
    this.setCanonical(`${SITE_ORIGIN}${this.normalizedPath(path)}`);
  }

  setRobots(value: 'index,follow' | 'noindex,follow' | 'noindex,nofollow'): void {
    this.setMeta('name', 'robots', value);
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
    const matches = Array.from(this.head.querySelectorAll<HTMLMetaElement>(`meta[${attribute}="${key}"]`));
    const element = matches.shift() ?? this.document.createElement('meta');
    for (const duplicate of matches) duplicate.remove();
    element.setAttribute(attribute, key);
    element.content = content;
    if (!element.isConnected) this.head.appendChild(element);
  }

  private setCanonical(href: string): void {
    const matches = Array.from(this.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'));
    const element = matches.shift() ?? this.document.createElement('link');
    for (const duplicate of matches) duplicate.remove();
    element.rel = 'canonical';
    element.href = href;
    if (!element.isConnected) this.head.appendChild(element);
  }

  private setStructuredData(): void {
    const id = 'cdm360-global-structured-data';
    const element = this.document.getElementById(id) ?? this.document.createElement('script');
    element.id = id;
    element.setAttribute('type', 'application/ld+json');
    element.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${SITE_ORIGIN}/#organization`,
          name: 'CDM 360',
          alternateName: 'Nam Chidambaram',
          url: `${SITE_ORIGIN}/`,
          logo: {
            '@type': 'ImageObject',
            url: DEFAULT_IMAGE,
          },
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
    if (!element.isConnected) this.head.appendChild(element);
  }
}
