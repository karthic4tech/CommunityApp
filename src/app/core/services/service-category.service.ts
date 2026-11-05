import { Injectable, inject, signal } from '@angular/core';
import { buildCategoryHierarchy, ServiceCategory, ServiceCategoryRow } from '../models/service-category';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ServiceCategoryService {
  private readonly supabase = inject(SupabaseService);
  private readonly categoryState = signal<readonly ServiceCategory[]>([]);
  private readonly essentialCategoryState = signal<readonly ServiceCategory[]>([]);
  private readonly essentialLoadedState = signal(false);
  private essentialPending?: Promise<readonly ServiceCategory[]>;
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private loaded = false;
  private pending?: Promise<void>;

  readonly categories = this.categoryState.asReadonly();
  readonly essentialCategories = this.essentialCategoryState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  load(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.loaded) return Promise.resolve();
    this.loadingState.set(true);
    this.errorState.set(null);
    this.pending = this.fetchPublicCategories().finally(() => {
      this.loadingState.set(false);
      this.pending = undefined;
    });
    return this.pending;
  }

  refresh(): Promise<void> {
    this.loaded = false;
    this.essentialLoadedState.set(false);
    return this.load();
  }

  async getAllActiveCategories(): Promise<readonly ServiceCategory[]> {
    await this.load();
    return this.categoryState();
  }

  getEssentialCategories(forceRefresh = false): Promise<readonly ServiceCategory[]> {
    if (this.essentialPending) return this.essentialPending;
    if (this.essentialLoadedState() && !forceRefresh) return Promise.resolve(this.essentialCategoryState());
    this.essentialPending = this.fetchCategoryRows(true).then((categories) => {
      this.essentialCategoryState.set(categories);
      this.essentialLoadedState.set(true);
      return categories;
    }).finally(() => { this.essentialPending = undefined; });
    return this.essentialPending;
  }

  private async fetchPublicCategories(): Promise<void> {
    try {
      const categories = await this.fetchCategoryRows(false);
      this.categoryState.set(categories);
      this.loaded = true;
    } catch {
      console.warn('Unable to load service categories. Check public configuration, connectivity and RLS.');
      this.errorState.set('சேவை வகைகளை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.');
    }
  }

  private async fetchCategoryRows(essentialOnly: boolean): Promise<ServiceCategory[]> {
      const baseColumns = 'id,parent_id,name_ta,name_en,slug,description,icon_name,sort_order,is_active';
      const curationColumns = 'is_essential,essential_order,show_as_shortcut,shortcut_order,show_on_homepage,homepage_order,is_emergency';
      const columns = essentialOnly ? `${baseColumns},${curationColumns}` : baseColumns;
      let query = this.supabase.client
        .from('service_categories')
        .select(columns)
        .eq('is_active', true);
      if (essentialOnly) {
        query = query.eq('is_essential', true)
          .order('essential_order', { ascending: true, nullsFirst: false })
          .order('sort_order', { ascending: true }).order('slug', { ascending: true });
      } else {
        query = query.order('sort_order', { ascending: true }).order('slug', { ascending: true });
      }
      const { data, error } = await query.returns<ServiceCategoryRow[]>();
      if (error) {
        // Codes help diagnose RLS/network failures without logging credentials or payloads.
        console.warn('Service category query failed', { code: error.code });
        if (essentialOnly && ['42703', 'PGRST204', 'PGRST205'].includes(error.code ?? '')) {
          throw new Error('Essential Services database setup is incomplete. Apply migration 20261105100000_essential_service_curations.sql, then retry.');
        }
        throw new Error('Category query failed');
      }
      return buildCategoryHierarchy(data ?? [], essentialOnly);
  }
}
