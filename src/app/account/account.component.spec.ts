import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { AccountComponent } from './account.component';
import { AuthService } from '../core/auth/auth.service';
import { SubmissionRow, SubmissionStatus } from '../core/models/service-submission';
import { LanguageService } from '../core/services/language.service';
import { MediaService } from '../core/services/media.service';
import { ProfileService } from '../core/services/profile.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { ServiceSubmissionService } from '../core/services/service-submission.service';

const user = {
  id: 'account-user',
  email: 'member@example.com',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  created_at: '2025-01-01T00:00:00.000Z',
  user_metadata: { full_name: 'Community Member' },
} as unknown as User;

function submission(id: string, status: SubmissionStatus): SubmissionRow {
  return {
    id,
    provider_id: `provider-${id}`,
    category_id: 'category-1',
    title: `Service ${id}`,
    description: 'Community service',
    status,
    submitted_at: null,
    published_at: status === 'published' ? '2026-01-01T00:00:00.000Z' : null,
    updated_at: '2026-02-01T00:00:00.000Z',
    service_providers: {
      id: `provider-${id}`,
      owner_user_id: user.id,
      provider_type: 'individual',
      display_name: `Provider ${id}`,
      description: null,
      verification_status: 'pending',
      public_email: null,
      website_url: null,
      address: null,
      postal_code: null,
      latitude: null,
      longitude: null,
    },
    service_categories: null,
    listing_verification_history: [],
    service_listing_revisions: [],
  };
}

describe('AccountComponent', () => {
  const authenticatedUser = signal<User | null>(user);
  const emailVerified = signal(true);
  const savedProfile = vi.fn();
  const profile = {
    id: user.id,
    full_name: 'Community Member',
    phone: '1234567890',
    preferred_locality_id: null,
    preferred_language: 'en' as const,
    avatar_path: null,
  };

  beforeEach(() => {
    authenticatedUser.set(user);
    emailVerified.set(true);
    savedProfile.mockReset().mockImplementation(async (values) => ({ id: user.id, ...values, avatar_path: null }));
    TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: authenticatedUser, emailVerified } },
        { provide: ProfileService, useValue: { ensure: vi.fn().mockResolvedValue(profile), save: savedProfile } },
        { provide: ServiceDirectoryService, useValue: { locations: vi.fn().mockResolvedValue([]) } },
        { provide: ServiceSubmissionService, useValue: { listMine: vi.fn().mockResolvedValue([submission('1', 'draft'), submission('2', 'pending_review'), submission('3', 'published')]) } },
        { provide: MediaService, useValue: { getMediaGallery: vi.fn().mockResolvedValue([]) } },
      ],
    });
    TestBed.inject(LanguageService).setLanguage('en');
  });

  it('renders summary counts from the authenticated user submissions', async () => {
    const fixture = TestBed.createComponent(AccountComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as { loadProfile(): Promise<void>; loadActivity(): Promise<void> };
    await Promise.all([component.loadProfile(), component.loadActivity()]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const values = Array.from(element.querySelectorAll<HTMLElement>('.stat-value')).map((value) => value.textContent?.trim());
    expect(values).toEqual(['3', '1', '1']);
    expect(element.querySelectorAll('.mini-submission')).toHaveLength(3);
    expect(element.querySelector('.identity-copy h2')?.textContent).toContain('Community Member');
    fixture.destroy();
  });

  it('saves the existing profile fields through ProfileService', async () => {
    const fixture = TestBed.createComponent(AccountComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as { loadProfile(): Promise<void>; loadActivity(): Promise<void> };
    await Promise.all([component.loadProfile(), component.loadActivity()]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const name = element.querySelector<HTMLInputElement>('[formControlName="full_name"]')!;
    expect(name.readOnly).toBe(true);
    expect(element.querySelector('.save-button')).toBeNull();
    element.querySelector<HTMLButtonElement>('.identity-card .text-action')!.click();
    fixture.detectChanges();
    expect(name.readOnly).toBe(false);
    expect(element.querySelector<HTMLSelectElement>('[formControlName="preferred_language"]')?.disabled).toBe(false);
    expect(element.querySelector('.save-button')).not.toBeNull();
    name.value = 'Updated Member';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    element.querySelector<HTMLFormElement>('.profile-panel form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(savedProfile).toHaveBeenCalledWith({
      full_name: 'Updated Member',
      phone: '1234567890',
      preferred_language: 'en',
      preferred_locality_id: '',
    });
    expect(element.querySelector('.save-message')?.textContent).toContain('Your profile was saved');
    fixture.destroy();
  });
});
