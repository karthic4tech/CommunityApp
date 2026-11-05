import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-form-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (message()) { <div class="cdm-form-feedback" [class.error]="kind() === 'error'" [class.success]="kind() === 'success'" [class.info]="kind() === 'info'" [attr.role]="kind() === 'error' ? 'alert' : 'status'" aria-live="polite"><i class="bi" [class.bi-exclamation-circle]="kind() === 'error'" [class.bi-check-circle]="kind() === 'success'" [class.bi-info-circle]="kind() === 'info'" aria-hidden="true"></i><span>{{ message() }}</span><ng-content /></div> }`,
  styles: `
    :host { display:block; }
    .cdm-form-feedback { display:flex; align-items:flex-start; gap:.55rem; padding:.75rem .9rem; border:1px solid var(--cdm-form-border); border-radius:10px; color:var(--cdm-form-text); background:var(--cdm-page); font-size:.85rem; line-height:1.55; }
    .cdm-form-feedback i { margin-top:.08rem; }
    .cdm-form-feedback.error { border-color:var(--cdm-form-danger); color:#C92A2A; background:var(--cdm-orange-soft); }
    .cdm-form-feedback.success { border-color:var(--cdm-green); color:var(--cdm-royal-blue); background:var(--cdm-green-soft); }
    .cdm-form-feedback.info { border-color:var(--cdm-blue-soft); color:var(--cdm-navy); background:var(--cdm-page); }
  `,
})
export class FormFeedbackComponent {
  readonly kind = input<'error'|'success'|'info'>('info');
  readonly message = input('');
}
