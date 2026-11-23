import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let seo: SeoService;
  let document: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SeoService] });
    seo = TestBed.inject(SeoService);
    document = TestBed.inject(DOCUMENT);
  });

  it('sets unique metadata and removes query parameters from canonical URLs', () => {
    const duplicate = document.createElement('meta');
    duplicate.name = 'description';
    document.head.appendChild(duplicate);
    const duplicateCanonical = document.createElement('link');
    duplicateCanonical.rel = 'canonical';
    document.head.appendChild(duplicateCanonical);

    seo.update({
      title: 'Hotels in Chidambaram | CDM 360',
      description: 'Explore public stay listings in Chidambaram.',
      path: '/services/category/hotels?sort=recent#results',
      language: 'en',
    });

    expect(document.title).toBe('Hotels in Chidambaram | CDM 360');
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe('https://cdm360.in/services/category/hotels');
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content'))
      .toBe('https://cdm360.in/services/category/hotels');
    expect(document.documentElement.lang).toBe('en');
    const structuredData = document.querySelector('#cdm360-global-structured-data');
    expect(structuredData?.getAttribute('type')).toBe('application/ld+json');
    expect(JSON.parse(structuredData?.textContent ?? '{}')).toMatchObject({
      '@graph': [{ '@type': 'Organization', name: 'CDM 360' }, { '@type': 'WebSite', name: 'CDM 360' }],
    });
  });

  it('can mark account pages as non-indexable', () => {
    seo.setNoIndex('/account?tab=private');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://cdm360.in/account');
  });
});
