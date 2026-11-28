import { TOURISM_GUIDES } from './tourism-guide-content';

describe('tourism visitor guides', () => {
  it('has unique routable guide slugs and source-backed bilingual content', () => {
    const slugs = TOURISM_GUIDES.map((guide) => guide.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain('nataraja-temple-guide');
    expect(slugs).toContain('pichavaram-mangrove-forest');

    for (const guide of TOURISM_GUIDES) {
      expect(guide.sourceUrl).toMatch(/^https:\/\//);
      expect(guide.sourceUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(guide.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(guide.sections.length).toBeGreaterThanOrEqual(2);
      expect(guide.faqs.length).toBeGreaterThan(0);
      for (const section of guide.sections) {
        expect(section.headingEnglish.trim()).not.toBe('');
        expect(section.headingTamil.trim()).not.toBe('');
        expect(section.bodyEnglish.trim()).not.toBe('');
        expect(section.bodyTamil.trim()).not.toBe('');
      }
    }
  });

  it('does not state guaranteed hours, fares, availability, or confirmed bookings', () => {
    const content = JSON.stringify(TOURISM_GUIDES).toLowerCase();
    expect(content).not.toMatch(/\b\d{1,2}:\d{2}\s*(?:am|pm)\b/);
    expect(content).not.toMatch(/₹\s*\d/);
    expect(content).not.toMatch(/booking confirmed|availability guaranteed/);
  });
});
