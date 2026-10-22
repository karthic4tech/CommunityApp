import { Injectable, inject } from '@angular/core';
import { ServiceCategoryService } from './service-category.service';
import { SupabaseService } from './supabase.service';
import { ServiceCategoryRow } from '../models/service-category';

export interface CategoryMutation {
  parent_id: string | null;
  name_ta: string;
  name_en: string;
  slug: string;
  description: string | null;
  icon_name: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface AdminCategoryTreeRow {
  category: ServiceCategoryRow;
  depth: number;
}

const CATEGORY_COLUMNS = 'id,parent_id,name_ta,name_en,slug,description,icon_name,sort_order,is_active';

@Injectable({ providedIn: 'root' })
export class AdminCategoryService {
  private readonly supabase = inject(SupabaseService);
  private readonly publicCategories = inject(ServiceCategoryService);

  async list(): Promise<ServiceCategoryRow[]> {
    const { data, error } = await this.supabase.client
      .from('service_categories')
      .select(CATEGORY_COLUMNS)
      .order('sort_order', { ascending: true })
      .order('slug', { ascending: true })
      .returns<ServiceCategoryRow[]>();
    if (error) throw new Error('Unable to load administrator categories.');
    return data ?? [];
  }

  async get(id: string): Promise<ServiceCategoryRow | null> {
    const { data, error } = await this.supabase.client
      .from('service_categories')
      .select(CATEGORY_COLUMNS)
      .eq('id', id)
      .maybeSingle<ServiceCategoryRow>();
    if (error) throw new Error('Unable to load this category.');
    return data;
  }

  async slugExists(slug: string, excludeId: string | null = null): Promise<boolean> {
    let query = this.supabase.client
      .from('service_categories')
      .select('id')
      .eq('slug', slug);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query.maybeSingle<{ id: string }>();
    if (error) throw new Error('Unable to validate the category slug.');
    return data !== null;
  }

  async create(input: CategoryMutation): Promise<ServiceCategoryRow> {
    if (await this.slugExists(input.slug)) throw new Error('A category with this slug already exists.');
    const { data, error } = await this.supabase.client
      .from('service_categories')
      .insert(input)
      .select(CATEGORY_COLUMNS)
      .single<ServiceCategoryRow>();
    if (error) throw this.mutationError(error);
    await this.publicCategories.refresh();
    return data;
  }

  async update(id: string, input: CategoryMutation): Promise<ServiceCategoryRow> {
    if (await this.slugExists(input.slug, id)) throw new Error('A category with this slug already exists.');
    const { data, error } = await this.supabase.client
      .from('service_categories')
      .update(input)
      .eq('id', id)
      .select(CATEGORY_COLUMNS)
      .single<ServiceCategoryRow>();
    if (error) throw this.mutationError(error);
    await this.publicCategories.refresh();
    return data;
  }

  private mutationError(error: { code?: string }): Error {
    if (error.code === '23505') return new Error('A category with this slug already exists.');
    if (error.code === '23503') return new Error('The selected parent category no longer exists.');
    return new Error('Unable to save this category.');
  }
}

export function flattenAdminCategories(rows: readonly ServiceCategoryRow[]): AdminCategoryTreeRow[] {
  const sorted = rows.slice().sort((a, b) =>
    a.sort_order - b.sort_order || a.slug.localeCompare(b.slug) || a.id.localeCompare(b.id),
  );
  const byParent = new Map<string | null, ServiceCategoryRow[]>();
  for (const row of sorted) {
    const children = byParent.get(row.parent_id) ?? [];
    children.push(row);
    byParent.set(row.parent_id, children);
  }

  const result: AdminCategoryTreeRow[] = [];
  const displayed = new Set<string>();
  const visit = (parentId: string | null, depth: number): void => {
    for (const category of byParent.get(parentId) ?? []) {
      if (displayed.has(category.id)) continue;
      displayed.add(category.id);
      result.push({ category, depth });
      visit(category.id, depth + 1);
    }
  };

  visit(null, 0);
  // Existing data should be connected by the FK, but keep malformed/cyclic
  // rows visible to an administrator instead of recursing forever or hiding them.
  for (const category of sorted) {
    if (!displayed.has(category.id)) {
      displayed.add(category.id);
      result.push({ category, depth: 0 });
      visit(category.id, 1);
    }
  }
  return result;
}
