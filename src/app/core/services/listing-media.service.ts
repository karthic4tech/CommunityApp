import { Injectable, inject } from '@angular/core';
import { MediaService } from './media.service';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 10;
const PUBLIC_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/**
 * Kept for the submission form. Delegates to MediaService; do not add upload logic here.
 */
@Injectable({ providedIn: 'root' })
export class ListingMediaService {
  private readonly media = inject(MediaService);

  async uploadImages(listingId: string, files: readonly File[], existingCount = 0): Promise<void> {
    if (existingCount + files.length > MAX_IMAGES) throw new Error(`You can upload up to ${MAX_IMAGES} service images.`);
    for (const [index, file] of files.entries()) {
      this.media.validateFileType(file, PUBLIC_IMAGE_TYPES);
      this.media.validateFileSize(file, MAX_IMAGE_BYTES, MAX_IMAGE_BYTES);
      await this.media.uploadImage({
        entityType: 'listing',
        entityId: listingId,
        file,
        sortOrder: existingCount + index,
        isPrimary: existingCount === 0 && index === 0,
        allowedTypes: PUBLIC_IMAGE_TYPES,
        maxFileBytes: MAX_IMAGE_BYTES,
      });
    }
  }
}
