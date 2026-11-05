import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FormSelectOption } from './form-control.component';

@Component({
  selector: 'app-form-radio-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FormRadioGroupComponent), multi: true }],
  template: `<fieldset class="cdm-radio-group" [attr.aria-describedby]="hint() ? groupId() + '-hint' : null"><legend>{{ label() }}@if (required()) { <span aria-hidden="true">*</span><span class="visually-hidden"> (required)</span> }</legend>@if (hint()) { <p [id]="groupId() + '-hint'">{{ hint() }}</p>}<div class="choices">@for (option of options(); track option.value) { <label [for]="groupId() + '-' + option.value"><input type="radio" [id]="groupId() + '-' + option.value" [name]="groupId()" [value]="option.value" [checked]="value() === option.value" [disabled]="disabled() || option.disabled" [required]="required()" (change)="select(option.value)" (blur)="touched()"><span>{{ option.label }}</span></label> }</div></fieldset>`,
  styles: `
    :host { display:block; min-width:0; }
    fieldset { min-width:0; margin:0;padding:0;border:0; }.cdm-radio-group legend { margin-bottom:.45rem;color:var(--cdm-form-text);font-size:.86rem;font-weight:680; }.cdm-radio-group legend>span:first-of-type { margin-left:.2rem;color:#C92A2A; }.cdm-radio-group p { margin:0 0 .55rem;color:var(--cdm-form-muted);font-size:.75rem; }.choices { display:flex;flex-wrap:wrap;gap:.55rem; }.choices label { display:flex;align-items:center;gap:.5rem;min-height:44px;padding:.55rem .75rem;border:1px solid var(--cdm-form-border);border-radius:9px;color:var(--cdm-form-text);background:white;cursor:pointer; }.choices input { accent-color:var(--cdm-form-green); }.choices label:has(input:checked) { border-color:var(--cdm-form-green);background:var(--cdm-page); }.choices label:has(input:focus-visible) { outline:3px solid color-mix(in srgb, var(--cdm-green) 24%, transparent);outline-offset:2px; }
  `,
})
export class FormRadioGroupComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly groupId = input.required<string>();
  readonly options = input.required<readonly FormSelectOption[]>();
  readonly hint = input('');
  readonly required = input(false);
  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  writeValue(value: unknown): void { this.value.set(typeof value === 'string' ? value : ''); }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }
  protected select(value: string): void { this.value.set(value); this.onChange(value); }
  protected touched(): void { this.onTouched(); }
}
