import { DirectoryPage } from './service-listing';

export interface SearchPlace {
  id: string;
  slug: string;
  name_ta: string;
  name_en: string | null;
}

export interface AiServiceSearchResult extends DirectoryPage {
  mode: 'ai' | 'keyword';
  reason: string | null;
  language: 'ta' | 'en';
  intent: {
    category: SearchPlace | null;
    location: SearchPlace | null;
    keywords: string;
  };
}

export interface CategorySuggestion {
  parent: SearchPlace;
  subcategory: SearchPlace;
}

export interface CategorySuggestionResult {
  success: boolean;
  suggestion: CategorySuggestion | null;
  reason: 'direct_match' | 'ai_match' | 'no_match';
}
