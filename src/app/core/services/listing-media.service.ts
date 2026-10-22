import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from './supabase.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 10;

@Injectable({ providedIn: 'root' })
export class ListingMediaService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private readonly document = inject(DOCUMENT);

  async uploadImages(listingId: string, files: readonly File[], existingCount = 0): Promise<void> {
    const user = this.auth.user();
    const bucket = environment.supabaseStorageBucket.trim();
    if (!user) throw new Error('Please sign in before uploading photos.');
    if (!bucket) throw new Error('Photo uploads are not configured yet. Set the Supabase Storage bucket in the environment.');
    if (existingCount + files.length > MAX_IMAGES) throw new Error(`You can upload up to ${MAX_IMAGES} service images.`);

    for (const [index, file] of files.entries()) {
      if (!file.type.startsWith('image/')) throw new Error('Only image files can be uploaded.');
      if (file.size > MAX_IMAGE_BYTES) throw new Error('Each image must be 5 MB or smaller.');
      const objectPath = `${user.id}/${listingId}/${this.fileName(file, index)}`;
      const { error: uploadError } = await this.supabase.client.storage.from(bucket).upload(objectPath, file, { upsert: false, contentType: file.type });
      if (uploadError) throw new Error('Unable to upload one of the images.');
      const storagePath = `${bucket}/${objectPath}`;
      const { data: asset, error: assetError } = await this.supabase.client.from('media_assets').insert({
        owner_user_id: user.id,
        storage_path: storagePath,
        media_type: 'image',
        mime_type: file.type,
        file_size_bytes: file.size,
        visibility: 'private',
      }).select('id').single<{ id: string }>();
      if (assetError || !asset) throw new Error('Unable to save image metadata.');
      const { error: linkError } = await this.supabase.client.from('listing_media').insert({ listing_id: listingId, media_asset_id: asset.id, sort_order: existingCount + index });
      if (linkError) throw new Error('Unable to attach the image to this submission.');
    }
  }

  private fileName(file: File, index: number): string {
    const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-80) || `image-${index + 1}.jpg`;
    const random = this.document.defaultView?.crypto.randomUUID() ?? `${Date.now()}-${index}`;
    return `${random}-${safe}`;
  }
}
