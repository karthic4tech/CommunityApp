import { Injectable, inject } from '@angular/core';
import { EssentialShortcut, EssentialShortcutMutation, EssentialShortcutRow } from '../models/essential-service';
import { ServiceCategoryRow } from '../models/service-category';
import { SupabaseService } from './supabase.service';

const SHORTCUT_COLUMNS = 'id,category_id,subcategory_id,title,title_ta,icon,display_order,is_active,is_emergency';
const ESSENTIAL_MIGRATION_MESSAGE = 'Essential Services database setup is incomplete. Apply migration 20261105100000_essential_service_curations.sql, then retry.';

@Injectable({ providedIn: 'root' })
export class EssentialServiceService {
  private readonly supabase = inject(SupabaseService);

  async getEssentialShortcuts(): Promise<EssentialShortcut[]> {
    const [{ data, error }, categoryResult] = await Promise.all([
      this.supabase.client.from('essential_service_shortcuts').select(SHORTCUT_COLUMNS)
        .eq('is_active', true).order('display_order').order('id')
        .returns<EssentialShortcutRow[]>(),
      this.supabase.client.from('service_categories')
        .select('id,parent_id,name_ta,name_en,slug,description,icon_name,sort_order,is_active,is_essential,essential_order,show_as_shortcut,shortcut_order,show_on_homepage,homepage_order,is_emergency')
        .eq('is_active', true).eq('is_essential', true).returns<ServiceCategoryRow[]>(),
    ]);
    if (categoryResult.error && ['42703', 'PGRST204', 'PGRST205'].includes(categoryResult.error.code ?? '')) {
      throw new Error(ESSENTIAL_MIGRATION_MESSAGE);
    }
    if (error && ['42P01', 'PGRST205'].includes(error.code ?? '')) throw new Error(ESSENTIAL_MIGRATION_MESSAGE);
    if (error || categoryResult.error) throw new Error('Unable to load essential service shortcuts.');

    const categoryRows = categoryResult.data ?? [];
    const categories = new Map(categoryRows.map(row => [row.id, row]));
    const configured = (data ?? []).flatMap((shortcut) => {
      const category = categories.get(shortcut.category_id);
      const subcategory = shortcut.subcategory_id ? categories.get(shortcut.subcategory_id) : null;
      if (!category || (shortcut.subcategory_id && (!subcategory || subcategory.parent_id !== category.id))) return [];
      return [{
        ...shortcut,
        categorySlug: category.slug,
        categoryName: category.name_en,
        categoryNameTamil: category.name_ta,
        subcategorySlug: subcategory?.slug ?? null,
        subcategoryName: subcategory?.name_en ?? null,
        subcategoryNameTamil: subcategory?.name_ta ?? null,
        destination: subcategory
          ? `/services/${category.slug}/${subcategory.slug}`
          : `/services/category/${category.slug}`,
      }];
    });
    const configuredTargets = new Set(configured.map(item => `${item.category_id}:${item.subcategory_id ?? ''}`));
    const categoryShortcuts = categoryRows.flatMap((row) => {
      if (!row.show_as_shortcut) return [];
      const parent = row.parent_id ? categories.get(row.parent_id) : null;
      const category = parent ?? row;
      const subcategory = parent ? row : null;
      if (!category.is_essential || !category.is_active || (subcategory && (!subcategory.is_essential || !subcategory.is_active))) return [];
      const target = `${category.id}:${subcategory?.id ?? ''}`;
      if (configuredTargets.has(target)) return [];
      const icon = row.icon_name?.includes('bi-') ? `bi ${row.icon_name}` : 'bi bi-grid';
      return [{
        id: `category-${row.id}`, category_id: category.id, subcategory_id: subcategory?.id ?? null,
        title: row.name_en, title_ta: row.name_ta, icon,
        display_order: row.shortcut_order ?? row.essential_order ?? row.sort_order,
        is_active: true, is_emergency: row.is_emergency ?? false,
        categorySlug: category.slug, categoryName: category.name_en, categoryNameTamil: category.name_ta,
        subcategorySlug: subcategory?.slug ?? null, subcategoryName: subcategory?.name_en ?? null,
        subcategoryNameTamil: subcategory?.name_ta ?? null,
        destination: subcategory ? `/services/${category.slug}/${subcategory.slug}` : `/services/category/${category.slug}`,
      }];
    });
    return [...configured, ...categoryShortcuts].sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id));
  }

  async updateCategoryCuration(input: Pick<ServiceCategoryRow, 'id'> & {
    is_essential: boolean;
    essential_order: number | null;
    show_as_shortcut: boolean;
    shortcut_order: number | null;
    show_on_homepage: boolean;
    homepage_order: number | null;
    is_emergency: boolean;
  }): Promise<void> {
    const { error } = await this.supabase.client.from('service_categories')
      .update({
        is_essential: input.is_essential,
        essential_order: input.essential_order,
        show_as_shortcut: input.show_as_shortcut,
        shortcut_order: input.shortcut_order,
        show_on_homepage: input.show_on_homepage,
        homepage_order: input.homepage_order,
        is_emergency: input.is_emergency,
      }).eq('id', input.id);
    if (error) throw new Error('Unable to save category curation. Check administrator access.');
  }

  async listShortcutsForAdmin(): Promise<EssentialShortcutRow[]> {
    const { data, error } = await this.supabase.client.from('essential_service_shortcuts')
      .select(SHORTCUT_COLUMNS).order('display_order').order('id').returns<EssentialShortcutRow[]>();
    if (error) throw new Error('Unable to load shortcut settings.');
    return data ?? [];
  }

  async saveShortcut(input: EssentialShortcutMutation): Promise<void> {
    const { id, ...values } = input;
    const query = id
      ? this.supabase.client.from('essential_service_shortcuts').update(values).eq('id', id)
      : this.supabase.client.from('essential_service_shortcuts').insert(values);
    const { error } = await query;
    if (error) throw new Error(error.code === '23505'
      ? 'A shortcut already exists for this category and subcategory.'
      : 'Unable to save the shortcut. Check the category and subcategory selection.');
  }

  async deleteShortcut(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('essential_service_shortcuts').delete().eq('id', id);
    if (error) throw new Error('Unable to remove the shortcut.');
  }
}
