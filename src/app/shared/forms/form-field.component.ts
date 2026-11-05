import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cdm-form-field" [class.has-error]="!!error()">
      <label class="cdm-form-label" [for]="controlId()">{{ label() }}@if (required()) { <span class="cdm-required" aria-hidden="true">*</span><span class="visually-hidden"> (required)</span> }@else if (optional()) { <span class="cdm-optional">Optional</span> }</label>
      <ng-content />
      @if (hint()) { <small class="cdm-form-hint" [id]="hintId()">{{ hint() }}</small> }
      @if (error()) { <small class="cdm-form-error" [id]="errorId()" role="alert">{{ error() }}</small> }
    </div>
  `,
  styles: `
    :host { display:block; min-width:0; }
    .cdm-form-field { display:grid; min-width:0; gap:.42rem; }
    .cdm-form-label { margin:0; color:var(--cdm-form-text); font-size:.86rem; font-weight:680; line-height:1.35; }
    .cdm-required { margin-left:.22rem; color:var(--cdm-form-danger); }
    .cdm-optional { margin-left:.4rem; color:var(--cdm-form-muted); font-size:.73rem; font-weight:450; }
    .cdm-form-hint,.cdm-form-error { color:var(--cdm-form-muted); font-size:.75rem; line-height:1.45; }
    .cdm-form-error { color:#C92A2A; }
  `,
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly controlId = input.required<string>();
  readonly required = input(false);
  readonly optional = input(false);
  readonly hint = input('');
  readonly error = input('');
  protected readonly hintId = computed(() => `${this.controlId()}-hint`);
  protected readonly errorId = computed(() => `${this.controlId()}-error`);
}
