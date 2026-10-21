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
