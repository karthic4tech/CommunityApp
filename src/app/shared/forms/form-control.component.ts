import { ChangeDetectionStrategy, Component, ElementRef, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SearchableSelectComponent } from '../components/searchable-select/searchable-select.component';
import { SearchableSelectValue } from '../components/searchable-select/searchable-select.models';

export interface FormSelectOption { label: string; value: string; disabled?: boolean; }
export type FormControlType = 'text'|'email'|'tel'|'number'|'url'|'date'|'password'|'search';
const CONTROL_KIND_BY_SELECTOR: Readonly<Record<string, 'textarea'|'select'|'date'>> = {
  'app-form-textarea':'textarea', 'app-form-select':'select', 'app-form-date-picker':'date',
};

@Component({
  selector: 'app-form-input, app-form-textarea, app-form-select, app-form-date-picker',
  imports: [SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FormControlComponent), multi: true }],
  template: `
      @if (controlKind() === 'select') {
      <app-searchable-select [label]="label()" [controlId]="controlId()" [options]="options()" [value]="value()"
        (valueChange)="onSelectChange($event)" (touched)="onBlur()" [placeholder]="placeholder() || 'Choose an option'" [hint]="hint()" [error]="error()"
        [required]="required()" [disabled]="disabled()" [readOnly]="readOnly()" [clearable]="!required()" [emptyValue]="''" />
    } @else {
      <div class="cdm-control-field">
        <label class="cdm-control-label" [for]="controlId()">{{ label() }}@if (required()) { <span aria-hidden="true">*</span><span class="visually-hidden"> (required)</span> }@else if (optional()) { <small>Optional</small> }</label>
        @if (controlKind() === 'textarea') {
          <textarea class="form-control" [id]="controlId()" [rows]="rows()" [placeholder]="placeholder()" [required]="required()" [readOnly]="readOnly()" [disabled]="disabled()" [attr.maxlength]="maxLength()" [attr.aria-invalid]="error() ? 'true' : null" [attr.aria-describedby]="describedBy()" [value]="value()" (input)="onInput($event)" (blur)="onBlur()"></textarea>
        } @else {
          <input class="form-control" [type]="controlKind() === 'date' ? 'date' : type()" [id]="controlId()" [placeholder]="placeholder()" [required]="required()" [readOnly]="readOnly()" [disabled]="disabled()" [attr.maxlength]="maxLength()" [attr.min]="min()" [attr.max]="max()" [attr.step]="step()" [attr.inputmode]="inputMode() || null" [autocomplete]="autocomplete()" [attr.aria-invalid]="error() ? 'true' : null" [attr.aria-describedby]="describedBy()" [value]="value()" (input)="onInput($event)" (blur)="onBlur()">
        }
        @if (hint()) { <small class="cdm-control-hint" [id]="controlId() + '-hint'">{{ hint() }}</small> }
        @if (error()) { <small class="cdm-control-error" [id]="controlId() + '-error'" role="alert">{{ error() }}</small> }
      </div>
    }
  `,
  styles: `
    :host { display:block; min-width:0; }
    .cdm-control-field { display:grid; gap:.42rem; min-width:0; }
    .cdm-control-label { color:var(--cdm-form-text); font-size:.86rem; font-weight:680; }
    .cdm-control-label>span:first-of-type { margin-left:.2rem; color:#C92A2A; }
    .cdm-control-label small,.cdm-control-hint { color:var(--cdm-form-muted); font-size:.75rem; font-weight:450; }
    .form-control,.form-select { width:100%; min-width:0; min-height:50px; border:1px solid var(--cdm-form-border); border-radius:10px; padding:.7rem .85rem; color:var(--cdm-form-text); background:#fff; font:inherit; font-size:.9rem; box-shadow:0 1px 2px color-mix(in srgb, var(--cdm-navy) 3%, transparent); transition:border-color .15s,box-shadow .15s; }
    textarea.form-control { min-height:120px; resize:vertical; line-height:1.55; }
    .form-control:focus,.form-select:focus { border-color:var(--cdm-form-green); outline:0; box-shadow:0 0 0 .22rem color-mix(in srgb, var(--cdm-green) 14%, transparent); }
    .form-control[aria-invalid=true],.form-select[aria-invalid=true] { border-color:#C92A2A; }
    .form-control:disabled,.form-select:disabled { color:var(--cdm-muted); background:var(--cdm-page); cursor:not-allowed; }
    .form-control[readonly] { background:var(--cdm-page); }
    .cdm-control-error { color:#C92A2A; font-size:.76rem; line-height:1.45; }
    :focus-visible { outline-offset:2px; }
  `,
})
export class FormControlComponent implements ControlValueAccessor {
  private readonly hostTag = String(inject(ElementRef<HTMLElement>).nativeElement.tagName).toLocaleLowerCase();
  readonly kind = input<'input'|'textarea'|'select'|'date'|undefined>(undefined);
  protected readonly controlKind = computed(() => this.kind() ?? CONTROL_KIND_BY_SELECTOR[this.hostTag] ?? 'input');
  readonly type = input<FormControlType>('text');
  readonly label = input.required<string>();
  readonly controlId = input.required<string>();
  readonly placeholder = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly required = input(false);
  readonly optional = input(false);
  readonly readOnly = input(false);
  readonly rows = input(4);
  readonly maxLength = input<number|null>(null);
  readonly min = input<string|number|null>(null);
  readonly max = input<string|number|null>(null);
  readonly step = input<string|number|null>(null);
  readonly inputMode = input('');
  readonly autocomplete = input('off');
  readonly options = input<readonly FormSelectOption[]>([]);
  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private onChange: (value: unknown) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  protected describedBy(): string | null {
    const ids = [this.hint() ? `${this.controlId()}-hint` : '', this.error() ? `${this.controlId()}-error` : ''].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  }
  writeValue(value: unknown): void { this.value.set(typeof value === 'string' || typeof value === 'number' ? String(value) : ''); }
  registerOnChange(fn: (value: unknown) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }
  protected onInput(event: Event): void {
    const raw = (event.currentTarget as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement).value;
    this.value.set(raw);
    this.onChange(this.controlKind() === 'input' && this.type() === 'number' ? (raw === '' ? null : Number(raw)) : raw);
  }
  protected onSelectChange(value: SearchableSelectValue): void { const next = value ?? ''; this.value.set(next); this.onChange(next); }
  protected onBlur(): void { this.onTouched(); }
}
