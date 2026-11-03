import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MediaGalleryItem } from '../../../core/models/media.models';

/**
 * Full-screen lightbox for a set of gallery items. Rendered by the gallery component
 * (or used standalone). Keyboard: Escape closes, Arrow keys navigate.
 */
@Component({
  selector: 'app-media-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    '[attr.aria-label]': '"Image viewer: " + current()?.alt',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <button type="button" class="backdrop" aria-label="Close image viewer" (click)="close()"></button>

    <figure class="stage">
      <img class="stage-image" [src]="current()?.url" [alt]="current()?.alt ?? 'Uploaded image'" />
      <figcaption class="stage-caption">{{ current()?.alt }}</figcaption>
    </figure>

    <button type="button" class="close-button" #closeButton aria-label="Close image viewer" (click)="close()">
      <i class="bi bi-x-lg" aria-hidden="true"></i>
    </button>

    @if (items().length > 1) {
      <button type="button" class="nav nav-prev" aria-label="Previous image" (click)="previous()">
        <i class="bi bi-chevron-left" aria-hidden="true"></i>
      </button>
      <button type="button" class="nav nav-next" aria-label="Next image" (click)="next()">
        <i class="bi bi-chevron-right" aria-hidden="true"></i>
      </button>
      <p class="counter" aria-live="polite">{{ effectiveIndex() + 1 }} of {{ items().length }}</p>
    }
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 1050; display: contents; }
    .backdrop { position: fixed; inset: 0; border: 0; padding: 0; background: rgb(0 0 0 / .72); cursor: zoom-out; }
    .stage { position: fixed; inset: 4vh 4vw; display: grid; grid-template-rows: 1fr auto; gap: .5rem; margin: 0; pointer-events: none; }
    .stage-image { max-width: 100%; max-height: 100%; place-self: center; pointer-events: auto; border-radius: 8px; box-shadow: 0 8px 40px rgb(0 0 0 / .5); }
    .stage-caption { place-self: center; margin: 0; padding: .4rem .8rem; border-radius: 99px; background: rgb(0 0 0 / .55); color: #fff; font-size: .9rem; overflow-wrap: anywhere; }
    .close-button { position: fixed; top: 1rem; right: 1rem; }
    .nav, .close-button {
      display: inline-flex; align-items: center; justify-content: center;
      width: 48px; height: 48px; border: 0; border-radius: 50%;
      background: rgb(0 0 0 / .55); color: #fff; font-size: 1.3rem; cursor: pointer;
    }
    .nav-prev { position: fixed; left: .75rem; top: 50%; transform: translateY(-50%); }
    .nav-next { position: fixed; right: .75rem; top: 50%; transform: translateY(-50%); }
    .counter { position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%); margin: 0; padding: .35rem .9rem; border-radius: 99px; background: rgb(0 0 0 / .55); color: #fff; font-size: .85rem; }
    :is(button):focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
    @media (max-width: 560px) { .stage { inset: 6vh 2vw; } .stage-caption { font-size: .8rem; } }
  `,
})
export class MediaPreviewComponent {
  private readonly document = inject(DOCUMENT);

  readonly items = input.required<readonly MediaGalleryItem[]>();
  /** Zero-based index of the open image. */
  readonly index = input(0);
  readonly closed = output<void>();

  protected readonly indexOverride = signal<number | null>(null);
  protected readonly effectiveIndex = computed(() => {
    const override = this.indexOverride();
    if (override !== null) return Math.min(Math.max(0, override), Math.max(0, this.items().length - 1));
    return Math.min(Math.max(0, this.index()), Math.max(0, this.items().length - 1));
  });
  protected readonly current = computed<MediaGalleryItem | null>(() => this.items()[this.effectiveIndex()] ?? null);

  private readonly restoredFocus: HTMLElement | null;

  constructor() {
    const previous = this.document.activeElement;
    this.document.documentElement.style.overflow = 'hidden';
    this.restoredFocus = previous instanceof HTMLElement ? previous : null;
    // Move focus into the dialog.
    queueMicrotask(() => this.document.querySelector<HTMLButtonElement>('app-media-preview .close-button')?.focus());
  }

  close(): void {
    this.document.documentElement.style.overflow = '';
    this.restoredFocus?.focus();
    this.closed.emit();
  }

  protected next(): void {
    this.indexOverride.set((this.effectiveIndex() + 1) % this.items().length);
  }

  protected previous(): void {
    this.indexOverride.set((this.effectiveIndex() - 1 + this.items().length) % this.items().length);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { event.preventDefault(); this.close(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); this.next(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); this.previous(); }
  }
}
