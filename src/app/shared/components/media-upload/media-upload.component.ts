import { ChangeDetectionStrategy, Component, OnChanges, OnDestroy, OnInit, SimpleChanges, computed, inject, input, output, signal } from '@angular/core';
import { MediaService } from '../../../core/services/media.service';
import { LanguageService } from '../../../core/services/language.service';
import {
  MediaAsset,
  MediaEntityType,
  MediaGalleryItem,
  PUBLIC_IMAGE_MIME_TYPES,
  PRIVATE_FILE_MIME_TYPES,
  ProviderMediaRole,
} from '../../../core/models/media.models';
import { DEFAULT_ACCEPTED_TYPES, MediaUploadDraft } from './media-upload.models';

const MB = 1024 * 1024;

@Component({
  selector: 'app-media-upload',
  templateUrl: './media-upload.component.html',
  styleUrl: './media-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaUploadComponent implements OnInit, OnChanges, OnDestroy {
  private readonly media = inject(MediaService);
  protected readonly language = inject(LanguageService);

  readonly entityType = input.required<MediaEntityType>();
  readonly entityId = input.required<string>();
  readonly uploadType = input<'image' | 'document'>('image');
  readonly multiple = input(true);
  readonly maxFiles = input(10);
  readonly maxFileSizeMb = input(5);
  readonly acceptedTypes = input<readonly string[]>(DEFAULT_ACCEPTED_TYPES);
  readonly allowPreview = input(true);
  readonly allowReplace = input(true);
  readonly allowDelete = input(true);
  readonly disabled = input(false);
  readonly role = input<ProviderMediaRole>('gallery');
  readonly maxWidth = input(1600);
  readonly altText = input<string | null>(null);
  readonly headingId = input('media-upload-title');
  /** Upload selected images immediately instead of showing a separate batch action. */
  readonly autoUpload = input(false);
  /** Show camera/gallery actions instead of the generic browse action for images. */
  readonly showCameraActions = input(false);

  /** Emitted after each successful batch of uploads. */
  readonly uploaded = output<MediaAsset[]>();
  /** Emitted with the removed asset id when an existing image is deleted. */
  readonly deleted = output<string>();
  /** Emitted when one or more items failed to upload. */
  readonly failed = output<string[]>();

  protected readonly drafts = signal<MediaUploadDraft[]>([]);
  protected readonly existing = signal<MediaGalleryItem[]>([]);
  protected readonly existingLoading = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmDeleteId = signal<string | null>(null);
  protected readonly replaceTargetId = signal<string | null>(null);
  protected readonly dragActive = signal(false);
  protected readonly selectingFiles = signal(false);
  protected readonly uploadProgress = signal<{ current: number; total: number } | null>(null);

  private readonly objectUrls = new Set<string>();

  protected readonly acceptAttr = computed(() => this.effectiveAcceptedTypes().join(','));
  protected readonly maxFileBytes = computed(() => this.maxFileSizeMb() * MB);
  protected readonly canUpload = computed(() => Boolean(this.entityId()) && !this.disabled() && !this.uploadingAll() && this.drafts().some((d) => d.status !== 'uploading'));
  protected readonly uploadingAll = computed(() => this.drafts().some((d) => d.status === 'uploading'));
  protected readonly failedDrafts = computed(() => this.drafts().filter((d) => d.status === 'failed'));
  protected readonly readyCount = computed(() => this.drafts().filter((d) => d.status !== 'uploading').length);

  ngOnInit(): void {
    void this.refreshExisting();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entityId'] && !changes['entityId'].firstChange && this.entityId()) void this.activateEntity();
  }

  ngOnDestroy(): void {
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
  }

  // -- selection ----------------------------------------------------
  protected async onFilesSelected(event: Event): Promise<void> {
    await this.processSelection(event);
  }

  protected async onCameraSelected(event: Event): Promise<void> {
    await this.processSelection(event);
  }

  protected async onGallerySelected(event: Event): Promise<void> {
    await this.processSelection(event);
  }

  protected onCameraCancelled(): void {
    this.message.set(this.language.language() === 'ta' ? 'புகைப்படம் தேர்ந்தெடுக்கப்படவில்லை. கேலரியிலிருந்து படத்தைத் தேர்வு செய்யலாம்.' : 'No photo was captured. You can choose a photo from your gallery instead.');
  }

  private async processSelection(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    try {
      const files = Array.from(input.files ?? []);
      if (!files.length) {
        if (input.hasAttribute('capture')) this.message.set(this.language.language() === 'ta' ? 'புகைப்படம் தேர்ந்தெடுக்கப்படவில்லை. கேலரியிலிருந்து படத்தைத் தேர்வு செய்யவும்.' : 'No photo was captured. If the camera is unavailable, choose a photo from your gallery.');
        return;
      }
      await this.addFiles(files);
      if (this.autoUpload() && this.entityId()) await this.upload();
    } finally {
      input.value = '';
    }
  }


  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragActive.set(false);
    if (this.disabled()) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    await this.addFiles(files);
    if (this.autoUpload() && this.entityId()) await this.upload();
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) this.dragActive.set(true);
  }

  protected onDragLeave(): void {
    this.dragActive.set(false);
  }

  protected onDragEnd(): void {
    this.dragActive.set(false);
  }

  protected effectiveAcceptedTypes(): readonly string[] {
    const allowed = this.acceptedTypes();
    return allowed.length ? allowed : this.uploadType() === 'image' ? PUBLIC_IMAGE_MIME_TYPES : PRIVATE_FILE_MIME_TYPES;
  }

  private async addFiles(files: File[]): Promise<void> {
    if (this.selectingFiles()) return;
    this.selectingFiles.set(true);
    try {
      await this.prepareFiles(files);
    } finally {
      this.selectingFiles.set(false);
    }
  }

  private async prepareFiles(files: File[]): Promise<void> {
    this.error.set(null);
    this.message.set(null);
    const room = Math.max(0, this.maxFiles() - this.existing().length - this.drafts().length);
    if (room <= 0) {
      this.error.set(`You can upload up to ${this.maxFiles()} images.`);
      return;
    }
    const slice = this.multiple() ? files.slice(0, room) : files.slice(0, 1);
    const accepted = this.effectiveAcceptedTypes();
    const next: MediaUploadDraft[] = [];
    const seen = new Set(this.drafts().map((draft) => this.fileKey(draft.file)));
    for (const selectedFile of slice) {
      let file = selectedFile;
      try {
        file = this.normalizeImageFile(selectedFile);
        if (seen.has(this.fileKey(file))) continue;
        seen.add(this.fileKey(file));
        this.media.validateFileType(file, accepted);
        this.media.validateFileSize(file, this.maxFileBytes(), this.maxFileBytes());
        if (this.uploadType() === 'image') await this.media.validateImageDimensions(file);
        const previewUrl = this.uploadType() === 'image' && this.allowPreview() && file.type !== 'image/svg+xml' ? this.newObjectUrl(file) : null;
        next.push({ id: this.nextId(), file, previewUrl, status: 'ready', error: null });
      } catch (error) {
        next.push({ id: this.nextId(), file, previewUrl: null, status: 'failed', error: error instanceof Error ? error.message : 'Please select a valid file.' });
      }
    }
    this.drafts.update((current) => [...current, ...next]);
    if (slice.length && !next.length && !this.error()) this.message.set(this.language.language() === 'ta' ? 'இந்தப் படம் ஏற்கனவே தேர்ந்தெடுக்கப்பட்டுள்ளது.' : 'That photo is already selected.');
    if (files.length > slice.length) this.error.set(`Only the first ${slice.length} file(s) were added. You can upload up to ${this.maxFiles()} images.`);
  }

  private fileKey(file: File): string {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

  private normalizeImageFile(file: File): File {
    if (this.uploadType() !== 'image' || file.type) return file;
    const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    const mime: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
    const inferred = extension ? mime[extension] : undefined;
    return inferred ? new File([file], file.name, { type: inferred, lastModified: file.lastModified }) : file;
  }

  private newObjectUrl(file: File): string {
    const url = URL.createObjectURL(file);
    this.objectUrls.add(url);
    return url;
  }

  private nextId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  protected removeDraft(id: string): void {
    this.drafts.update((current) => current.filter((d) => {
      if (d.id === id && d.previewUrl) {
        URL.revokeObjectURL(d.previewUrl);
        this.objectUrls.delete(d.previewUrl);
      }
      return d.id !== id;
    }));
  }

  protected clearAll(): void {
    for (const draft of this.drafts()) {
      if (draft.previewUrl) {
        URL.revokeObjectURL(draft.previewUrl);
        this.objectUrls.delete(draft.previewUrl);
      }
    }
    this.drafts.set([]);
    this.error.set(null);
    this.message.set(null);
  }

  // -- upload -------------------------------------------------------
  protected async upload(): Promise<void> {
    if (this.uploadingAll() || this.selectingFiles() || this.existingLoading()) return;
    if (!this.entityId()) {
      this.error.set(this.language.language() === 'ta' ? 'படங்களைப் பதிவேற்றுவதற்கு முன் சேவையைச் சேமிக்கவும்.' : 'Save this service before uploading its photos.');
      return;
    }
    const targets = this.drafts().filter((d) => d.status !== 'uploading');
    if (this.existing().length + targets.length > this.maxFiles()) {
      this.error.set(`You can upload up to ${this.maxFiles()} images in total.`);
      return;
    }
    if (!targets.length || this.disabled()) return;
    this.error.set(null);
    this.message.set(null);
    const existingImages = this.existing();
    const nextSortOrder = Math.max(-1, ...existingImages.map((item, index) => item.sortOrder ?? index)) + 1;
    const succeeded: MediaAsset[] = [];
    const failed: string[] = [];
    let index = 0;
    this.uploadProgress.set({ current: 1, total: targets.length });
    try {
      for (const [targetIndex, draft] of targets.entries()) {
        this.uploadProgress.set({ current: targetIndex + 1, total: targets.length });
        this.markDraft(draft.id, { status: 'uploading', error: null });
        try {
          const asset = await this.uploadOne(draft.file, nextSortOrder + index);
          succeeded.push(asset);
          this.removeDraft(draft.id);
          index += 1;
        } catch (error) {
          const text = error instanceof Error ? error.message : 'Unable to upload image. Please try again.';
          failed.push(draft.file.name);
          this.markDraft(draft.id, { status: 'failed', error: text });
        }
      }
    } finally {
      this.uploadProgress.set(null);
    }
    if (succeeded.length) {
      this.uploaded.emit(succeeded);
      await this.refreshExisting();
      this.message.set(succeeded.length === 1 ? 'Image uploaded successfully.' : `${succeeded.length} images uploaded successfully.`);
    }
    if (failed.length) {
      this.failed.emit(failed);
      this.error.set(`Unable to upload ${failed.length} image${failed.length === 1 ? '' : 's'}. Please try again.`);
    }
  }

  private async uploadOne(file: File, sortOrder: number): Promise<MediaAsset> {
    const shared = {
      entityType: this.entityType(),
      entityId: this.entityId(),
      file,
      role: this.role(),
      sortOrder,
      altText: this.altText() ?? undefined,
      maxFileBytes: this.maxFileBytes(),
      maxWidth: this.maxWidth(),
      allowedTypes: this.effectiveAcceptedTypes(),
    };
    if (this.uploadType() === 'document') {
      if (shared.entityType !== 'profile' && shared.entityType !== 'provider') {
        throw new Error('Document uploads need a profile or a business.');
      }
      return this.media.uploadPrivateFile({ ...shared, entityType: shared.entityType });
    }
    const firstEver = this.existing().length === 0 && sortOrder === 0;
    return this.media.uploadImage({ ...shared, isPrimary: firstEver });
  }

  private markDraft(id: string, patch: Partial<Pick<MediaUploadDraft, 'status' | 'error'>>): void {
    this.drafts.update((current) => current.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  // -- existing items -----------------------------------------------
  protected async refreshExisting(): Promise<void> {
    if (!this.entityId()) {
      this.existing.set([]);
      this.existingLoading.set(false);
      return;
    }
    this.existingLoading.set(true);
    try {
      this.existing.set(await this.media.getMediaGallery(this.entityType(), this.entityId()));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load the images.');
    } finally {
      this.existingLoading.set(false);
    }
  }

  private async activateEntity(): Promise<void> {
    await this.refreshExisting();
    if (this.autoUpload() && this.drafts().length) await this.upload();
  }

  protected requestDelete(id: string): void {
    this.confirmDeleteId.set(id);
  }

  protected cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const id = this.confirmDeleteId();
    this.confirmDeleteId.set(null);
    if (!id) return;
    try {
      await this.media.deleteMedia(id);
      this.deleted.emit(id);
      this.message.set('Image deleted.');
      await this.refreshExisting();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to delete this image.');
    }
  }

  protected requestReplace(id: string, picker: HTMLInputElement): void {
    this.replaceTargetId.set(id);
    picker.click();
  }

  protected async onReplaceSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const target = this.replaceTargetId();
    input.value = '';
    this.replaceTargetId.set(null);
    if (!file || !target || this.disabled()) return;
    this.error.set(null);
    try {
      this.media.validateFileType(file, this.effectiveAcceptedTypes());
      this.media.validateFileSize(file, this.maxFileBytes(), this.maxFileBytes());
      await this.media.replaceImage(target, {
        entityType: this.entityType(),
        entityId: this.entityId(),
        file,
        role: this.role(),
        altText: this.altText() ?? undefined,
        maxFileBytes: this.maxFileBytes(),
        maxWidth: this.maxWidth(),
        allowedTypes: this.effectiveAcceptedTypes(),
      });
      this.message.set('Image replaced successfully.');
      await this.refreshExisting();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to replace this image.');
    }
  }

  protected formatSize(size: number | null): string {
    if (size == null) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
}
