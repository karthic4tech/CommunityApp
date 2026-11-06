import { Injectable, inject } from '@angular/core';
import { HelpArticle, HelpArticleInput, HelpCategory } from '../models/help-center';
import { SupabaseService } from './supabase.service';

const CATEGORY_COLUMNS = 'id,slug,title_en,title_ta,description_en,description_ta,icon,sort_order,is_active';
const ARTICLE_COLUMNS = 'id,category_id,slug,question_en,question_ta,answer_en,answer_ta,article_type,related_route,sort_order,is_featured,is_published';

@Injectable({ providedIn: 'root' })
export class HelpCenterService {
  private readonly supabase = inject(SupabaseService);

  async listCategories(includeInactive = false): Promise<HelpCategory[]> {
    let query = this.supabase.client.from('help_categories').select(CATEGORY_COLUMNS).order('sort_order').order('title_en');
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query.returns<HelpCategory[]>();
    if (error) throw new Error('Unable to load help categories.');
    return data ?? [];
  }

  async listPublished(featuredOnly = false): Promise<HelpArticle[]> {
    let query = this.supabase.client.from('help_articles').select(`${ARTICLE_COLUMNS},category:help_categories(${CATEGORY_COLUMNS})`)
      .eq('is_published', true).order('sort_order').order('question_en').limit(200);
    if (featuredOnly) query = query.eq('is_featured', true);
    const { data, error } = await query.returns<HelpArticle[]>();
    if (error) throw new Error('Unable to load help articles.');
    return data ?? [];
  }

  async getPublished(slug: string): Promise<HelpArticle | null> {
    const { data, error } = await this.supabase.client.from('help_articles')
      .select(`${ARTICLE_COLUMNS},category:help_categories(${CATEGORY_COLUMNS})`).eq('slug', slug)
      .eq('is_published', true).maybeSingle<HelpArticle>();
    if (error) throw new Error('Unable to load this help article.');
    return data;
  }

  async listAdmin(): Promise<HelpArticle[]> {
    const { data, error } = await this.supabase.client.from('help_articles')
      .select(`${ARTICLE_COLUMNS},category:help_categories(${CATEGORY_COLUMNS})`).order('category_id').order('sort_order').returns<HelpArticle[]>();
    if (error) throw new Error('Unable to load help articles.');
    return data ?? [];
  }

  async createCategory(input: Omit<HelpCategory, 'id'>): Promise<void> {
    const { error } = await this.supabase.client.from('help_categories').insert(input);
    if (error) throw new Error(error.code === '23505' ? 'That category slug already exists.' : 'Unable to create help category.');
  }

  async updateCategory(id: string, input: Omit<HelpCategory, 'id'>): Promise<void> {
    const { error } = await this.supabase.client.from('help_categories').update(input).eq('id', id);
    if (error) throw new Error(error.code === '23505' ? 'That category slug already exists.' : 'Unable to update help category.');
  }

  async create(input: HelpArticleInput): Promise<HelpArticle> {
    const { data, error } = await this.supabase.client.from('help_articles').insert(input).select(ARTICLE_COLUMNS).single<HelpArticle>();
    if (error) throw new Error(error.code === '23505' ? 'That article slug already exists.' : 'Unable to create help article.');
    return data;
  }

  async update(id: string, input: HelpArticleInput): Promise<HelpArticle> {
    const { data, error } = await this.supabase.client.from('help_articles').update(input).eq('id', id).select(ARTICLE_COLUMNS).single<HelpArticle>();
    if (error) throw new Error(error.code === '23505' ? 'That article slug already exists.' : 'Unable to update help article.');
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('help_articles').delete().eq('id', id);
    if (error) throw new Error('Unable to delete help article.');
  }

  async saveFeedback(articleId: string, helpful: boolean): Promise<void> {
    const { error } = await this.supabase.client.from('help_feedback').insert({ article_id: articleId, is_helpful: helpful });
    if (error) throw new Error('Unable to save feedback.');
  }
}
