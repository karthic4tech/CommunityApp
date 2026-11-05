/** Public category projection from migration 001; timestamps are not requested. */
export interface ServiceCategoryRow {
  id: string;
  parent_id: string | null;
  name_ta: string;
  name_en: string;
  slug: string;
  description: string | null;
  icon_name: string | null;
  sort_order: number;
  is_active: boolean;
  is_essential?: boolean;
  essential_order?: number | null;
  show_as_shortcut?: boolean;
  shortcut_order?: number | null;
  show_on_homepage?: boolean;
  homepage_order?: number | null;
  is_emergency?: boolean;
}

export interface ServiceCategory {
  id: string;
  parentCategoryId: string | null;
  nameTamil: string;
  nameEnglish: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isEssential?: boolean;
  essentialOrder?: number | null;
  showAsShortcut?: boolean;
  shortcutOrder?: number | null;
  showOnHomepage?: boolean;
  homepageOrder?: number | null;
  isEmergency?: boolean;
  subcategories: ServiceCategory[];
}

/**
 * Return the path from a root category to a category with the requested id.
 * The path is useful for breadcrumbs without coupling the UI to database rows.
 */
export function findCategoryPathById(
  categories: readonly ServiceCategory[],
  id: string,
  path: readonly ServiceCategory[] = [],
): ServiceCategory[] | undefined {
  for (const category of categories) {
    const nextPath = [...path, category];
    if (category.id === id) return nextPath;
    const childPath = findCategoryPathById(category.subcategories, id, nextPath);
    if (childPath) return childPath;
  }
  return undefined;
}

export function buildCategoryHierarchy(rows: readonly ServiceCategoryRow[], essentialOrder = false): ServiceCategory[] {
  const sorted = rows.filter((row) => row.is_active).slice().sort((a, b) =>
    (essentialOrder ? (a.essential_order ?? a.sort_order) - (b.essential_order ?? b.sort_order) : a.sort_order - b.sort_order)
      || a.sort_order - b.sort_order || a.slug.localeCompare(b.slug) || a.id.localeCompare(b.id),
  );
  const categories = new Map<string, ServiceCategory>();
  for (const row of sorted) {
    if (!categories.has(row.id)) {
      categories.set(row.id, {
        id: row.id, parentCategoryId: row.parent_id, nameTamil: row.name_ta,
        nameEnglish: row.name_en, slug: row.slug, description: row.description,
        icon: row.icon_name, sortOrder: row.sort_order,
        isEssential: row.is_essential ?? false, essentialOrder: row.essential_order ?? null,
        showAsShortcut: row.show_as_shortcut ?? false, shortcutOrder: row.shortcut_order ?? null,
        showOnHomepage: row.show_on_homepage ?? false, homepageOrder: row.homepage_order ?? null,
        isEmergency: row.is_emergency ?? false, subcategories: [],
      });
    }
  }
  const roots: ServiceCategory[] = [];
  for (const category of categories.values()) {
    if (category.parentCategoryId === null) {
      roots.push(category);
    } else {
      // Orphans and disconnected cycles never become roots or reach the UI.
      categories.get(category.parentCategoryId)?.subcategories.push(category);
    }
  }
  return roots;
}
