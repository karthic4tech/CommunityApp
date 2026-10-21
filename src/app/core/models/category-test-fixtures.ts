import { ServiceCategoryRow } from './service-category';

export function row(id: string, changes: Partial<ServiceCategoryRow> = {}): ServiceCategoryRow {
  return { id, parent_id: null, name_ta: 'சேவை', name_en: 'Service', slug: id,
    description: null, icon_name: null, sort_order: 0, is_active: true, ...changes };
}
