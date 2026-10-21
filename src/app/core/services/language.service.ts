import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type Language = 'ta' | 'en';
const TEXT = {
  ta: {
    skip: 'உள்ளடக்கத்திற்குச் செல்ல', brand: 'நம் சிதம்பரம்', secondaryBrand: 'Nam Chidambaram',
    tagline: 'நம் ஊர் · நம் மக்கள் · நம் சேவைகள்', title: 'உங்களுக்குத் தேவையான சேவைகள்',
    intro: 'சேவை வகையைத் தேர்ந்தெடுத்து அதன் உட்பிரிவுகளைப் பாருங்கள்.', categories: 'சேவை வகைகள்',
    loading: 'சேவை வகைகள் ஏற்றப்படுகின்றன…', error: 'சேவை வகைகளை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    retry: 'மீண்டும் முயற்சிக்கவும்', empty: 'தற்போது சேவை வகைகள் எதுவும் கிடைக்கவில்லை.',
    refresh: 'புதுப்பிக்கவும்', noChildren: 'தற்போது உட்பிரிவுகள் எதுவும் இல்லை.', footer: 'நம் சமூகத்தை இணைப்போம்.',
  },
  en: {
    skip: 'Skip to content', brand: 'Nam Chidambaram', secondaryBrand: 'நம் சிதம்பரம்',
    tagline: 'Our town · Our people · Our services', title: 'Find the services you need',
    intro: 'Select a service category to explore its subcategories.', categories: 'Service categories',
    loading: 'Loading service categories…', error: 'Unable to load service categories. Please try again.',
    retry: 'Try again', empty: 'No service categories are available right now.',
    refresh: 'Refresh', noChildren: 'No subcategories are available right now.', footer: 'Connecting our community.',
  },
} as const;

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly selected = signal<Language>(this.savedLanguage());
  readonly language = this.selected.asReadonly();
  readonly secondaryLanguage = computed(() => this.language() === 'ta' ? 'en' : 'ta');
  readonly text = computed(() => TEXT[this.language()]);

  constructor() {
    this.updateDocument();
  }

  setLanguage(language: Language): void {
    this.selected.set(language);
    this.updateDocument();
    try {
      this.document.defaultView?.localStorage.setItem('nam-chidambaram-language', language);
    } catch { /* Language switching still works when browser storage is blocked. */ }
  }

  private savedLanguage(): Language {
    try {
      return this.document.defaultView?.localStorage.getItem('nam-chidambaram-language') === 'en' ? 'en' : 'ta';
    } catch {
      return 'ta';
    }
  }

  private updateDocument(): void {
    this.document.documentElement.lang = this.language();
    this.document.title = this.language() === 'ta'
      ? 'நம் சிதம்பரம் | Nam Chidambaram' : 'Nam Chidambaram | நம் சிதம்பரம்';
  }
}
