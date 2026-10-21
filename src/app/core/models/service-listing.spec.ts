import { buildCategoryHierarchy } from './service-category';
import { row } from './category-test-fixtures';
import { contactHref, findCategory, locationOptions, publicListing } from './service-listing';
import { listing, places } from './listing-test-fixtures';

describe('Directory models', () => {
  it('resolves root and leaf categories by the existing stable slug', () => {
    const categories = buildCategoryHierarchy([row('parent'), row('child', { parent_id: 'parent' })]);
    expect(findCategory(categories, 'parent')?.id).toBe('parent');
    expect(findCategory(categories, 'child')?.id).toBe('child');
    expect(findCategory(categories, 'unknown')).toBeUndefined();
  });

  it('builds bilingual hierarchy labels without displaying orphans or cycles', () => {
    const options = locationOptions([...places, { ...places[0], id: 'orphan', parent_id: 'missing' }], 'en');
    expect(options.map(place => place.label)).toEqual(['Cuddalore', 'Cuddalore / Chidambaram', 'Cuddalore / Chidambaram / Locality']);
    expect(locationOptions(places, 'ta')[1].label).toBe('கடலூர் / சிதம்பரம்');
  });

  it('only accepts published listings from verified providers', () => {
    expect(publicListing(listing())).toBe(true);
    for (const status of ['draft', 'pending_review', 'rejected', 'suspended', 'archived']) {
      expect(publicListing(listing({ status }))).toBe(false);
    }
    expect(publicListing(listing({ service_providers: { ...listing().service_providers, verification_status: 'suspended' } }))).toBe(false);
  });

  it('builds valid contact links and rejects dangerous or malformed contacts', () => {
    expect(contactHref('phone', '+91 (98765) 43210')).toBe('tel:+919876543210');
    expect(contactHref('whatsapp', '+91 98765 43210')).toBe('https://wa.me/919876543210');
    expect(contactHref('email', 'hello@example.com')).toBe('mailto:hello@example.com');
    expect(contactHref('website', 'https://example.com')).toBe('https://example.com/');
    expect(contactHref('phone', '123')).toBeNull();
    expect(contactHref('phone', 'javascript:alert(1)')).toBeNull();
    expect(contactHref('website', 'javascript:alert(1)')).toBeNull();
    expect(contactHref('email', 'hello@example.com?bcc=other@example.com')).toBeNull();
    expect(contactHref('other', 'arbitrary')).toBeNull();
  });
});
