import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MediaAsset, MediaEntityType, ProviderMediaRole } from '../../core/models/media.models';
import { MediaUploadComponent } from '../components/media-upload/media-upload.component';

@Component({
  selector: 'app-form-file-upload',
  imports: [MediaUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cdm-file-upload" [attr.aria-labelledby]="headingId()">
      <header><div><h3 [id]="headingId()">{{ label() }}</h3>@if (hint()) { <p>{{ hint() }}</p> }</div><span class="bi bi-cloud-arrow-up" aria-hidden="true"></span></header>
      <app-media-upload [entityType]="entityType()" [entityId]="entityId()" [uploadType]="uploadType()" [multiple]="multiple()" [maxFiles]="maxFiles()" [maxFileSizeMb]="maxFileSizeMb()" [acceptedTypes]="acceptedTypes()" [role]="role()" [disabled]="disabled()" [headingId]="headingId() + '-uploader'" (uploaded)="uploaded.emit($event)" (failed)="failed.emit($event)" (deleted)="deleted.emit($event)" />
    </section>
  `,
  styles: `
    :host { display:block;min-width:0; }.cdm-file-upload { padding:1rem;border:1px solid var(--cdm-form-border);border-radius:12px;background:var(--cdm-page); }.cdm-file-upload header { display:flex;align-items:center;justify-content:space-between;gap:.8rem;margin-bottom:.75rem; }.cdm-file-upload h3 { margin:0;color:var(--cdm-form-primary);font-size:.98rem;font-weight:750; }.cdm-file-upload p { margin:.25rem 0 0;color:var(--cdm-form-muted);font-size:.78rem;line-height:1.5; }.cdm-file-upload header>span { display:grid;place-items:center;flex:none;width:38px;height:38px;border-radius:10px;color:var(--cdm-form-green);background:var(--cdm-green-soft);font-size:1.15rem; }
  `,
})
export class FormFileUploadComponent {
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly entityType = input.required<MediaEntityType>();
  readonly entityId = input.required<string>();
  readonly uploadType = input<'image'|'document'>('image');
  readonly multiple = input(true);
  readonly maxFiles = input(10);
  readonly maxFileSizeMb = input(5);
  readonly acceptedTypes = input<readonly string[]>([]);
  readonly role = input<ProviderMediaRole>('gallery');
  readonly disabled = input(false);
  readonly headingId = input('form-upload-title');
  readonly uploaded = output<MediaAsset[]>();
  readonly failed = output<string[]>();
  readonly deleted = output<string>();
}
