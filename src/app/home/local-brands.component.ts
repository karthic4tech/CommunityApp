import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocalBrand } from '../core/models/local-brand';
import { LanguageService } from '../core/services/language.service';
import { LocalBrandService } from '../core/services/local-brand.service';

@Component({
  selector: 'app-local-brands',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './local-brands.component.html',
  styleUrl: './local-brands.component.scss',
})
export class LocalBrandsComponent implements OnInit {
  protected readonly i18n = inject(LanguageService);
  private readonly brandsService = inject(LocalBrandService);
  private readonly document = inject(DOCUMENT);

  protected readonly brands = signal<LocalBrand[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** One full viewport per marquee period prevents the loop copies appearing together. */
  protected readonly marqueeEnabled = computed(() => this.brands().length >= 2);
  protected readonly copy = computed(() => this.i18n.language() === 'ta'
    ? {
      eyebrow: 'உள்ளூர் வணிகங்கள்', title: 'சிதம்பரத்தின் உள்ளூர் பிராண்டுகள்', description: 'நம் நகரத்தை வளர்க்கும் சரிபார்க்கப்பட்ட வணிகங்கள்.',
      viewAll: 'அனைத்து வணிகங்களையும் காண்க', previous: 'முந்தைய வணிகங்கள்', next: 'அடுத்த வணிகங்கள்',
      loading: 'உள்ளூர் வணிகங்கள் ஏற்றப்படுகின்றன…', failed: 'உள்ளூர் வணிகங்களை ஏற்ற முடியவில்லை.', retry: 'மீண்டும் முயற்சி',
      empty: 'வணிகங்கள் விரைவில் இங்கே இடம்பெறும்.', open: 'வணிக விவரங்களைத் திறக்கவும்', fallback: 'வணிக லோகோ கிடைக்கவில்லை',
    }
    : {
      eyebrow: 'LOCAL BUSINESS DIRECTORY', title: 'Chidambaram’s Local Brands', description: 'Discover the verified businesses building our local community.',
      viewAll: 'View All Businesses', previous: 'Previous businesses', next: 'Next businesses',
      loading: 'Loading local businesses…', failed: 'Local businesses could not be loaded.', retry: 'Try again',
      empty: 'Local brands will appear here as businesses are featured.', open: 'Open business details', fallback: 'Business logo unavailable',
    });

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.brands.set(await this.brandsService.featuredBusinesses());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.copy().failed);
    } finally {
      this.loading.set(false);
    }
  }

  protected scroll(viewport: HTMLElement, direction: -1 | 1): void {
    const reducedMotion = this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
    viewport.scrollBy({ left: direction * 232, behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  protected initials(displayName: string): string {
    const words = displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return words.map((word) => word.charAt(0).toLocaleUpperCase()).join('') || 'CD';
  }
}
