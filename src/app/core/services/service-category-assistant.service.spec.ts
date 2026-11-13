import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ServiceCategory } from '../models/service-category';
import { AiServiceSearchService } from './ai-service-search.service';
import { ServiceCategoryAssistantService } from './service-category-assistant.service';
import { ServiceCategoryService } from './service-category.service';

describe('ServiceCategoryAssistantService', () => {
  const hotelCategory: ServiceCategory = {
    id: 'hotel-category', parentCategoryId: 'hospitality', nameTamil: 'தங்கும் விடுதிகள்', nameEnglish: 'Hotels',
    slug: 'hotels', description: null, icon: null, sortOrder: 1, subcategories: [],
  };
  const rootCategory: ServiceCategory = {
    id: 'hospitality', parentCategoryId: null, nameTamil: 'உணவு மற்றும் தங்குமிடம்', nameEnglish: 'Food and Hospitality',
    slug: 'hospitality', description: null, icon: null, sortOrder: 1, subcategories: [hotelCategory],
  };
  const cabCategory: ServiceCategory = {
    id: 'cab-category', parentCategoryId: 'transport', nameTamil: 'கேப் / டாக்ஸி', nameEnglish: 'Cab / Taxi',
    slug: 'cab-services', description: null, icon: null, sortOrder: 1, subcategories: [],
  };
  const transportCategory: ServiceCategory = {
    id: 'transport', parentCategoryId: null, nameTamil: 'போக்குவரத்து', nameEnglish: 'Transport',
    slug: 'transport-tourism-services', description: null, icon: null, sortOrder: 2, subcategories: [cabCategory],
  };
  const suggestCategory = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({ providers: [
      { provide: AiServiceSearchService, useValue: { suggestCategory } },
      { provide: ServiceCategoryService, useValue: { load: vi.fn().mockResolvedValue(undefined), categories: () => [rootCategory, transportCategory] } },
    ] });
  });

  it.each(['stay', 'stays', 'place to stay', 'hotel', 'hotels', 'guest house', 'தங்கும் விடுதி', 'ஹோட்டல்'])('matches common hotel wording locally: %s', async query => {
    const suggestion = await TestBed.inject(ServiceCategoryAssistantService).suggest(query);
    expect(suggestion).toMatchObject({ parent: rootCategory, subcategory: hotelCategory });
    expect(suggestCategory).not.toHaveBeenCalled();
  });

  it.each(['transport', 'taxi', 'local transport', 'போக்குவரத்து'])('matches common transport wording to Cab / Taxi locally: %s', async query => {
    const suggestion = await TestBed.inject(ServiceCategoryAssistantService).suggest(query);
    expect(suggestion).toMatchObject({ parent: transportCategory, subcategory: cabCategory });
    expect(suggestCategory).not.toHaveBeenCalled();
  });
});
