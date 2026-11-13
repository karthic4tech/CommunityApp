import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface JobCategory {
  id: string;
  name_en: string;
  name_ta: string;
  slug: string;
}

export interface PublishedJob {
  id: string;
  title: string;
  company_name: string;
  description: string;
  location: string;
  contact_phone: string | null;
  contact_email: string | null;
  published_at: string | null;
  job_categories: Pick<JobCategory, 'name_en' | 'name_ta' | 'slug'>;
}

export interface CreateJobInput {
  category_id: string;
  posted_by: string;
  title: string;
  company_name: string;
  description: string;
  location: string;
  contact_phone: string | null;
  contact_email: string | null;
  status: 'pending_review';
}

@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly supabase = inject(SupabaseService);

  async categories(): Promise<JobCategory[]> {
    const { data, error } = await this.supabase.client
      .from('job_categories')
      .select('id,name_en,name_ta,slug')
      .eq('is_active', true)
      .order('sort_order')
      .returns<JobCategory[]>();
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        throw new Error('Job categories are not configured yet. Apply migration 20261113100000_jobs.sql in Supabase, then refresh this page.');
      }
      throw new Error(`Unable to load job categories: ${error.message}`);
    }
    return data ?? [];
  }

  async publishedJobs(): Promise<PublishedJob[]> {
    const { data, error } = await this.supabase.client.from('jobs')
      .select('id,title,company_name,description,location,contact_phone,contact_email,published_at,job_categories!inner(name_en,name_ta,slug)')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .returns<PublishedJob[]>();
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        throw new Error('The jobs directory is not configured yet. Apply migration 20261113100000_jobs.sql, then refresh this page.');
      }
      throw new Error('Unable to load published jobs.');
    }
    return data ?? [];
  }

  async create(input: CreateJobInput): Promise<void> {
    const { error } = await this.supabase.client.from('jobs').insert(input);
    if (error) throw new Error(error.message || 'Unable to post this job.');
  }
}
