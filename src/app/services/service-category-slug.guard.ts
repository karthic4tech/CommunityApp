import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { findCategory } from '../core/models/service-listing';
import { ServiceCategoryService } from '../core/services/service-category.service';

/** Preserve historical /services/:categorySlug URLs without shadowing listing slugs. */
export const serviceCategorySlugGuard: CanMatchFn = async (_route, segments) => {
  const slug = segments.at(-1)?.path ?? '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return false;
  if (/-[a-f0-9]{8}$/.test(slug)) return false;
  try {
    const categories = inject(ServiceCategoryService);
    await categories.load();
    return findCategory(categories.categories(), slug) !== undefined;
  } catch { return false; }
};
