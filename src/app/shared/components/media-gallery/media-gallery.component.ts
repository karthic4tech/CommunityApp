import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { MediaService } from '../../../core/services/media.service';
import { MediaEntityType, MediaGalleryItem } from '../../../core/models/media.models';
import { MediaPreviewComponent } from '../media-preview/media-preview.component';

/**
 * Reusable image gallery. Either pass an `entity` pair to load the linked media,
 * or pass ready-made `items` (useful for previews and admin tools).
 */
@Component({
  selector: 'app-media-gallery',
  imports: [NgOptimizedImage, MediaPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-gallery.component.html',
  styleUrl: './media-gallery.component.scss',
})
export class MediaGalleryComponent {
  private readonly media = inject(MediaService);

  readonly entityType = input<MediaEntityType | null>(null);
  readonly entityId = input<string | null>(null);
  /** When set, these items are rendered and no loading happens. */
  readonly items = input<readonly MediaGalleryItem[] | null>(null);
  readonly layout = input<'grid' | 'list'>('grid');
  readonly imageSizes = input('(max-width: 650px) 100vw, (max-width: 1200px) 50vw, 33vw');
  readonly showPrimaryBadge = input(true);
  /** Emitted when an image fails to load. */
  readonly imageError = output<string>();

  protected readonly loaded = signal<MediaGalleryItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly broken = signal<ReadonlySet<string>>(new Set());
  protected readonly previewIndex = signal<number | null>(null);

  protected readonly visibleItems = computed(() => this.items() ?? this.loaded());
  protected readonly goodItems = computed(() => this.visibleItems().filter((item) => !this.broken().has(item.asset.id)));

  constructor() {
    effect(() => {
      const type = this.entityType();
      const id = this.entityId();
      if (this.items() || !type || !id) return;
      void this.reload();
    });
  }

  protected async reload(): Promise<void> {
    const type = this.entityType();
    const id = this.entityId();
    if (!type || !id) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      this.loaded.set(await this.media.getMediaGallery(type, id));
      this.broken.set(new Set());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load the images.');
    } finally {
      this.loading.set(false);
    }
  }

  protected markBroken(id: string): void {
    this.broken.update((set) => new Set(set).add(id));
    this.imageError.emit(id);
  }

  protected openPreview(index: number): void {
    this.previewIndex.set(index);
  }

  protected closePreview(): void {
    this.previewIndex.set(null);
  }

}
