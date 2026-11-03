import {
  MediaEntityType,
  MediaGalleryItem,
  PUBLIC_IMAGE_MIME_TYPES,
  ProviderMediaRole,
} from '../../../core/models/media.models';

/** Single selected file waiting to be uploaded, or already being uploaded. */
export interface MediaUploadDraft {
  readonly id: string;
  readonly file: File;
  /** Object URL for previews; null for documents. Revoked when the draft is removed. */
  readonly previewUrl: string | null;
  readonly status: 'ready' | 'uploading' | 'failed';
  readonly error: string | null;
}

/** Configuration shared by the upload component's inputs. */
export interface MediaUploadConfig {
  entityType: MediaEntityType;
  entityId: string;
  uploadType: 'image' | 'document';
  multiple: boolean;
  maxFiles: number;
  maxFileSizeMb: number;
  acceptedTypes: readonly string[];
  allowPreview: boolean;
  allowReplace: boolean;
  allowDelete: boolean;
  role: ProviderMediaRole;
}

export const DEFAULT_ACCEPTED_TYPES = PUBLIC_IMAGE_MIME_TYPES;

/** Items already linked to the entity, used to render the "current images" list. */
export type ExistingMedia = MediaGalleryItem;
