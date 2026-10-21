import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  function setup(saved: string | null = null, blocked = false) {
    const storage = {
      getItem: vi.fn(() => { if (blocked) throw new Error('Blocked'); return saved; }),
      setItem: vi.fn(() => { if (blocked) throw new Error('Blocked'); }),
    };
    const document = { documentElement: { lang: '' }, title: '', defaultView: { localStorage: storage } };
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: document }] });
    return { service: TestBed.inject(LanguageService), document, storage };
  }

  it('defaults to Tamil and persists English selection', () => {
    const { service, document, storage } = setup();
    expect(service.language()).toBe('ta');
    service.setLanguage('en');
    expect(storage.setItem).toHaveBeenCalledWith('nam-chidambaram-language', 'en');
    expect(document.documentElement.lang).toBe('en');
    expect(service.text().categories).toBe('Service categories');
  });

  it('restores a saved English preference', () => {
    expect(setup('en').service.language()).toBe('en');
  });

  it('ignores unsupported saved preferences', () => {
    expect(setup('fr').service.language()).toBe('ta');
  });

  it('works when storage is unavailable', () => {
    const { service } = setup(null, true);
    expect(() => service.setLanguage('en')).not.toThrow();
    expect(service.language()).toBe('en');
  });
});
