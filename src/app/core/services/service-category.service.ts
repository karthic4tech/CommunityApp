import { Injectable, inject, signal } from '@angular/core';
import { buildCategoryHierarchy, ServiceCategory, ServiceCategoryRow } from '../models/service-category';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ServiceCategoryService {
  private readonly supabase = inject(SupabaseService);
  private readonly categoryState = signal<readonly ServiceCategory[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private loaded = false;
  private pending?: Promise<void>;

  readonly categories = this.categoryState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  load(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.loaded) return Promise.resolve();
    this.loadingState.set(true);
    this.errorState.set(null);
    this.pending = this.fetchCategories().finally(() => {
      this.loadingState.set(false);
      this.pending = undefined;
    });
    return this.pending;
  }

  refresh(): Promise<void> {
    this.loaded = false;
    return this.load();
  }

  private async fetchCategories(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client
        .from('service_categories')
        .select('id,parent_id,name_ta,name_en,slug,description,icon_name,sort_order,is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('slug', { ascending: true })
        .returns<ServiceCategoryRow[]>();
      if (error) {
        // Codes help diagnose RLS/network failures without logging credentials or payloads.
        console.warn('Service category query failed', { code: error.code });
        throw new Error('Category query failed');
      }
      this.categoryState.set(buildCategoryHierarchy(data ?? []));
      this.loaded = true;
    } catch {
      console.warn('Unable to load service categories. Check public configuration, connectivity and RLS.');
      this.errorState.set('சேவை வகைகளை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.');
    }
  }
}
