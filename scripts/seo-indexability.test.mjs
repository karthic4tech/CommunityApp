import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalServiceCategoryPath, isIndexablePublicListing } from './seo-indexability.mjs';

test('accepts a public listing with descriptive content', () => {
  assert.equal(isIndexablePublicListing({
    title: 'Lakshmi Villas',
    description: 'A locally published stay listing with useful details for visitors.',
    service_providers: { display_name: 'Lakshmi Villas' },
  }), true);
});

test('rejects placeholder or too-thin listing content from indexable inventory', () => {
  for (const title of ['asdas', 'Test', 'Sample']) {
    assert.equal(isIndexablePublicListing({
      title,
      description: 'Some description long enough to pass the length rule.',
      service_providers: { display_name: 'Local Business' },
    }), false);
  }
  assert.equal(isIndexablePublicListing({
    title: 'Local Electrician',
    description: 'Short description.',
    service_providers: { display_name: 'Local Business' },
  }), false);
});

test('uses one canonical route pattern for top-level and nested categories', () => {
  const root = { id: 'root', parent_id: null, slug: 'home-services' };
  const leaf = { id: 'leaf', parent_id: 'root', slug: 'electrician' };
  assert.equal(canonicalServiceCategoryPath(root), '/services/category/home-services');
  assert.equal(canonicalServiceCategoryPath(leaf, root), '/services/home-services/electrician');
  assert.equal(canonicalServiceCategoryPath(leaf, { ...root, slug: 'unsafe/path' }), null);
});
