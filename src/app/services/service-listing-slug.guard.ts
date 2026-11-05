import { CanMatchFn } from '@angular/router';

/** Listing slugs receive an eight-character UUID suffix in the curation migration. */
export const serviceListingSlugGuard: CanMatchFn = (_route, segments) =>
  /^(?:[a-z0-9]+-)*[a-z0-9]+-[a-f0-9]{8}$/.test(segments.at(-1)?.path ?? '');
