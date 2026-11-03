import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from './supabase.service';
import {
  AdminMediaPage,
  AdminMediaQuery,
  AdminMediaRow,
  CleanupReason,
  MediaAsset,
  MediaBucket,
  MediaCleanupItem,
  MediaEntityType,
  MediaGalleryItem,
  MediaMetadataPatch,
  MediaStats,
  MultipleUploadResult,
  PRIVATE_BUCKET,
  PRIVATE_FILE_MIME_TYPES,
  PRIVATE_MAX_BYTES,
  PUBLIC_BUCKET,
  PUBLIC_IMAGE_MIME_TYPES,
  PUBLIC_MAX_BYTES,
  ProviderMediaRole,
  entityFolder,
  objectPathIn,
} from '../models/media.models';

const ABSOLUTE_MAX_PUBLIC_BYTES = PUBLIC_MAX_BYTES;
const ABSOLUTE_MAX_PRIVATE_BYTES = PRIVATE_MAX_BYTES;
const ASSET_COLUMNS = 'id,original_filename,stored_filename,bucket_name,storage_path,media_type,mime_type,file_size_bytes,file_extension,width,height,alt_text,caption,visibility,upload_status,owner_user_id,created_at,updated_at,deleted_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

type UploadCommon = {
  entityType: MediaEntityType;
  entityId: string;
  file: File;
  visibility?: MediaVisibilityOption;
  altText?: string;
  caption?: string;
  role?: ProviderMediaRole;
  sortOrder?: number;
  isPrimary?: boolean;
  maxWidth?: number;
  allowedTypes?: readonly string[];
  maxFileBytes?: number;
  signal?: AbortSignal;
};

type MediaVisibilityOption = 'public' | 'private';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private readonly document = inject(DOCUMENT);

  /** Number of uploads currently in flight. */
  readonly activeUploads = signal(0);

  // ---------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------
  validateFileType(file: File, allowedTypes: readonly string[] = PUBLIC_IMAGE_MIME_TYPES): void {
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`"${file.name || 'This file'}" is not a supported file type.`);
    }
  }

  validateFileSize(file: File, maxFileBytes = ABSOLUTE_MAX_PUBLIC_BYTES, absoluteLimit = ABSOLUTE_MAX_PUBLIC_BYTES): void {
    const limit = Math.min(maxFileBytes, absoluteLimit);
    if (file.size > limit) {
      throw new Error('The file size must not exceed the allowed limit.');
    }
  }

  /** Confirms the file is a decodable image and reports its dimensions. Returns null for non-images. */
  async validateImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
    if (!file.type.startsWith('image/')) return null;
    try {
      const bitmap = await createImageBitmap(file);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dims;
    } catch {
      throw new Error('Please select a valid image file.');
    }
  }

  // ---------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------
  async uploadImage(options: UploadCommon): Promise<MediaAsset> {
    if (options.signal?.aborted) throw new Error('Upload cancelled.');
    const user = this.requireUser();
    this.validateFileType(options.file, options.allowedTypes ?? PUBLIC_IMAGE_MIME_TYPES);
    this.validateFileSize(options.file, options.maxFileBytes ?? ABSOLUTE_MAX_PUBLIC_BYTES, ABSOLUTE_MAX_PUBLIC_BYTES);

    const prepared = await this.prepareImage(options.file, options.maxWidth ?? 1600);

    const bucket = PUBLIC_BUCKET;
    const objectPath = this.uniqueObjectPath(options.entityType, options.entityId, prepared.file);
    const visibility = options.visibility ?? this.defaultVisibility(options.entityType, user.id, options.entityId);

    const asset = await this.persistUpload(bucket, objectPath, prepared.file, visibility, options, user.id, prepared.width, prepared.height);
    await this.attach(asset, options);
    return asset;
  }

  async uploadMultipleImages(options: Omit<UploadCommon, 'file'>, files: readonly File[]): Promise<MultipleUploadResult[]> {
    const results: MultipleUploadResult[] = [];
    for (const file of files) {
      try {
        const asset = await this.uploadImage({ ...options, file });
        results.push({ fileName: file.name, ok: true, asset });
      } catch (error) {
        results.push({ fileName: file.name, ok: false, error: error instanceof Error ? error.message : 'Upload failed.' });
      }
    }
    return results;
  }

  async uploadPrivateFile(options: UploadCommon & { entityType: 'profile' | 'provider' }): Promise<MediaAsset> {
    const user = this.requireUser();
    this.validateFileType(options.file, options.allowedTypes ?? PRIVATE_FILE_MIME_TYPES);
    this.validateFileSize(options.file, options.maxFileBytes ?? ABSOLUTE_MAX_PRIVATE_BYTES, ABSOLUTE_MAX_PRIVATE_BYTES);
    if (options.file.type.startsWith('image/')) await this.validateImageDimensions(options.file);

    const bucket = PRIVATE_BUCKET;
    const objectPath = this.uniqueObjectPath(options.entityType, options.entityId, options.file);
    const asset = await this.persistUpload(bucket, objectPath, options.file, 'private', options, user.id);
    await this.attach(asset, options);
    return asset;
  }

  private async persistUpload(
    bucket: MediaBucket,
    objectPath: string,
    file: File,
    visibility: MediaVisibilityOption,
    options: UploadCommon,
    userId: string,
    width?: number,
    height?: number,
    mediaType?: 'image' | 'document',
  ): Promise<MediaAsset> {
    this.activeUploads.update((n) => n + 1);
    try {
      const upload = this.supabase.client.storage
        .from(bucket)
        .upload(objectPath, file, { upsert: false, contentType: file.type });
      const { error: uploadError } = await this.withAbort(options.signal, upload, () => this.rollback(bucket, objectPath, 'orphaned', options));
      if (uploadError) {
        if (options.signal?.aborted) throw new Error('Upload cancelled.');
        console.error('Storage upload failed', { bucket, objectPath, code: (uploadError as { code?: string }).code, message: uploadError.message });
        throw new Error('Unable to upload image. Please try again.');
      }

      const asset = await this.insertAsset(bucket, objectPath, file, visibility, options, userId, width, height, mediaType ?? (file.type.startsWith('image/') ? 'image' : 'document'));
      if (!asset) {
        await this.rollback(bucket, objectPath, 'metadata_failed', options);
        throw new Error('The image was uploaded but its details could not be saved. The file was discarded.');
      }
      return asset;
    } finally {
      this.activeUploads.update((n) => Math.max(0, n - 1));
    }
  }

  private async insertAsset(
    bucket: MediaBucket,
    objectPath: string,
    file: File,
    visibility: MediaVisibilityOption,
    options: UploadCommon,
    userId: string,
    width?: number,
    height?: number,
    mediaType?: 'image' | 'document',
  ): Promise<MediaAsset | null> {
    const ext = EXT_BY_MIME[file.type] ?? this.extensionOf(file.name);
    const baseName = file.name.replace(/\.[^.]+$/, '').trim();
    const { data, error } = await this.supabase.client
      .from('media_assets')
      .insert({
        owner_user_id: userId,
        storage_path: `${bucket}/${objectPath}`,
        bucket_name: bucket,
        stored_filename: objectPath.slice(objectPath.lastIndexOf('/') + 1),
        original_filename: (file.name || 'file').slice(0, 200),
        media_type: mediaType ?? 'image',
        mime_type: file.type || null,
        file_size_bytes: file.size,
        file_extension: ext,
        width: width ?? null,
        height: height ?? null,
        alt_text: options.altText?.trim() || baseName.slice(0, 300) || null,
        caption: options.caption?.trim() || null,
        visibility,
        upload_status: 'uploaded',
      })
      .select(ASSET_COLUMNS)
      .single<MediaAsset>();
    if (error) {
      console.warn('media_assets insert failed', { code: error.code });
      return null;
    }
    return data;
  }

  /** Attach the asset to its entity. On failure the object and row are removed. */
  private async attach(asset: MediaAsset, options: UploadCommon): Promise<void> {
    try {
      await this.link(asset, options);
    } catch (error) {
      const bucket = (asset.bucket_name as MediaBucket) ?? PUBLIC_BUCKET;
      const objectPath = objectPathIn(asset.storage_path, bucket);
      await this.supabase.client.from('media_assets').update({ upload_status: 'failed', visibility: 'private', deleted_at: new Date().toISOString() }).eq('id', asset.id);
      if (objectPath) await this.rollback(bucket, objectPath, 'metadata_failed', options);
      throw error instanceof Error ? error : new Error('The image could not be attached to this record.');
    }
  }

  private async link(asset: MediaAsset, options: UploadCommon): Promise<void> {
    const linkSort = options.sortOrder ?? 0;
    switch (options.entityType) {
      case 'profile': {
        const { error } = await this.supabase.client.from('profiles').update({ avatar_path: asset.storage_path }).eq('id', this.requireUser().id);
        if (error) throw new Error('Unable to set the profile image.');
        return;
      }
      case 'provider': {
        const role = options.role ?? 'gallery';
        if (options.isPrimary) await this.clearPrimary('provider', options.entityId, role);
        const { error } = await this.supabase.client.from('provider_media').insert({
          provider_id: options.entityId,
          media_asset_id: asset.id,
          role,
          sort_order: linkSort,
          is_primary: Boolean(options.isPrimary),
        });
        if (error) throw new Error('Unable to attach the image to this business.');
        return;
      }
      case 'listing': {
        if (options.isPrimary) await this.clearPrimary('listing', options.entityId);
        const { error } = await this.supabase.client.from('listing_media').insert({
          listing_id: options.entityId,
          media_asset_id: asset.id,
          sort_order: linkSort,
          is_primary: Boolean(options.isPrimary),
        });
        if (error) throw new Error('Unable to attach the image to this listing.');
        return;
      }
      default:
        // events, announcements, categories and banners have no tables yet.
        return;
    }
  }

  private async clearPrimary(kind: 'provider' | 'listing', id: string, role?: ProviderMediaRole): Promise<void> {
    if (kind === 'provider') {
      let query = this.supabase.client.from('provider_media').update({ is_primary: false }).eq('provider_id', id).eq('is_primary', true);
      if (role) query = query.eq('role', role);
      await query;
      return;
    }
    await this.supabase.client.from('listing_media').update({ is_primary: false }).eq('listing_id', id).eq('is_primary', true);
  }

  // ---------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------
  getPublicUrl(storagePath: string): string | null {
    try {
      const url = new URL(storagePath);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch {
      if (storagePath.startsWith('/') || storagePath.split('/').some((p) => p === '..')) return null;
      const [bucket, ...parts] = storagePath.split('/');
      if (!bucket || !parts.length || (bucket !== PUBLIC_BUCKET && bucket !== PRIVATE_BUCKET)) return null;
      return this.supabase.client.storage.from(bucket).getPublicUrl(parts.join('/')).data.publicUrl;
    }
  }

  /** Short-lived URL for a private file. Returns null for files not in the private bucket. */
  async getSignedUrl(storagePath: string, expiresInSeconds = 120): Promise<string | null> {
    const objectPath = objectPathIn(storagePath, PRIVATE_BUCKET);
    if (!objectPath) return null;
    const { data, error } = await this.supabase.client.storage.from(PRIVATE_BUCKET).createSignedUrl(objectPath, Math.max(30, Math.min(expiresInSeconds, 3600)));
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  async getMediaById(id: string): Promise<MediaAsset | null> {
    this.requireUser();
    if (!UUID.test(id)) return null;
    const { data, error } = await this.supabase.client.from('media_assets').select(ASSET_COLUMNS).eq('id', id).is('deleted_at', null).maybeSingle<MediaAsset>();
    if (error) throw new Error('Unable to load this image.');
    return data ?? null;
  }

  /** Assets from getMediaByEntity() with URLs ready for rendering. */
  async getMediaGallery(entityType: MediaEntityType, entityId: string): Promise<MediaGalleryItem[]> {
    const rows = await this.linkedRows(entityType, entityId);
    const items: MediaGalleryItem[] = [];
    for (const { asset, isPrimary } of rows) {
      const url = asset.bucket_name === PRIVATE_BUCKET ? await this.getSignedUrl(asset.storage_path, 120) : this.getPublicUrl(asset.storage_path);
      if (!url) continue;
      items.push({
        asset,
        url,
        fileName: asset.original_filename ?? asset.stored_filename ?? 'image',
        size: asset.file_size_bytes,
        alt: asset.alt_text || asset.original_filename || 'Uploaded image',
        primary: isPrimary,
      });
    }
    return items;
  }

  /** Raw asset rows linked to an entity, or [] for modules that are not implemented yet. */
  async getMediaByEntity(entityType: MediaEntityType, entityId: string): Promise<MediaAsset[]> {
    return (await this.linkedRows(entityType, entityId)).map((row) => row.asset);
  }

  private async linkedRows(entityType: MediaEntityType, entityId: string): Promise<{ asset: MediaAsset; isPrimary: boolean }[]> {
    if (!UUID.test(entityId)) return [];
    if (entityType === 'profile') {
      const { data, error } = await this.supabase.client.from('profiles').select('avatar_path').eq('id', entityId).maybeSingle<{ avatar_path: string | null }>();
      if (error || !data?.avatar_path) return [];
      const { data: asset } = await this.supabase.client.from('media_assets').select(ASSET_COLUMNS).eq('storage_path', data.avatar_path).is('deleted_at', null).maybeSingle<MediaAsset>();
      return asset ? [{ asset, isPrimary: true }] : [];
    }
    const isProvider = entityType === 'provider';
    if (!isProvider && entityType !== 'listing') return []; // events, announcements, categories, banners: not implemented yet
    const table = isProvider ? 'provider_media' : 'listing_media';
    const column = isProvider ? 'provider_id' : 'listing_id';
    let query = this.supabase.client
      .from(table)
      .select(`sort_order,is_primary,media_assets!inner(${ASSET_COLUMNS})`)
      .eq(column, entityId)
      .is('media_assets.deleted_at', null);
    if (isProvider) query = query.order('role', { ascending: true });
    const { data, error } = await query.order('sort_order', { ascending: true });
    if (error) throw new Error('Unable to load the images.');
    const rows = (data ?? []) as unknown as { is_primary: boolean; media_assets: MediaAsset }[];
    return rows.map((row) => ({ asset: row.media_assets, isPrimary: row.is_primary }));
  }

  // ---------------------------------------------------------------
  // Manage
  // ---------------------------------------------------------------
  async updateMediaMetadata(id: string, patch: MediaMetadataPatch): Promise<void> {
    this.requireUser();
    if (!UUID.test(id)) throw new Error('Unable to find this image.');
    const payload: MediaMetadataPatch = {};
    if (patch.alt_text !== undefined) payload.alt_text = patch.alt_text?.trim().slice(0, 300) || null;
    if (patch.caption !== undefined) payload.caption = patch.caption?.trim().slice(0, 500) || null;
    const { error } = await this.supabase.client.from('media_assets').update(payload).eq('id', id);
    if (error) throw new Error('Unable to save the image details.');
  }

  async replaceImage(oldMediaId: string, options: Omit<UploadCommon, 'entityId'> & { entityId: string }): Promise<MediaAsset> {
    this.requireUser();
    if (!UUID.test(oldMediaId) || !UUID.test(options.entityId)) throw new Error('Unable to find this image.');
    // Upload the replacement first; the old object is removed only after the swap is recorded.
    const created = await this.uploadImage(options);
    const { data, error } = await this.supabase.client.rpc('replace_media_asset', { _old_id: oldMediaId, _new_id: created.id });
    if (error) throw new Error('The new image was uploaded, but the replacement could not be saved. Please remove the extra image manually.');
    const queued = data as MediaCleanupItem | null;
    if (queued) await this.removeStoredObject(queued);
    return created;
  }

  async deleteMedia(id: string): Promise<void> {
    this.requireUser();
    if (!UUID.test(id)) throw new Error('Unable to find this image.');
    const { data, error } = await this.supabase.client.rpc('delete_media_asset', { _media_id: id });
    if (error) throw new Error('Unable to delete this image.');
    const queued = data as MediaCleanupItem | null;
    if (!queued) return;
    await this.removeStoredObject(queued);
  }

  async deleteMultipleMedia(ids: readonly string[]): Promise<{ failed: string[] }> {
    const failed: string[] = [];
    for (const id of ids) {
      try { await this.deleteMedia(id); } catch { failed.push(id); }
    }
    return { failed };
  }

  /** Removes the Storage object for a queued cleanup item and records the outcome. */
  private async removeStoredObject(item: MediaCleanupItem): Promise<void> {
    try {
      const { error } = await this.supabase.client.storage.from(item.bucket_name).remove([item.object_path]);
      if (error) throw new Error(error.message);
      await this.supabase.client.rpc('resolve_media_cleanup', { _queue_id: item.id, _error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Storage cleanup failed.';
      await this.supabase.client.rpc('resolve_media_cleanup', { _queue_id: item.id, _error: message });
      console.warn('Media cleanup left pending', { queueId: item.id });
    }
  }

  /** Rejects with "Upload cancelled." as soon as the signal aborts; the late-completing upload is rolled back. */
  private async withAbort<T>(signal: AbortSignal | undefined, work: Promise<T>, onAbort: () => Promise<void>): Promise<T> {
    if (!signal) return work;
    return new Promise<T>((resolve, reject) => {
      const cleanup = (): void => signal.removeEventListener('abort', onFail);
      const finish = (error: Error): void => { cleanup(); reject(error); };
      const onFail = (): void => { void onAbort().finally(() => finish(new Error('Upload cancelled.'))); };
      if (signal.aborted) { onFail(); return; }
      signal.addEventListener('abort', onFail, { once: true });
      work.then((value) => { cleanup(); resolve(value); }, (error: unknown) => { cleanup(); reject(error instanceof Error ? error : new Error(String(error))); });
    });
  }

  private async rollback(bucket: MediaBucket, objectPath: string, reason: CleanupReason, options: Pick<UploadCommon, 'entityType'>): Promise<void> {
    try {
      const { error } = await this.supabase.client.storage.from(bucket).remove([objectPath]);
      if (error) throw new Error(error.message);
    } catch {
      await this.supabase.client.from('media_cleanup_queue').insert({
        bucket_name: bucket,
        object_path: objectPath,
        reason,
        requested_by: this.auth.user()?.id ?? null,
      });
      console.warn('Rollback left an orphaned storage object', { bucket, objectPath, reason, entity: options.entityType });
    }
  }

  // ---------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------
  async getMediaStats(): Promise<MediaStats> {
    this.requireUser();
    const { data, error } = await this.supabase.client.rpc('admin_media_stats');
    if (error) throw new Error('Unable to load media statistics.');
    return data as MediaStats;
  }

  async getAdminMedia(query: AdminMediaQuery = {}): Promise<AdminMediaPage> {
    this.requireUser();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const from = (page - 1) * pageSize;
    let request = this.supabase.client
      .from('admin_media_overview')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);
    const term = query.search?.trim();
    if (term) {
      const safe = term.replace(/[%,()]/g, ' ').trim();
      if (safe) request = request.or(`original_filename.ilike.%${safe}%,stored_filename.ilike.%${safe}%`);
    }
    if (query.module && query.module !== 'all') request = request.eq('related_module', query.module);
    if (query.status && query.status !== 'all') request = request.eq('upload_status', query.status);
    if (query.uploaderId && UUID.test(query.uploaderId)) request = request.eq('owner_user_id', query.uploaderId);
    if (query.from) request = request.gte('created_at', query.from);
    if (query.to) request = request.lte('created_at', query.to);
    const { data, error, count } = await request.order('created_at', { ascending: false }).range(from, from + pageSize - 1).returns<AdminMediaRow[]>();
    if (error) throw new Error('Unable to load media.');
    return { rows: data ?? [], total: count ?? data?.length ?? 0, page, pageSize };
  }

  async getCleanupItems(includeResolved = false): Promise<MediaCleanupItem[]> {
    this.requireUser();
    let request = this.supabase.client.from('media_cleanup_queue').select('*').order('created_at', { ascending: false });
    if (!includeResolved) request = request.is('resolved_at', null);
    const { data, error } = await request.returns<MediaCleanupItem[]>();
    if (error) throw new Error('Unable to load the cleanup queue.');
    return data ?? [];
  }

  async retryCleanup(item: MediaCleanupItem): Promise<boolean> {
    this.requireUser();
    const { error } = await this.supabase.client.storage.from(item.bucket_name).remove([item.object_path]);
    const { error: rpcError } = await this.supabase.client.rpc('resolve_media_cleanup', {
      _queue_id: item.id,
      _error: error ? error.message : null,
    });
    return !error && !rpcError;
  }

  /** Admin check helper for UI (security is enforced by the database). */
  adminAllowed(): boolean {
    return this.auth.roles().some((r) => r === 'super_admin' || r === 'district_admin' || r === 'moderator');
  }

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  private requireUser() {
    const user = this.auth.user();
    if (!user) throw new Error('Please log in to upload images.');
    return user;
  }

  private defaultVisibility(entityType: MediaEntityType, userId: string, entityId: string): MediaVisibilityOption {
    return entityType === 'profile' && entityId === userId ? 'public' : 'private';
  }

  private uniqueObjectPath(entityType: MediaEntityType, entityId: string, file: File): string {
    if (!UUID.test(entityId)) throw new Error('Please choose an item to attach the image to.');
    const ext = EXT_BY_MIME[file.type] ?? this.extensionOf(file.name);
    const base = file.name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image';
    const id = this.document.defaultView?.crypto.randomUUID() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${entityFolder(entityType)}/${entityId}/${id}-${base}.${ext}`;
  }

  private extensionOf(name: string): string {
    const ext = name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
    return ext ?? 'bin';
  }

  /** Resize/re-encode still images. GIFs, SVGs and non-images pass through untouched. */
  private async prepareImage(file: File, maxWidth: number): Promise<{ file: File; width?: number; height?: number }> {
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
      return { file };
    }
    if (maxWidth <= 0) return { file };
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxWidth / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      if (scale === 1 && file.type === 'image/webp' && file.size <= ABSOLUTE_MAX_PUBLIC_BYTES / 2) {
        bitmap.close();
        return { file, width, height };
      }
      const canvas = this.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) { bitmap.close(); return { file, width, height }; }
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
      if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return { file, width, height };
      return { file: new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }), width, height };
    } catch {
      return { file };
    }
  }
}
