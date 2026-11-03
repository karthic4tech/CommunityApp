import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MediaService } from './media.service';
import { PRIVATE_BUCKET, PUBLIC_BUCKET, MediaAsset, MediaCleanupItem } from '../models/media.models';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from './supabase.service';

const ASSET: MediaAsset = {
  id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  original_filename: 'photo.png',
  stored_filename: 'stored.webp',
  bucket_name: PUBLIC_BUCKET,
  storage_path: `${PUBLIC_BUCKET}/services/18181818-1818-4818-8818-181818181818/stored.webp`,
  media_type: 'image',
  mime_type: 'image/webp',
  file_size_bytes: 1024,
  file_extension: 'webp',
  width: 800,
  height: 600,
  alt_text: 'Photo',
  caption: null,
  visibility: 'private',
  upload_status: 'uploaded',
  owner_user_id: 'user-1',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  deleted_at: null,
};

const CLEANUP: MediaCleanupItem = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  media_asset_id: ASSET.id,
  bucket_name: PUBLIC_BUCKET,
  object_path: `services/18181818-1818-4818-8818-181818181818/stored.webp`,
  reason: 'deleted',
  attempts: 0,
  last_error: null,
  requested_by: 'user-1',
  created_at: '2026-10-01T00:00:00Z',
  resolved_at: null,
};

const LISTING_ID = '18181818-1818-4818-8818-181818181818';

describe('MediaService', () => {
  const upload = vi.fn();
  const remove = vi.fn();
  const getPublicUrl = vi.fn();
  const createSignedUrl = vi.fn();
  const insertMedia = vi.fn();
  const selectMedia = vi.fn();
  const singleMedia = vi.fn();
  const insertLink = vi.fn();
  const updateProfiles = vi.fn();
  const updateProfilesEq = vi.fn();
  const insertQueue = vi.fn();
  const rpc = vi.fn();
  const from = vi.fn();
  const storageFrom = vi.fn((_bucket: string) => ({ upload, remove, getPublicUrl, createSignedUrl }));
  let service: MediaService;

  beforeEach(() => {
    vi.resetAllMocks();
    upload.mockResolvedValue({ data: {}, error: null });
    remove.mockResolvedValue({ data: [], error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.test/public.webp' } });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://cdn.example.test/signed.webp' }, error: null });
    singleMedia.mockResolvedValue({ data: ASSET, error: null });
    selectMedia.mockReturnValue({ single: singleMedia });
    insertMedia.mockReturnValue({ select: selectMedia });
    insertLink.mockResolvedValue({ error: null });
    updateProfilesEq.mockResolvedValue({ error: null });
    updateProfiles.mockReturnValue({ eq: updateProfilesEq });
    insertQueue.mockResolvedValue({ error: null });
    from.mockImplementation((table: string) => {
      switch (table) {
        case 'media_assets': return { insert: insertMedia };
        case 'listing_media': return { insert: insertLink };
        case 'profiles': return { update: updateProfiles };
        case 'media_cleanup_queue': return { insert: insertQueue };
        default: return {};
      }
    });
    rpc.mockResolvedValue({ data: CLEANUP, error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: () => ({ id: 'user-1' }), roles: () => ['resident'] } },
        { provide: SupabaseService, useValue: {
          client: { storage: { from: storageFrom }, from, rpc },
        } },
      ],
    });
    service = TestBed.inject(MediaService);
  });

  const imageFile = (): File => new File([new Uint8Array(2048)], 'photo.png', { type: 'image/png' });
  const options = (overrides: Record<string, unknown> = {}) => ({
    entityType: 'listing' as const,
    entityId: LISTING_ID,
    file: imageFile(),
    sortOrder: 0,
    ...overrides,
  });

  it('rejects unsupported file types', () => {
    expect(() => service.validateFileType(new File(['x'], 'a.exe', { type: 'application/x-msdownload' }))).toThrow(/not a supported file type/i);
    expect(() => service.validateFileType(imageFile())).not.toThrow();
  });

  it('enforces the configured size limit and the absolute cap', () => {
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    expect(() => service.validateFileSize(big, 5 * 1024 * 1024)).not.toThrow();
    expect(() => service.validateFileSize(big, 1024)).toThrow(/size/i);
  });

  it('requires an authenticated user before uploading', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: () => null, roles: () => [] } },
        { provide: SupabaseService, useValue: { client: { storage: { from: vi.fn() }, from, rpc } } },
      ],
    });
    const unauthenticated = TestBed.inject(MediaService);
    await expect(unauthenticated.uploadImage(options())).rejects.toThrow(/log in/i);
  });

  it('uploads an image and records a listing relationship', async () => {
    const asset = await service.uploadImage(options());
    expect(asset.id).toBe(ASSET.id);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(insertLink).toHaveBeenCalledWith(expect.objectContaining({ listing_id: LISTING_ID, media_asset_id: ASSET.id }));
  });

  it('removes the stored file when the metadata insert fails', async () => {
    singleMedia.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } });
    await expect(service.uploadImage(options())).rejects.toThrow(/details could not be saved/i);
    expect(storageFrom).toHaveBeenCalledWith(PUBLIC_BUCKET);
    expect(remove).toHaveBeenCalledWith([expect.stringMatching(/^services\//)]);
  });

  it('records a cleanup request when the rollback cannot remove the file', async () => {
    singleMedia.mockResolvedValue({ data: null, error: { code: '23505' } });
    remove.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(service.uploadImage(options())).rejects.toThrow();
    expect(insertQueue).toHaveBeenCalledWith(expect.objectContaining({ bucket_name: PUBLIC_BUCKET, reason: 'metadata_failed' }));
  });

  it('deletes media through the RPC and then removes the stored object', async () => {
    await service.deleteMedia(ASSET.id);
    expect(rpc).toHaveBeenNthCalledWith(1, 'delete_media_asset', { _media_id: ASSET.id });
    expect(remove).toHaveBeenCalledWith([CLEANUP.object_path]);
    expect(rpc).toHaveBeenNthCalledWith(2, 'resolve_media_cleanup', { _queue_id: CLEANUP.id, _error: null });
  });

  it('keeps the cleanup queue item when the stored object cannot be removed', async () => {
    remove.mockResolvedValue({ data: null, error: { message: 'object missing' } });
    await service.deleteMedia(ASSET.id);
    expect(rpc).toHaveBeenNthCalledWith(2, 'resolve_media_cleanup', { _queue_id: CLEANUP.id, _error: 'object missing' });
  });

  it('rejects unsafe public URL inputs and accepts bucket object paths', () => {
    expect(service.getPublicUrl('https://cdn.example.test/a.webp')).toBe('https://cdn.example.test/a.webp');
    expect(service.getPublicUrl('http://cdn.example.test/a.webp')).toBeNull();
    expect(service.getPublicUrl('https://user:pass@cdn.example.test/a.webp')).toBeNull();
    expect(service.getPublicUrl('other-bucket/a.webp')).toBeNull();
    expect(service.getPublicUrl(`${PUBLIC_BUCKET}/a/b.webp`)).toBe('https://cdn.example.test/public.webp');
    expect(service.getPublicUrl(`${PUBLIC_BUCKET}/../a.webp`)).toBeNull();
    expect(service.getPublicUrl('/absolute.webp')).toBeNull();
  });

  it('returns null for signed URLs outside the private bucket', async () => {
    expect(await service.getSignedUrl(`${PUBLIC_BUCKET}/a.webp`)).toBeNull();
    expect(await service.getSignedUrl(`${PRIVATE_BUCKET}/verification/user-1/doc.pdf`, 120)).toBe('https://cdn.example.test/signed.webp');
    expect(createSignedUrl).toHaveBeenCalledWith('verification/user-1/doc.pdf', 120);
  });
});
