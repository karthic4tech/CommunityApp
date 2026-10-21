import { buildCategoryHierarchy, findCategoryPathById } from './service-category';
import { row } from './category-test-fixtures';

describe('buildCategoryHierarchy', () => {
  it('nests children, orders siblings deterministically and removes duplicates', () => {
    const result = buildCategoryHierarchy([
      row('b'), row('a'), row('c', { parent_id: 'a', sort_order: 20 }),
      row('d', { parent_id: 'a', sort_order: 10 }), row('a'),
    ]);
    expect(result.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result[0].subcategories.map((item) => item.id)).toEqual(['d', 'c']);
  });

  it('excludes inactive rows, orphans and children of inactive parents', () => {
    expect(buildCategoryHierarchy([
      row('inactive', { is_active: false }), row('child', { parent_id: 'inactive' }),
      row('orphan', { parent_id: 'missing' }), row('root'),
      row('hidden', { parent_id: 'root', is_active: false }),
    ]).map((item) => [item.id, item.subcategories])).toEqual([['root', []]]);
  });

  it('handles empty results and disconnected cycles', () => {
    expect(buildCategoryHierarchy([])).toEqual([]);
    expect(buildCategoryHierarchy([row('a', { parent_id: 'b' }), row('b', { parent_id: 'a' })])).toEqual([]);
  });

  it('returns the active root-to-leaf path for detail breadcrumbs', () => {
    const categories = buildCategoryHierarchy([
      row('root'), row('child', { parent_id: 'root' }), row('leaf', { parent_id: 'child' }),
    ]);
    expect(findCategoryPathById(categories, 'leaf')?.map(category => category.slug)).toEqual(['root', 'child', 'leaf']);
    expect(findCategoryPathById(categories, 'missing')).toBeUndefined();
  });
});
