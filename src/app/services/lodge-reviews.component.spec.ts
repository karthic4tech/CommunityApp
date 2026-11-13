import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { LodgeReviewsService } from '../core/services/lodge-reviews.service';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/services/language.service';
import { LodgeReviewsComponent } from './lodge-reviews.component';

describe('LodgeReviewsComponent', () => {
  const signedInUser = signal<{ id: string } | null>(null);
  const saveReview = vi.fn();
  const reviewService = {
    summary: vi.fn().mockResolvedValue(null),
    reviews: vi.fn().mockResolvedValue({ reviews: [], total: 0 }),
    myReview: vi.fn().mockResolvedValue(null),
    ownsListing: vi.fn().mockResolvedValue(false),
    saveReview,
    report: vi.fn(),
    respond: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    signedInUser.set(null);
    reviewService.summary.mockResolvedValue(null);
    reviewService.reviews.mockResolvedValue({ reviews: [], total: 0 });
    reviewService.myReview.mockResolvedValue(null);
    reviewService.ownsListing.mockResolvedValue(false);
    TestBed.configureTestingModule({
      imports: [LodgeReviewsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: signedInUser } },
        { provide: LanguageService, useValue: { language: () => 'en' } },
        { provide: LodgeReviewsService, useValue: reviewService },
      ],
    });
  });

  it('shows a real unrated empty state without inventing a rating', async () => {
    const fixture = TestBed.createComponent(LodgeReviewsComponent);
    fixture.componentRef.setInput('listingId', 'lodge-1');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('New Listing – No Reviews Yet');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No published reviews yet.');
    fixture.destroy();
  });

  it('submits a signed-in guest review and keeps it pending moderation', async () => {
    signedInUser.set({ id: 'guest-1' });
    saveReview.mockResolvedValue({ id: 'review-1', listing_id: 'lodge-1', rating: 5, title: null, review_text: 'Comfortable and clean stay.', status: 'pending_review', created_at: '2026-01-01' });
    const fixture = TestBed.createComponent(LodgeReviewsComponent);
    fixture.componentRef.setInput('listingId', 'lodge-1');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.reviews-header .review-action')!.click();
    fixture.detectChanges();
    const rating = element.querySelector<HTMLInputElement>('input[name="lodge-rating"][value="5"]')!;
    rating.checked = true;
    rating.dispatchEvent(new Event('change', { bubbles: true }));
    const textarea = element.querySelector<HTMLTextAreaElement>('[formControlName="review_text"]')!;
    textarea.value = 'Comfortable and clean stay.';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    element.querySelector<HTMLFormElement>('.review-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(saveReview).toHaveBeenCalledWith('lodge-1', 5, '', 'Comfortable and clean stay.', null);
    expect(element.textContent).toContain('awaiting moderation before publication');
    fixture.destroy();
  });
});
