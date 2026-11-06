import { Injectable, inject } from '@angular/core';
import { findCategoryPathById, ServiceCategory } from '../models/service-category';
import { AiServiceSearchService } from './ai-service-search.service';
import { ServiceCategoryService } from './service-category.service';

export interface ServiceCategorySuggestion {
  readonly parent: ServiceCategory;
  readonly subcategory: ServiceCategory;
  readonly reason: string;
}

@Injectable({ providedIn: 'root' })
export class ServiceCategoryAssistantService {
  private readonly aiSearch = inject(AiServiceSearchService);
  private readonly categories = inject(ServiceCategoryService);

  async suggest(description: string): Promise<ServiceCategorySuggestion | null> {
    const query = description.normalize('NFC').replace(/\s+/gu, ' ').trim();
    if (query.length < 2 || query.length > 200) return null;

    await this.categories.load();
    const localSuggestion = this.localSuggestion(query);
    if (localSuggestion) return localSuggestion;

    const result = await this.aiSearch.suggestCategory(query);
    if (!result.suggestion) return null;
    const path = findCategoryPathById(this.categories.categories(), result.suggestion.subcategory.id);
    if (!path || path.length < 2 || path[0].id !== result.suggestion.parent.id) return null;
    const parent = path[0];
    const subcategory = path[path.length - 1];
    return {
      parent,
      subcategory,
      reason: result.reason === 'direct_match'
        ? 'This matches an active CDM 360 category.'
        : 'The description was matched to the closest active CDM 360 category.',
    };
  }

  /**
   * Resolve clear provider vocabulary locally first. This keeps common Tamil/
   * English descriptions useful even when the remote AI/search function is
   * temporarily unavailable.
   */
  private localSuggestion(query: string): ServiceCategorySuggestion | null {
    const text = query.toLocaleLowerCase();
    const aliases: Readonly<Record<string, readonly string[]>> = {
      restaurants: ['batter', 'idly', 'idli', 'dosa', 'dosai', 'restaurant', 'food shop', 'சமையல்', 'இட்லி', 'தோசை', 'மாவு'],
      'vegetarian-restaurants': ['vegetarian', 'veg food', 'சைவ உணவு'],
      'catering-services': ['catering', 'சமையல் கேட்டரிங்'],
      plumber: ['plumber', 'plumbing', 'pipe repair', 'பிளம்பர்', 'குழாய்'],
      electrician: ['electrician', 'electrical', 'எலக்ட்ரீஷியன்', 'மின்சார'],
      'ac-service': ['ac service', 'air conditioner', 'ஏசி சர்வீஸ்'],
    };
    const candidates: Array<{ parent: ServiceCategory; subcategory: ServiceCategory; score: number }> = [];
    for (const parent of this.categories.categories()) {
      for (const subcategory of parent.subcategories) {
        const terms = [subcategory.slug, subcategory.nameEnglish, subcategory.nameTamil, ...(aliases[subcategory.slug] ?? [])]
          .map(term => term.toLocaleLowerCase()).filter(term => term.length >= 2);
        const matched = terms.filter(term => text.includes(term));
        if (matched.length) candidates.push({ parent, subcategory, score: Math.max(...matched.map(term => term.length)) });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best || (candidates[1] && candidates[1].score === best.score && candidates[1].subcategory.id !== best.subcategory.id)) return null;
    return { parent: best.parent, subcategory: best.subcategory, reason: 'This matches an active CDM 360 category.' };
  }
}
