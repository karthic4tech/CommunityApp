const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLACEHOLDER_CONTENT_PATTERN = /^(?:test(?:ing)?|sample|demo|dummy|placeholder|asdas+|asdf+|xyz+|n\/?a)$/i;

export function isIndexablePublicListing(listing) {
  const title = listing?.title?.trim() ?? '';
  const description = listing?.description?.trim() ?? '';
  const providerName = listing?.service_providers?.display_name?.trim() ?? '';
  return title.length >= 3
    && description.length >= 20
    && providerName.length >= 3
    && !PLACEHOLDER_CONTENT_PATTERN.test(title)
    && !PLACEHOLDER_CONTENT_PATTERN.test(providerName);
}

export function canonicalServiceCategoryPath(category, parent) {
  if (!category || !SLUG_PATTERN.test(category.slug ?? '')) return null;
  if (!category.parent_id) return `/services/category/${category.slug}`;
  if (!parent || parent.id !== category.parent_id || !SLUG_PATTERN.test(parent.slug ?? '')) return null;
  return `/services/${parent.slug}/${category.slug}`;
}
