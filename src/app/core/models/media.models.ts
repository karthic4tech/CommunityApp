/**
 * CDM 360 media module. Reuses the existing public.media_assets table and the
 * relationship tables created by supabase/migrations/*media*.sql.
 */

export const PUBLIC_BUCKET = 'cdm360-public-media';
export const PRIVATE_BUCKET = 'cdm360-private-files';

export const PUBLIC_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const PRIVATE_FILE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;

export const PUBLIC_MAX_BYTES = 5 * 1024 * 1024;
export const PRIVATE_MAX_BYTES = 10 * 1024 * 1024;

export type MediaBucket = typeof PUBLIC_BUCKET | typeof PRIVATE_BUCKET;
export type MediaEntityType = 'profile' | 'provider' | 'listing' | 'event' | 'announcement' | 'category' | 'banner';
export type MediaVisibility = 'public' | 'private';
export type MediaUploadStatus = 'pending' | 'uploaded' | 'failed' | 'deleted';
export type ProviderMediaRole = 'logo' | 'profile' | 'gallery';

const ENTITY_FOLDERS: Record<MediaEntityType, string> = {
  profile: 'profiles',
  provider: 'businesses',
  listing: 'services',
  event: 'events',
  announcement: 'announcements',
  category: 'categories',
  banner: 'banners',
};

/** First path segment of an object name inside the public bucket. */
export const entityFolder = (entityType: MediaEntityType): string => ENTITY_FOLDERS[entityType];

export const isMediaEntityType = (value: string | null | undefined): value is MediaEntityType =>
  value != null && Object.hasOwn(ENTITY_FOLDERS, value);

export interface MediaAsset {
  id: string;
  original_filename: string | null;
  stored_filename: string | null;
  bucket_name: string | null;
  storage_path: string;
  media_type: 'image' | 'document' | 'video' | 'other';
  mime_type: string | null;
  file_size_bytes: number | null;
  file_extension: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  visibility: MediaVisibility | 'restricted';
  upload_status: MediaUploadStatus;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MediaGalleryItem {
  asset: MediaAsset;
  url: string;
  fileName: string;
  size: number | null;
  alt: string;
  primary: boolean;
}

export interface UploadImageOptions {
  entityType: MediaEntityType;
  entityId: string;
  file: File;
  /** Overrides the default visibility rule (public bucket items are private until approved). */
  visibility?: MediaVisibility;
  altText?: string;
  caption?: string;
  /** Relationship metadata. Ignored for event/announcement/category/banner. */
  role?: ProviderMediaRole;
  sortOrder?: number;
  isPrimary?: boolean;
  maxWidth?: number;
  allowedTypes?: readonly string[];
  maxFileBytes?: number;
  signal?: AbortSignal;
}

export interface UploadPrivateFileOptions extends UploadImageOptions {
  entityType: 'profile' | 'provider';
}

export type PrivateUploadResult = MediaAsset;

export interface MultipleUploadResult {
  fileName: string;
  ok: boolean;
  asset?: MediaAsset;
  error?: string;
}

export interface MediaMetadataPatch {
  alt_text?: string | null;
  caption?: string | null;
}

export type CleanupReason = 'deleted' | 'replaced' | 'metadata_failed' | 'orphaned';

export interface MediaCleanupItem {
  id: string;
  media_asset_id: string | null;
  bucket_name: string;
  object_path: string;
  reason: CleanupReason;
  attempts: number;
  last_error: string | null;
  requested_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type AdminMediaModule = 'service_listing' | 'provider' | 'profile' | null;

export interface AdminMediaRow {
  id: string;
  original_filename: string | null;
  stored_filename: string | null;
  bucket_name: string | null;
  storage_path: string;
  media_type: MediaAsset['media_type'];
  mime_type: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  visibility: MediaAsset['visibility'];
  upload_status: MediaUploadStatus;
  owner_user_id: string | null;
  uploader_name: string | null;
  related_module: AdminMediaModule;
  created_at: string;
  deleted_at: string | null;
}

export interface AdminMediaQuery {
  search?: string;
  module?: AdminMediaModule | 'all';
  status?: MediaUploadStatus | 'all';
  uploaderId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminMediaPage {
  rows: AdminMediaRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MediaStats {
  total: number;
  public: number;
  private: number;
  failed: number;
  deleted: number;
  recent: number;
  bytes: number;
  orphaned: number;
  pending_cleanup: number;
}

const inBucket = (storagePath: string, bucket: MediaBucket): string | null => {
  const prefix = `${bucket}/`;
  return storagePath.startsWith(prefix) ? storagePath.slice(prefix.length) : null;
};
/** Object name inside the bucket, or null when the path does not belong to the bucket. */
export const objectPathIn = (storagePath: string, bucket: MediaBucket): string | null => inBucket(storagePath, bucket);
