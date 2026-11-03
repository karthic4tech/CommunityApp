import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminMediaModule, AdminMediaQuery, AdminMediaRow, MediaAsset, MediaCleanupItem, MediaGalleryItem, MediaStats, PRIVATE_BUCKET, MediaUploadStatus } from '../core/models/media.models';
import { MediaService } from '../core/services/media.service';
import { MediaPreviewComponent } from '../shared/components/media-preview/media-preview.component';

const PAGE_SIZE = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-admin-media',
  imports: [RouterLink, NgOptimizedImage, MediaPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'closeOverlays()' },
  template: `
    <section class="admin-page" aria-labelledby="admin-media-title">
      <header class="admin-header">
        <div>
          <a class="back-link" routerLink="/admin"><i class="bi bi-arrow-left" aria-hidden="true"></i> Admin dashboard</a>
          <p class="eyebrow">MEDIA</p>
          <h1 id="admin-media-title">Media management</h1>
          <p class="intro">Review, preview and remove uploaded media. Authorisation is enforced by the database; this page only shows it.</p>
        </div>
        <button type="button" class="secondary-action" (click)="reload()" [disabled]="loading()">Refresh</button>
      </header>

      <div class="stats-grid" aria-label="Media statistics">
        @if (statsError(); as error) {
          <p class="state" role="alert">{{ error }}</p>
        } @else {
          @if (stats(); as stats) {
            <dl class="stat-card"><dt>Total media</dt><dd>{{ stats.total }}</dd></dl>
            <dl class="stat-card"><dt>Public</dt><dd>{{ stats.public }}</dd></dl>
            <dl class="stat-card"><dt>Private</dt><dd>{{ stats.private }}</dd></dl>
            <dl class="stat-card"><dt>Failed uploads</dt><dd>{{ stats.failed }}</dd></dl>
            <dl class="stat-card"><dt>Orphaned records</dt><dd>{{ stats.orphaned }}</dd></dl>
            <dl class="stat-card"><dt>Awaiting cleanup</dt><dd>{{ stats.pending_cleanup }}</dd></dl>
            <dl class="stat-card"><dt>Uploaded (7 days)</dt><dd>{{ stats.recent }}</dd></dl>
            <dl class="stat-card"><dt>Storage used</dt><dd>{{ formatBytes(stats.bytes) }}</dd></dl>
          } @else {
            <p class="state" role="status">Loading statistics…</p>
          }
        }
      </div>

      <form class="toolbar" (submit)="applyFilters($event)">
        <label class="search-label">
          <span>Search filename</span>
          <input #search type="search" name="search" [value]="filters.search" [placeholder]="'image.webp'" />
        </label>
        <label class="filter">
          <span>Module</span>
          <select name="module" [value]="filters.module">
            <option value="all">All modules</option>
            <option value="service_listing">Service listing</option>
            <option value="provider">Businesses</option>
            <option value="profile">Profiles</option>
          </select>
        </label>
        <label class="filter">
          <span>Status</span>
          <select name="status" [value]="filters.status">
            <option value="all">All statuses</option>
            <option value="uploaded">Uploaded</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </label>
        <label class="filter">
          <span>Uploader ID</span>
          <input #uploader type="text" name="uploader" [value]="filters.uploaderId" placeholder="User UUID" autocomplete="off" />
        </label>
        <label class="filter">
          <span>From</span>
          <input type="date" name="from" [value]="filters.from" />
        </label>
        <label class="filter">
          <span>To</span>
          <input type="date" name="to" [value]="filters.to" />
        </label>
        <button type="submit" class="primary-action" [disabled]="loading()">Apply</button>
        <button type="button" class="secondary-action" (click)="resetFilters()">Clear</button>
      </form>
      @if (filterError(); as error) { <p class="state" role="alert">{{ error }}</p> }

      @if (loading()) {
        <p class="state" role="status">Loading media…</p>
      } @else if (errorMessage(); as message) {
        <div class="state"><p role="alert">{{ message }}</p><button type="button" class="primary-action" (click)="reload()">Try again</button></div>
      } @else if (!rows().length) {
        <p class="state" role="status">No media matches these filters.</p>
      } @else {
        <div class="table-wrap">
          <table>
            <caption class="visually-hidden">Uploaded media</caption>
            <thead>
              <tr><th scope="col">Thumbnail</th><th scope="col">File</th><th scope="col">Module</th><th scope="col">Size</th><th scope="col">Uploader</th><th scope="col">Uploaded</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr>
                  <td>
                    @if (thumbnailUrl(row); as url) {
                      <img class="thumb" [ngSrc]="url" width="72" height="72" [alt]="row.alt_text || row.original_filename || 'Uploaded image'" loading="lazy" (error)="markThumbBroken(row.id)" />
                    } @else {
                      <span class="thumb thumb-missing" aria-hidden="true"><i class="bi bi-file-earmark"></i></span>
                    }
                  </td>
                  <td><span class="file-cell"><strong>{{ row.original_filename || 'Untitled' }}</strong><small>{{ row.mime_type || 'unknown type' }}@if (row.width && row.height) { · {{ row.width }}×{{ row.height }}px }</small></span></td>
                  <td>{{ moduleLabel(row.related_module) }}</td>
                  <td>{{ formatBytes(row.file_size_bytes ?? 0) }}</td>
                  <td>{{ row.uploader_name || row.owner_user_id || 'Unknown' }}</td>
                  <td>{{ formatDate(row.created_at) }}</td>
                  <td><span class="status" [class.status-failed]="row.upload_status === 'failed'">{{ row.upload_status }}</span></td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="action-button" (click)="preview(row)">Preview</button>
                      <button type="button" class="action-button" (click)="showMetadata(row)">Details</button>
                      @if (confirmDeleteId() === row.id) {
                        <button type="button" class="danger-button" [disabled]="deletingId() === row.id" (click)="deleteRow(row)">{{ deletingId() === row.id ? 'Deleting…' : 'Confirm delete' }}</button>
                        <button type="button" class="action-button" (click)="confirmDeleteId.set(null)">Cancel</button>
                      } @else {
                        <button type="button" class="action-button" [disabled]="isDeleting(row.id)" (click)="confirmDeleteId.set(row.id)">Delete</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <nav class="pagination" aria-label="Media pages">
          <button type="button" class="secondary-action" [disabled]="page() === 1" (click)="goTo(page() - 1)">Previous</button>
          <span aria-live="polite">Page {{ page() }} of {{ totalPages() }} · {{ total() }} items</span>
          <button type="button" class="secondary-action" [disabled]="page() >= totalPages()" (click)="goTo(page() + 1)">Next</button>
        </nav>
      }

      <section class="cleanup" aria-labelledby="cleanup-title">
        <h2 id="cleanup-title">Retry failed cleanup</h2>
        @if (cleanupError(); as error) { <p class="state" role="alert">{{ error }}</p> }
        @else if (!cleanup().length) { <p class="state" role="status">No pending cleanup items.</p> }
        @else {
          <ul class="cleanup-list">
            @for (item of cleanup(); track item.id) {
              <li class="cleanup-item">
                <span><strong>{{ item.reason }}</strong> · {{ item.bucket_name }}/{{ item.object_path }} @if (item.last_error) { <small class="cleanup-error">{{ item.last_error }}</small> }</span>
                <button type="button" class="secondary-action" [disabled]="retryingId() === item.id" (click)="retryCleanup(item)">{{ retryingId() === item.id ? 'Retrying…' : 'Retry' }}</button>
              </li>
            }
          </ul>
        }
      </section>

      @if (metadataRow(); as row) {
        <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="metadata-title">
          <div class="overlay-panel">
            <div class="overlay-header"><h2 id="metadata-title">Media details</h2><button type="button" class="icon-button" aria-label="Close details" (click)="metadataRow.set(null)"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>
            <dl class="metadata-grid">
              <div><dt>File name</dt><dd>{{ row.original_filename }}</dd></div>
              <div><dt>Stored as</dt><dd>{{ row.stored_filename }}</dd></div>
              <div><dt>Bucket</dt><dd>{{ row.bucket_name }}</dd></div>
              <div><dt>Path</dt><dd>{{ row.storage_path }}</dd></div>
              <div><dt>Type</dt><dd>{{ row.mime_type }}</dd></div>
              <div><dt>Size</dt><dd>{{ formatBytes(row.file_size_bytes ?? 0) }}</dd></div>
              <div><dt>Dimensions</dt><dd>{{ row.width && row.height ? row.width + '×' + row.height + 'px' : '—' }}</dd></div>
              <div><dt>Visibility</dt><dd>{{ row.visibility }}</dd></div>
              <div><dt>Style</dt><dd>{{ row.media_type }}</dd></div>
              <div><dt>Status</dt><dd>{{ row.upload_status }}</dd></div>
              <div><dt>Module</dt><dd>{{ moduleLabel(row.related_module) }}</dd></div>
              <div><dt>Uploader</dt><dd>{{ row.uploader_name || row.owner_user_id || 'Unknown' }}</dd></div>
              <div><dt>Alt text</dt><dd>{{ row.alt_text || '—' }}</dd></div>
              <div><dt>Caption</dt><dd>{{ row.caption || '—' }}</dd></div>
              <div><dt>Created</dt><dd>{{ formatDate(row.created_at) }}</dd></div>
            </dl>
            <div class="overlay-footer"><button type="button" class="primary-action" (click)="metadataRow.set(null)">Close</button></div>
          </div>
        </div>
      }

      @if (previewItem(); as item) {
        <app-media-preview [items]="[item]" [index]="0" (closed)="previewItem.set(null)" />
      }
    </section>
  `,
  styles: `
    :host { display: block; padding-block: 1.5rem 2.5rem; }
    .admin-page { display: grid; gap: 1.25rem; }
    .admin-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: clamp(1.5rem,4vw,2.5rem); border-radius: 20px; background: linear-gradient(120deg,#eff7ee,#f8f8ed); border: 1px solid #dfeade; }
    .back-link { display: inline-flex; align-items: center; gap: .4rem; min-height: 44px; margin-bottom: .75rem; color: #075541; text-decoration: none; }
    .eyebrow { margin: 0 0 .35rem; color: #52665b; font-size: .72rem; font-weight: 800; letter-spacing: .12em; }
    h1 { margin: 0; color: #173f32; font-size: clamp(1.7rem,4vw,2.4rem); }
    .intro { color: #52665b; line-height: 1.7; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: .75rem; }
    .stat-card { margin: 0; padding: .9rem 1rem; border: 1px solid #dfe7e2; border-radius: 14px; background: #fff; display: grid; gap: .15rem; }
    .stat-card dt { color: #52665b; font-size: .78rem; }
    .stat-card dd { margin: 0; color: #173f32; font-size: 1.4rem; font-weight: 800; }
    .toolbar { display: flex; align-items: end; flex-wrap: wrap; gap: .6rem; padding: 1rem; border: 1px solid #dfe7e2; border-radius: 14px; background: #fff; }
    .toolbar label { display: grid; gap: .3rem; color: #173f32; font-size: .82rem; font-weight: 650; }
    .search-label { flex: 1 1 220px; }
    .filter { flex: 0 1 150px; }
    input, select { width: 100%; min-height: 44px; border: 1px solid #b8c9bf; border-radius: 9px; padding: .55rem; background: #fff; color: #173f32; font: inherit; }
    .primary-action, .secondary-action, .danger-button, .action-button {
      display: inline-flex; align-items: center; min-height: 44px; border-radius: 9px; padding: .55rem .8rem; font: inherit; font-weight: 700; cursor: pointer; border: 0;
    }
    .primary-action { background: #075541; color: #fff; }
    .secondary-action { background: #fff; color: #075541; border: 1px solid #b8c9bf; }
    .danger-button { background: #8a261f; color: #fff; }
    .action-button { background: #fff; color: #075541; border: 1px solid #b8c9bf; font-weight: 600; }
    .primary-action:disabled, .secondary-action:disabled, .action-button:disabled { opacity: .6; cursor: default; }
    .state { margin: 0; padding: 1rem 1.25rem; border: 1px solid #dfe7e2; border-radius: 14px; background: #fff; color: #52665b; line-height: 1.7; }
    .table-wrap { overflow-x: auto; border: 1px solid #dfe7e2; border-radius: 16px; background: #fff; }
    table { width: 100%; min-width: 900px; border-collapse: collapse; color: #173f32; }
    th, td { padding: .6rem .75rem; border-bottom: 1px solid #edf1ee; text-align: left; vertical-align: middle; }
    thead th { background: #f7faf7; color: #52665b; font-size: .8rem; }
    tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
    .thumb { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; background: #eef2ee; }
    .thumb-missing { display: inline-flex; align-items: center; justify-content: center; font-size: 1.5rem; color: #52665b; }
    .file-cell { display: flex; flex-direction: column; gap: .15rem; min-width: 180px; overflow-wrap: anywhere; }
    .file-cell small { color: #52665b; font-weight: 400; }
    .status { display: inline-flex; padding: .2rem .55rem; border-radius: 99px; background: #e2f3e8; color: #176044; font-size: .78rem; font-weight: 700; }
    .status-failed { background: #faf0ee; color: #8a261f; }
    .row-actions { display: flex; flex-wrap: wrap; gap: .35rem; }
    .pagination { display: flex; align-items: center; justify-content: space-between; gap: 1rem; color: #52665b; }
    .cleanup { display: grid; gap: .5rem; }
    .cleanup h2 { margin: 0; color: #173f32; font-size: 1.1rem; }
    .cleanup-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; }
    .cleanup-item { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .6rem .8rem; border: 1px solid #dfe7e2; border-radius: 12px; background: #fff; color: #173f32; overflow-wrap: anywhere; }
    .cleanup-error { display: block; color: #8a261f; }
    .overlay { position: fixed; inset: 0; z-index: 1040; display: grid; place-items: center; padding: 1rem; background: rgb(0 0 0 / .5); }
    .overlay-panel { width: min(100%, 640px); max-height: 90vh; overflow: auto; padding: 1.25rem; border-radius: 16px; background: #fff; }
    .overlay-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .overlay-header h2 { margin: 0; color: #173f32; font-size: 1.2rem; }
    .icon-button { width: 44px; height: 44px; border: 0; border-radius: 9px; background: #f1f4f1; color: #173f32; cursor: pointer; font-size: 1.1rem; }
    .metadata-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem 1rem; margin: 1rem 0; }
    .metadata-grid dt { color: #52665b; font-size: .78rem; }
    .metadata-grid dd { margin: .1rem 0 0; color: #173f32; overflow-wrap: anywhere; }
    .overlay-footer { display: flex; justify-content: flex-end; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    :is(a, button, input, select):focus-visible { outline: 3px solid #17583f; outline-offset: 2px; }
    @media (max-width: 760px) { .metadata-grid { grid-template-columns: 1fr; } .admin-header { flex-direction: column; } .pagination { flex-direction: column; } }
  `,
})
export class AdminMediaComponent implements OnInit {
  private readonly media = inject(MediaService);

  protected readonly stats = signal<MediaStats | null>(null);
  protected readonly statsError = signal<string | null>(null);
  protected readonly rows = signal<AdminMediaRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly filterError = signal<string | null>(null);
  protected readonly cleanup = signal<MediaCleanupItem[]>([]);
  protected readonly cleanupError = signal<string | null>(null);
  protected readonly retryingId = signal<string | null>(null);
  protected readonly deletingId = signal<string | null>(null);
  private readonly pendingDelete = signal<string | null>(null);
  protected readonly confirmDeleteId = this.pendingDelete;
  protected readonly metadataRow = signal<AdminMediaRow | null>(null);
  protected readonly previewItem = signal<MediaGalleryItem | null>(null);
  protected readonly brokenThumbs = signal<ReadonlySet<string>>(new Set());
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  protected filters = { search: '', module: 'all', status: 'all', uploaderId: '', from: '', to: '' };

  ngOnInit(): void {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    await Promise.all([this.loadStats(), this.loadCleanup(), this.loadRows()]);
    this.loading.set(false);
  }

  protected applyFilters(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const value = (name: string): string => String((form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '').trim();
    const uploader = value('uploader');
    if (uploader && !UUID.test(uploader)) {
      this.filterError.set('Uploader must be a valid user ID (UUID).');
      return;
    }
    this.filterError.set(null);
    this.filters = { search: value('search'), module: value('module'), status: value('status'), uploaderId: uploader, from: value('from'), to: value('to') };
    this.page.set(1);
    void this.loadRows();
  }

  protected resetFilters(): void {
    this.filters = { search: '', module: 'all', status: 'all', uploaderId: '', from: '', to: '' };
    this.filterError.set(null);
    this.page.set(1);
    void this.loadRows();
  }

  protected async goTo(page: number): Promise<void> {
    const target = Math.max(1, Math.min(page, this.totalPages()));
    this.page.set(target);
    await this.loadRows();
  }

  private async loadRows(): Promise<void> {
    try {
      const query: AdminMediaQuery = {
        search: this.filters.search || undefined,
        module: this.filters.module as AdminMediaModule | 'all',
        status: this.filters.status as MediaUploadStatus | 'all',
        uploaderId: this.filters.uploaderId || undefined,
        from: this.filters.from ? `${this.filters.from}T00:00:00Z` : undefined,
        to: this.filters.to ? `${this.filters.to}T23:59:59Z` : undefined,
        page: this.page(),
        pageSize: PAGE_SIZE,
      };
      const { rows, total } = await this.media.getAdminMedia(query);
      this.rows.set(rows);
      this.total.set(total);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load media.');
    }
  }

  private async loadStats(): Promise<void> {
    try {
      this.stats.set(await this.media.getMediaStats());
      this.statsError.set(null);
    } catch (error) {
      this.stats.set(null);
      this.statsError.set(error instanceof Error ? error.message : 'Unable to load media statistics.');
    }
  }

  private async loadCleanup(): Promise<void> {
    try {
      this.cleanup.set(await this.media.getCleanupItems());
      this.cleanupError.set(null);
    } catch (error) {
      this.cleanup.set([]);
      this.cleanupError.set(error instanceof Error ? error.message : 'Unable to load the cleanup queue.');
    }
  }

  protected thumbnailUrl(row: AdminMediaRow): string | null {
    if (this.brokenThumbs().has(row.id)) return null;
    if (row.bucket_name === PRIVATE_BUCKET) return null; // private files are not thumb-nailed here; open Details instead
    return this.media.getPublicUrl(row.storage_path);
  }

  protected markThumbBroken(id: string): void {
    this.brokenThumbs.update((set) => new Set(set).add(id));
  }

  protected moduleLabel(module: AdminMediaModule): string {
    switch (module) {
      case 'service_listing': return 'Service listing';
      case 'provider': return 'Businesses';
      case 'profile': return 'Profiles';
      default: return 'Not attached';
    }
  }

  protected async preview(row: AdminMediaRow): Promise<void> {
    const url = row.bucket_name === PRIVATE_BUCKET
      ? await this.media.getSignedUrl(row.storage_path, 300)
      : this.media.getPublicUrl(row.storage_path);
    if (!url) { this.showMetadata(row); return; }
    this.previewItem.set(this.toGalleryItem(row, url));
  }

  protected showMetadata(row: AdminMediaRow): void {
    this.metadataRow.set(row);
  }

  protected closeOverlays(): void {
    this.metadataRow.set(null);
    this.previewItem.set(null);
    this.pendingDelete.set(null);
  }

  protected isDeleting(id: string): boolean {
    return this.deletingId() === id;
  }

  protected async deleteRow(row: AdminMediaRow): Promise<void> {
    this.pendingDelete.set(null);
    this.deletingId.set(row.id);
    try {
      await this.media.deleteMedia(row.id);
      this.rows.update((rows) => rows.filter((r) => r.id !== row.id));
      this.total.update((n) => Math.max(0, n - 1));
      await Promise.all([this.loadStats(), this.loadCleanup()]);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to delete this image.');
    } finally {
      this.deletingId.set(null);
    }
  }

  protected async retryCleanup(item: MediaCleanupItem): Promise<void> {
    this.retryingId.set(item.id);
    try {
      const ok = await this.media.retryCleanup(item);
      if (!ok) this.cleanupError.set('The file could not be removed. It stays in the queue for the next retry.');
      await Promise.all([this.loadCleanup(), this.loadStats()]);
    } finally {
      this.retryingId.set(null);
    }
  }

  private toGalleryItem(row: AdminMediaRow, url: string): MediaGalleryItem {
    const asset: MediaAsset = {
      id: row.id, original_filename: row.original_filename, stored_filename: row.stored_filename,
      bucket_name: row.bucket_name, storage_path: row.storage_path, media_type: row.media_type,
      mime_type: row.mime_type, file_size_bytes: row.file_size_bytes, file_extension: null,
      width: row.width, height: row.height, alt_text: row.alt_text, caption: row.caption,
      visibility: row.visibility, upload_status: row.upload_status, owner_user_id: row.owner_user_id,
      created_at: row.created_at, updated_at: row.created_at, deleted_at: row.deleted_at,
    };
    return { asset, url, fileName: row.original_filename ?? 'image', size: row.file_size_bytes, alt: row.alt_text || row.original_filename || 'Uploaded image', primary: false };
  }

  protected formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const power = Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3));
    return `${(bytes / 10 ** (power * 3)).toFixed(power ? 1 : 0)} ${units[power]}`;
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
